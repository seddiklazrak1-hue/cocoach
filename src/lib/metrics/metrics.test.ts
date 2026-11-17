/**
 * Tests du pipeline de métriques avec des fixtures « à angle connu » : le
 * squelette paramétrable produit des poses dont on connaît les vrais angles,
 * et on vérifie que les métriques les retrouvent (critère : ±2°).
 */
import { describe, expect, it } from "vitest";
import { LM, type LandmarkName, type PoseSample } from "@/lib/pose/landmarks";
import { skeletonPose, withNoise, type SkeletonParams } from "@/lib/pose/skeleton";
import { seededRandom } from "@/lib/pose/synthetic";
import { DISCIPLINES } from "@/lib/roster/domain";
import { analyzeAthlete, computeConfidence, DEPTH_METRICS, EVENT_THRESHOLDS } from "./analyze";
import { DISCIPLINE_MODULES, metricsFor, thresholdsFor } from "./disciplines";
import { extractFeatures, medialKneeDeviation, staticFeatures } from "./features";
import {
  angleBetween,
  coefficientOfVariation,
  jointAngle,
  mean,
  median,
  quantile,
  standardDeviation,
  world,
} from "./geometry";
import { METRIC_KEYS, type ClipSeries, type MetricKey } from "./types";

const RATE = 10;

/** Séquence de `seconds` secondes, pose calculée à chaque instant t (secondes). */
function clip(seconds: number, pose: (t: number, i: number) => PoseSample | null): ClipSeries {
  return {
    frames: Array.from({ length: Math.round(seconds * RATE) }, (_, i) => pose(i / RATE, i)),
    sampleRateHz: RATE,
    aspect: 16 / 9,
  };
}

/** Même pose pendant toute la séquence, avec un léger bruit de détection. */
function still(params: SkeletonParams, seconds = 20, noise = 0.004, seed = 1): ClipSeries {
  const random = seededRandom(seed);
  return clip(seconds, () => withNoise(skeletonPose(params), noise, random));
}

const LIMBS: LandmarkName[] = [
  "leftWrist",
  "rightWrist",
  "leftElbow",
  "rightElbow",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
];

/** Décale les membres de `dx` mètres sur l'axe x (pour fabriquer des vitesses connues). */
function shiftLimbs(sample: PoseSample, dx: number, names: LandmarkName[] = LIMBS): PoseSample {
  const out: PoseSample = {
    xy: Float32Array.from(sample.xy),
    vis: Float32Array.from(sample.vis),
    world: Float32Array.from(sample.world),
  };
  for (const name of names) out.world[LM[name] * 3] += dx;
  return out;
}

const metric = (clips: ClipSeries[], key: MetricKey, discipline: Parameters<typeof analyzeAthlete>[1] = "other") =>
  analyzeAthlete(clips, discipline).metrics.find((m) => m.key === key);

describe("géométrie", () => {
  it("calcule angles et statistiques de base", () => {
    expect(angleBetween({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
    expect(angleBetween({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
    expect(jointAngle({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBeCloseTo(180);
    expect(median([3, 1, 2])).toBe(2);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
    expect(Number.isNaN(mean([]))).toBe(true);
    expect(standardDeviation([5])).toBe(0);
    expect(coefficientOfVariation([0, 0])).toBe(0);
    expect(coefficientOfVariation([1, 3])).toBeCloseTo(0.5);
  });
});

describe("squelette paramétrable (fixtures)", () => {
  it("produit exactement les angles demandés, même tourné face à la caméra ou de côté", () => {
    for (const facing of [0, 45, 90]) {
      const s = skeletonPose({ knee: 115, elbow: 80, facing });
      // Précision limitée par le stockage en nombres flottants 32 bits.
      expect(jointAngle(world(s, "leftHip"), world(s, "leftKnee"), world(s, "leftAnkle"))).toBeCloseTo(115, 4);
      expect(jointAngle(world(s, "rightShoulder"), world(s, "rightElbow"), world(s, "rightWrist"))).toBeCloseTo(80, 4);
    }
  });

  it("pose la cheville la plus basse sur le sol de l'image quand on le demande", () => {
    const s = skeletonPose({ groundY: 0.9, visibility: { nose: 0.2 } });
    expect(Math.max(s.xy[LM.leftAnkle * 2 + 1], s.xy[LM.rightAnkle * 2 + 1])).toBeCloseTo(0.9, 5);
    expect(s.vis[LM.nose]).toBeCloseTo(0.2);
    expect(s.vis[LM.leftKnee]).toBeCloseTo(0.95);
  });
});

describe("angles retrouvés à ±2° (critère d'acceptation)", () => {
  it.each([95, 120, 150, 175])("genou à %i°", (knee) => {
    const result = metric([still({ knee, hipFlexion: 30 })], "knee_flexion")!;
    expect(Math.abs(result.value - knee)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.details.left! - knee)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.details.right! - knee)).toBeLessThanOrEqual(2);
  });

  it("hanche : épaule-hanche-genou = 180 − inclinaison du tronc − flexion de cuisse", () => {
    const result = metric([still({ trunkLean: 15, hipFlexion: 40, knee: 140 })], "hip_flexion")!;
    expect(Math.abs(result.value - (180 - 15 - 40))).toBeLessThanOrEqual(2);
  });

  it.each([0, 45, 90])("inclinaison du tronc à 25°, athlète orienté à %i°", (facing) => {
    const result = metric([still({ trunkLean: 25, facing })], "trunk_lean")!;
    expect(Math.abs(result.value - 25)).toBeLessThanOrEqual(2);
  });

  it("rotation du tronc à 30° (lue sur les frappes, module boxe)", () => {
    const result = metric([still({ trunkRotation: 30, facing: 20 })], "trunk_rotation", "boxing")!;
    expect(Math.abs(result.value - 30)).toBeLessThanOrEqual(2);
  });

  it("écartement des pieds en largeurs d'épaules", () => {
    const result = metric([still({ stanceWidth: 0.57, facing: 30 })], "stance_width")!;
    expect(result.value).toBeCloseTo(0.57 / 0.38, 1);
  });

  it("amplitude du genou sur des flexions répétées (squats de 170° à 90°)", () => {
    const angleAt = (t: number) => 130 + 40 * Math.cos(Math.PI * t);
    const squats = clip(60, (t) => skeletonPose({ knee: angleAt(t), hipFlexion: 30 }));
    // Vérité terrain : la même plage (5e-95e centile) calculée sur les angles imposés.
    const truth = Array.from({ length: 600 }, (_, i) => angleAt(i / RATE));
    const expected = quantile(truth, 0.95) - quantile(truth, 0.05);
    const result = metric([squats], "knee_range")!;
    expect(Math.abs(result.value - expected)).toBeLessThanOrEqual(2);
  });
});

describe("garde et équilibre", () => {
  it("une garde haute donne une valeur plus haute qu'une garde basse", () => {
    const high = metric([still({ elbow: 40, shoulderFlexion: 60 })], "guard_height")!;
    const low = metric([still({ elbow: 170, shoulderFlexion: 5 })], "guard_height")!;
    expect(high.value).toBeGreaterThan(0);
    expect(low.value).toBeLessThan(-0.8);
  });

  it("le centre de masse s'éloigne des appuis quand le tronc penche", () => {
    const upright = metric([still({ trunkLean: 0, hipFlexion: 0, knee: 180 })], "balance_offset")!;
    const leaning = metric([still({ trunkLean: 40 })], "balance_offset")!;
    expect(upright.value).toBeLessThan(0.08);
    expect(leaning.value).toBeGreaterThan(upright.value + 0.1);
  });
});

describe("vitesses et physique", () => {
  // Membres oscillant de ±10 cm à 1 Hz, échantillonnés aux extrêmes :
  // vitesse moyenne = 4 × amplitude × fréquence = 0,4 m/s.
  const oscillation = (amplitude: (t: number) => number, seconds = 60) =>
    clip(seconds, (t) => shiftLimbs(skeletonPose({}), amplitude(t) * Math.cos(2 * Math.PI * t)));

  it("intensité : vitesse moyenne des membres en m/s", () => {
    const result = metric([oscillation(() => 0.1)], "intensity")!;
    expect(result.value).toBeCloseTo(0.4, 2);
    expect(metric([oscillation(() => 0.1)], "explosiveness")!.value).toBeGreaterThanOrEqual(result.value);
  });

  it("variabilité du rythme : faible si régulier, forte si alternance effort/repos", () => {
    const steady = metric([oscillation(() => 0.1)], "rhythm_variability")!;
    const bursts = metric([oscillation((t) => (Math.floor(t / 5) % 2 === 0 ? 0.15 : 0.01))], "rhythm_variability")!;
    expect(steady.value).toBeLessThan(5);
    expect(bursts.value).toBeGreaterThan(50);
  });

  it("baisse d'intensité (indicateur de fatigue) : amplitude divisée par 2 en 90 s", () => {
    // Moyenne du 1er tiers : 0,917 A ; du dernier : 0,583 A → baisse ≈ 36 %.
    const tired = oscillation((t) => 0.1 * (1 - (0.5 * t) / 90), 90);
    const result = metric([tired], "intensity_drop")!;
    expect(Math.abs(result.value - 36.4)).toBeLessThanOrEqual(3);
    expect(result.details.flag).toBe("watch");
    expect(metric([oscillation(() => 0.1, 90)], "intensity_drop")!.details.flag).toBeUndefined();
  });

  it("garde qui descend au fil de la séance", () => {
    const sagging = clip(90, (t) => skeletonPose({ elbow: 60 + t, shoulderFlexion: 30 - t / 6 }));
    expect(metric([sagging], "guard_drop_over_time")!.value).toBeGreaterThan(0.2);
  });

  it("ignore une vitesse impossible (échange d'identité) et ne calcule rien à travers deux séquences", () => {
    const calm = clip(20, (t) => shiftLimbs(skeletonPose({}), 0.05 * Math.cos(2 * Math.PI * t)));
    const glitch = clip(20, (t, i) => shiftLimbs(skeletonPose({}), (i === 100 ? 3 : 0.05) * Math.cos(2 * Math.PI * t)));
    const reference = metric([calm], "intensity")!.value;
    expect(metric([glitch], "intensity")!.value).toBeLessThan(reference * 1.25);
    // Deux séquences avec un saut de 2 m entre elles : pas de vitesse parasite.
    const jumped = clip(20, (t) => shiftLimbs(skeletonPose({}), 2 + 0.05 * Math.cos(2 * Math.PI * t)));
    expect(metric([calm, jumped], "intensity")!.value).toBeCloseTo(reference, 2);
  });
});

describe("prévention des blessures", () => {
  it("valgus : nul sans rotation, détecté genou rentré, négatif genou vers l'extérieur", () => {
    const neutral = metric([still({ knee: 120, hipFlexion: 40 })], "knee_valgus")!;
    const inward = metric([still({ knee: 120, hipFlexion: 40, valgus: { left: 15, right: 0 } })], "knee_valgus")!;
    const outward = metric([still({ knee: 120, hipFlexion: 40, valgus: -15 })], "knee_valgus")!;
    expect(Math.abs(neutral.value)).toBeLessThan(0.02);
    expect(inward.value).toBeGreaterThan(0.08);
    expect(inward.details.left!).toBeGreaterThan(inward.details.right!);
    expect(inward.details.flag).toBe("watch");
    expect(outward.value).toBeLessThan(0);
    expect(outward.details.flag).toBeUndefined();
  });

  it("valgus : valeur exacte = distance du genou à l'axe hanche-cheville × sin(angle) / longueur de jambe", () => {
    // Jambe dans un plan sagittal (pieds à l'aplomb des hanches) : le genou se
    // déplace alors exactement vers l'intérieur quand il tourne.
    const base = skeletonPose({ knee: 120, hipFlexion: 40, stanceWidth: 0.24 });
    const hip = world(base, "leftHip");
    const knee = world(base, "leftKnee");
    const ankle = world(base, "leftAnkle");
    const axis = { x: ankle.x - hip.x, y: ankle.y - hip.y, z: ankle.z - hip.z };
    const legLength = Math.hypot(axis.x, axis.y, axis.z);
    const rel = { x: knee.x - hip.x, y: knee.y - hip.y, z: knee.z - hip.z };
    const along = (rel.x * axis.x + rel.y * axis.y + rel.z * axis.z) / legLength;
    const radius = Math.sqrt(rel.x ** 2 + rel.y ** 2 + rel.z ** 2 - along ** 2);
    const expected = (radius * Math.sin((12 * Math.PI) / 180)) / legLength;
    const measured = medialKneeDeviation(
      skeletonPose({ knee: 120, hipFlexion: 40, stanceWidth: 0.24, valgus: 12 }),
      "left",
    )!;
    expect(measured).toBeCloseTo(expected, 3);
  });

  it("valgus non mesuré jambe tendue", () => {
    expect(metric([still({ knee: 178, hipFlexion: 2 })], "knee_valgus")).toBeUndefined();
  });

  it("flexion du tronc : seuil plus tolérant en lutte qu'en boxe", () => {
    const shots = [still({ trunkLean: 62, hipFlexion: 45, knee: 120 })];
    expect(metric(shots, "trunk_flexion", "boxing")!.details.flag).toBe("watch");
    expect(metric(shots, "trunk_flexion", "wrestling")!.details.flag).toBeUndefined();
  });

  it("coude verrouillé sur les frappes rapides", () => {
    // Direct du bras gauche chaque seconde : de la garde au bras tendu en 0,1 s.
    const punches = (extendedElbow: number) =>
      clip(60, (t) => {
        const striking = t % 1 >= 0.3 && t % 1 < 0.5;
        return skeletonPose({
          elbow: { left: striking ? extendedElbow : 60, right: 60 },
          shoulderFlexion: { left: striking ? 90 : 30, right: 30 },
        });
      });
    const locked = metric([punches(178)], "elbow_lockout")!;
    const bent = metric([punches(150)], "elbow_lockout")!;
    expect(locked.value).toBeGreaterThan(bent.value);
    expect(bent.value).toBeLessThan(10);
  });

  it("asymétrie : gauche et droite d'amplitudes différentes", () => {
    const uneven = clip(60, (t) =>
      skeletonPose({ knee: { left: 130 + 40 * Math.cos(Math.PI * t), right: 150 + 10 * Math.cos(Math.PI * t) }, hipFlexion: 30 }),
    );
    const even = clip(60, (t) => skeletonPose({ knee: 130 + 40 * Math.cos(Math.PI * t), hipFlexion: 30 }));
    expect(metric([uneven], "asymmetry")!.value).toBeGreaterThan(metric([even], "asymmetry")!.value + 10);
  });
});

describe("modules par discipline", () => {
  it("lutte : niveau de garde et changements de niveau par minute", () => {
    // 6 descentes de niveau en 60 s (genoux à 100° pendant 2 s toutes les 10 s).
    const shots = clip(60, (t) => {
      const low = t % 10 < 2;
      return skeletonPose({ knee: low ? 100 : 165, hipFlexion: low ? 55 : 10, trunkLean: low ? 35 : 10 });
    });
    const analysis = analyzeAthlete([shots], "wrestling");
    const changes = analysis.metrics.find((m) => m.key === "level_changes")!;
    expect(changes.details.events).toBe(6);
    expect(changes.value).toBeCloseTo(6, 0);
    expect(analysis.metrics.find((m) => m.key === "stance_level")!.value).toBeGreaterThan(0.8);
  });

  it("boxe : frappes par minute, chutes de garde et temps de récupération", () => {
    // 12 frappes (poignet projeté à > 3 m/s) et 4 gardes baissées environ 3 s en 60 s.
    // La garde descend et remonte en 0,5 s : trop lent pour passer pour une frappe.
    const lowered = (t: number) => {
      const c = t % 15;
      if (c < 10 || c >= 13.5) return 0;
      if (c < 10.5) return (c - 10) / 0.5;
      if (c >= 13) return (13.5 - c) / 0.5;
      return 1;
    };
    const rounds = clip(60, (t, i) => {
      const k = lowered(t);
      const sample = skeletonPose({ elbow: 60 + 110 * k, shoulderFlexion: 30 - 25 * k });
      return i % 50 === 25 ? shiftLimbs(sample, 0.45, ["leftWrist"]) : sample;
    });
    const analysis = analyzeAthlete([rounds], "boxing");
    const get = (key: MetricKey) => analysis.metrics.find((m) => m.key === key)!;
    expect(get("strike_rate").details.events).toBe(12);
    expect(get("guard_drops").details.events).toBe(4);
    expect(get("guard_recovery").value).toBeCloseTo(3, 0);
  });

  it("JJB : part du temps au sol et avertissement sur la fiabilité", () => {
    const groundWork = clip(40, (t) =>
      t < 20 ? skeletonPose({}) : skeletonPose({ trunkLean: 85, hipFlexion: 90, knee: 90 }),
    );
    const analysis = analyzeAthlete([groundWork], "bjj");
    expect(analysis.metrics.find((m) => m.key === "ground_share")!.value).toBeCloseTo(50, 0);
    expect(analysis.notes).toContain("bjj_limited");
    expect(analysis.notes).toContain("ground_heavy");
    // Les métriques « debout » ne sont calculées que sur la partie debout.
    expect(analysis.metrics.find((m) => m.key === "trunk_lean")!.details.usedFrames).toBe(200);
  });

  it("chaque module ne référence que des métriques existantes, et « autre » reste générique", () => {
    for (const discipline of DISCIPLINES) {
      for (const key of metricsFor(discipline)) expect(METRIC_KEYS).toContain(key);
      expect(thresholdsFor(discipline).kneeValgus).toBeGreaterThan(0);
    }
    expect(DISCIPLINE_MODULES.other.extra).toEqual([]);
    const other = analyzeAthlete([still({})], "other");
    expect(other.metrics.some((m) => m.category === "discipline")).toBe(false);
  });
});

describe("fiabilité", () => {
  it("chaque métrique a une fiabilité entre 0 et 1", () => {
    const analysis = analyzeAthlete([still({ knee: 130, hipFlexion: 35 }, 60)], "mma");
    expect(analysis.metrics.length).toBeGreaterThan(10);
    for (const m of analysis.metrics) {
      expect(m.confidence).toBeGreaterThanOrEqual(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("ignore les images peu fiables, et la fiabilité baisse en conséquence", () => {
    const random = seededRandom(3);
    const clean = clip(30, () => withNoise(skeletonPose({ knee: 120, hipFlexion: 30 }), 0.004, random));
    // Une image sur deux : points presque invisibles ET angle faux (40°).
    const mixed = clip(30, (_t, i) =>
      i % 2 === 0
        ? withNoise(skeletonPose({ knee: 120, hipFlexion: 30 }), 0.004, random)
        : skeletonPose({ knee: 40, hipFlexion: 30, visibility: 0.2 }),
    );
    const good = metric([clean], "knee_flexion")!;
    const half = metric([mixed], "knee_flexion")!;
    expect(Math.abs(half.value - 120)).toBeLessThanOrEqual(2);
    expect(half.details.usedFrames).toBe(150);
    expect(half.details.presentFrames).toBe(300);
    expect(half.confidence).toBeLessThan(good.confidence);
  });

  it("une métrique n'utilise pas un point masqué, même si le reste de l'image est bon", () => {
    const hiddenKnees = still({ knee: 120, visibility: { leftKnee: 0.1, rightKnee: 0.1 } });
    const analysis = analyzeAthlete([hiddenKnees], "other");
    expect(analysis.missing).toContain("knee_flexion");
    expect(analysis.metrics.find((m) => m.key === "trunk_lean")).toBeDefined();
  });

  it("peu d'images, faible visibilité ou profondeur estimée : fiabilité réduite", () => {
    const full = computeConfidence({ used: 100, present: 100, quality: 0.9 });
    expect(full).toBeCloseTo(0.9);
    expect(computeConfidence({ used: 10, present: 100, quality: 0.9 })).toBeLessThan(full / 2);
    expect(computeConfidence({ used: 100, present: 100, quality: 0.9, depth: true })).toBe(0.77);
    expect(computeConfidence({ used: 100, present: 200, quality: 0.9 })).toBe(0.68); // 0,9 × 0,75
    expect(computeConfidence({ used: 0, present: 100, quality: 0.9 })).toBe(0);
    expect(DEPTH_METRICS).toContain("knee_valgus");
  });

  it("pas d'alerte d'asymétrie sur quelques secondes de mouvement", () => {
    const short = clip(6, (t) =>
      skeletonPose({ knee: { left: 130 + 40 * Math.cos(Math.PI * t), right: 165 }, hipFlexion: 30 }),
    );
    const result = metric([short], "asymmetry")!;
    expect(result.value).toBeGreaterThan(25);
    expect(result.confidence).toBeLessThan(0.4);
    expect(result.details.flag).toBeUndefined();
  });

  it("pas d'alerte sur une mesure peu fiable", () => {
    const fewFrames = still({ knee: 120, hipFlexion: 40, valgus: 20 }, 1.5);
    const result = metric([fewFrames], "knee_valgus")!;
    expect(result.value).toBeGreaterThan(0.08);
    expect(result.details.flag).toBeUndefined();
  });

  it("aucune donnée : aucune métrique, présence signalée trop courte", () => {
    const analysis = analyzeAthlete([clip(5, () => null)], "wrestling");
    expect(analysis.metrics).toEqual([]);
    expect(analysis.missing.length).toBe(metricsFor("wrestling").length);
    expect(analysis.notes).toContain("short_presence");
    expect(analysis.summary.usableFrames).toBe(0);
  });

  it("donne des résultats identiques à chaque exécution (déterministe)", () => {
    const input = [still({ knee: 125 }, 30, 0.004, 9)];
    expect(analyzeAthlete(input, "mma")).toEqual(analyzeAthlete(input, "mma"));
  });
});

describe("extraction image par image", () => {
  it("met les séquences bout à bout dans le temps et compte les images présentes", () => {
    const { frames, presentFrames } = extractFeatures([
      clip(2, (_t, i) => (i % 4 === 0 ? null : skeletonPose({}))),
      clip(1, () => skeletonPose({})),
    ]);
    expect(presentFrames).toBe(15 + 10);
    expect(frames.at(-1)!.t).toBeCloseTo(2.9);
    expect(frames.at(-1)!.clip).toBe(1);
  });

  it("détecte le travail au sol", () => {
    expect(staticFeatures(skeletonPose({}), 0, 0).standing).toBe(true);
    expect(staticFeatures(skeletonPose({ trunkLean: 85, hipFlexion: 90, knee: 90 }), 0, 0).standing).toBe(false);
    // Entrée de jambes en lutte : tronc penché, hanches à mi-hauteur → toujours « debout ».
    expect(staticFeatures(skeletonPose({ trunkLean: 60, hipFlexion: 50, knee: 110 }), 0, 0).standing).toBe(true);
  });

  it("utilise les seuils d'événements du prototype", () => {
    expect(EVENT_THRESHOLDS.strikeReset).toBe(0.65);
    expect(EVENT_THRESHOLDS.guardDropDistance).toBeGreaterThan(EVENT_THRESHOLDS.guardReturnDistance);
  });
});

describe("affichage", () => {
  it("formate chaque unité en français, toujours précédé de ≈", async () => {
    const { formatMetric, formatValue, confidenceLevel } = await import("./format");
    expect(formatMetric("knee_flexion", "deg", 128.4)).toBe("≈ 128°");
    expect(formatMetric("stance_width", "shoulders", 1.46)).toBe("≈ 1,5 × largeur d'épaules");
    expect(formatValue("guard_height", "torso", 0.12)).toBe("+0,12 longueur de tronc");
    expect(formatValue("guard_height", "torso", -0.3)).toBe("-0,3 longueur de tronc");
    expect(formatValue("knee_valgus", "leg", 0.063)).toBe("6,3 % de la jambe");
    expect(formatValue("stance_level", "leg", 0.85)).toBe("0,85 × longueur de jambe");
    expect(formatValue("intensity", "m_s", 1.234)).toBe("1,23 m/s");
    expect(formatValue("asymmetry", "percent", 23.4)).toBe("23 %");
    expect(formatValue("strike_rate", "per_min", 12.34)).toBe("12,3 / min");
    expect(formatValue("guard_recovery", "s", 1.84)).toBe("1,8 s");
    expect([confidenceLevel(0.8), confidenceLevel(0.5), confidenceLevel(0.2)]).toEqual(["high", "medium", "low"]);
  });

  it("chaque métrique a un libellé et une explication en français", async () => {
    const { fr } = await import("@/lib/i18n/fr");
    for (const key of METRIC_KEYS) {
      expect(fr.metrics.items[key].label.length).toBeGreaterThan(3);
      expect(fr.metrics.items[key].description.length).toBeGreaterThan(20);
    }
  });
});
