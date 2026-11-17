// Étape 2 : des valeurs image par image aux métriques de l'athlète.
//
// Chaque métrique = une agrégation (médiane, centile, plage, fréquence…) d'une
// valeur élémentaire, accompagnée d'une FIABILITÉ entre 0 et 1 :
//
//   fiabilité = qualité des points × assez d'images × (0,5 + 0,5 × part des images exploitables)
//               (× 0,85 si la métrique dépend de la profondeur estimée)
//
// Tout est déterministe : mêmes données en entrée → mêmes métriques en sortie.
// Aucun modèle de langage n'intervient ici.

import type { Discipline } from "@/lib/roster/domain";
import { metricsFor, thresholdsFor, DISCIPLINE_MODULES } from "./disciplines";
import { extractFeatures, type FeatureKey, type FrameFeatures } from "./features";
import { coefficientOfVariation, mean, median, quantile } from "./geometry";
import {
  METRIC_KEYS,
  type AnalysisNote,
  type AthleteAnalysis,
  type ClipSeries,
  type MetricCategory,
  type MetricDetails,
  type MetricKey,
  type MetricResult,
  type MetricUnit,
  type Thresholds,
} from "./types";

/** Pénalité de fiabilité pour les métriques qui reposent sur la profondeur estimée. */
export const DEPTH_PENALTY = 0.85;
/** Nombre d'images (à 10 Hz) en dessous duquel la fiabilité est réduite : 5 secondes. */
const DEFAULT_MIN_FRAMES = 50;
/**
 * Amplitudes, asymétrie, pics : il faut voir l'athlète bouger assez longtemps
 * pour que ces valeurs veuillent dire quelque chose (30 s, 15 s pour les pics).
 */
const MOVEMENT_MIN_FRAMES = 300;
const PEAK_MIN_FRAMES = 150;

/** Événements : seuils repris et adaptés du prototype Python. */
export const EVENT_THRESHOLDS = {
  /** Vitesse du poignet (m/s, par rapport aux hanches) qui compte comme une frappe. */
  strikeSpeed: 3,
  /** Hystérésis : la frappe est terminée quand la vitesse redescend sous 65 % du seuil. */
  strikeReset: 0.65,
  /** Mains à plus de 1,3 largeur d'épaules du visage : garde baissée. */
  guardDropDistance: 1.3,
  /** Garde reprise sous 1,1 largeur d'épaules. */
  guardReturnDistance: 1.1,
  /**
   * Durée minimale (s) d'une garde baissée. Sans ce seuil, chaque frappe
   * (la main quitte le visage une fraction de seconde) compterait comme une
   * chute de garde, défaut présent dans le prototype.
   */
  guardDropMinDuration: 0.5,
  /** Hanches plus basses que d'habitude de 15 % de la jambe : changement de niveau. */
  levelDrop: 0.15,
  levelReturn: 0.07,
  /** Coude au-delà de 172° sur une frappe rapide : coude verrouillé. */
  elbowLocked: 172,
} as const;

export function computeConfidence(options: {
  used: number;
  present: number;
  quality: number;
  minFrames?: number;
  depth?: boolean;
}): number {
  const { used, present, quality } = options;
  if (used <= 0 || present <= 0) return 0;
  const enoughFrames = Math.min(1, used / (options.minFrames ?? DEFAULT_MIN_FRAMES));
  // Calculée sur la moitié des images seulement : fiabilité × 0,75.
  const coverage = 0.5 + 0.5 * Math.min(1, used / present);
  const value = quality * enoughFrames * coverage * (options.depth ? DEPTH_PENALTY : 1);
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

// --- Petits outils d'agrégation ----------------------------------------------

type Computed = {
  value: number;
  used: number;
  quality: number;
  details?: Partial<MetricDetails>;
};

type Context = {
  frames: FrameFeatures[];
  standing: FrameFeatures[];
  thresholds: Thresholds;
};

/** Valeurs d'une clé sur un ensemble d'images, avec leur qualité. */
function collect(frames: readonly FrameFeatures[], key: FeatureKey) {
  const values: number[] = [];
  const qualities: number[] = [];
  const times: number[] = [];
  const durations: number[] = [];
  for (const frame of frames) {
    const value = frame.values[key];
    if (value === undefined) continue;
    values.push(value);
    qualities.push(frame.q[key] ?? 0);
    times.push(frame.t);
    durations.push(frame.dt);
  }
  return { values, qualities, times, durations };
}

/** Moyenne des côtés gauche et droit disponibles, image par image. */
function bilateral(frames: readonly FrameFeatures[], left: FeatureKey, right: FeatureKey) {
  const values: number[] = [];
  const qualities: number[] = [];
  for (const frame of frames) {
    const l = frame.values[left];
    const r = frame.values[right];
    const sides = [l, r].filter((v): v is number => v !== undefined);
    if (sides.length === 0) continue;
    values.push(mean(sides));
    const q = [l !== undefined ? frame.q[left] : undefined, r !== undefined ? frame.q[right] : undefined];
    qualities.push(mean(q.filter((v): v is number => v !== undefined)));
  }
  return { values, qualities };
}

function aggregate(
  values: number[],
  qualities: number[],
  summarize: (values: number[]) => number = median,
): Computed | null {
  if (values.length === 0) return null;
  return {
    value: summarize(values),
    used: values.length,
    quality: mean(qualities),
    details: { p10: quantile(values, 0.1), p90: quantile(values, 0.9) },
  };
}

function bilateralMedian(frames: readonly FrameFeatures[], left: FeatureKey, right: FeatureKey) {
  const { values, qualities } = bilateral(frames, left, right);
  const result = aggregate(values, qualities);
  if (!result) return null;
  const l = collect(frames, left).values;
  const r = collect(frames, right).values;
  result.details = {
    ...result.details,
    ...(l.length > 0 && { left: median(l) }),
    ...(r.length > 0 && { right: median(r) }),
  };
  return result;
}

/** Amplitude d'un angle : 95e moins 5e centile (résiste aux valeurs aberrantes). */
const amplitude = (values: number[]) => quantile(values, 0.95) - quantile(values, 0.05);
const MIN_RANGE_FRAMES = 30;

function bilateralRange(frames: readonly FrameFeatures[], left: FeatureKey, right: FeatureKey) {
  const l = collect(frames, left);
  const r = collect(frames, right);
  const sides = [l, r].filter((side) => side.values.length >= MIN_RANGE_FRAMES);
  if (sides.length === 0) return null;
  const ranges = sides.map((side) => amplitude(side.values));
  return {
    value: mean(ranges),
    used: Math.max(...sides.map((side) => side.values.length)),
    quality: mean(sides.map((side) => mean(side.qualities))),
    details: {
      ...(l.values.length >= MIN_RANGE_FRAMES && { left: amplitude(l.values) }),
      ...(r.values.length >= MIN_RANGE_FRAMES && { right: amplitude(r.values) }),
    },
  } satisfies Computed;
}

/** Valeurs du premier et du dernier tiers de la séance (en temps). */
function thirds(times: number[], values: number[]) {
  const start = Math.min(...times);
  const span = Math.max(...times) - start;
  const first: number[] = [];
  const last: number[] = [];
  times.forEach((t, i) => {
    if (t <= start + span / 3) first.push(values[i]);
    else if (t >= start + (2 * span) / 3) last.push(values[i]);
  });
  return { first, last };
}

/** Secondes couvertes par une liste de durées d'image. */
const seconds = (durations: number[]) => durations.reduce((a, b) => a + b, 0);

/**
 * Compte les passages au-dessus d'un seuil, avec hystérésis (il faut redescendre
 * sous `isOff` avant de compter un nouvel événement). Avec `minDuration`, un
 * événement ne compte que s'il dure au moins ce temps. Les séquences sont
 * traitées séparément : un événement ne s'étend jamais d'une séquence à l'autre.
 */
function countEvents(
  frames: readonly FrameFeatures[],
  key: FeatureKey,
  isOn: (value: number) => boolean,
  isOff: (value: number) => boolean,
  minDuration = 0,
) {
  let events = 0;
  let active = false;
  let confirmed = false;
  let activeSince = 0;
  let clip = -1;
  const durations: number[] = [];
  for (const frame of frames) {
    const value = frame.values[key];
    if (value === undefined) continue;
    if (frame.clip !== clip) {
      clip = frame.clip;
      active = false;
    }
    if (!active && isOn(value)) {
      active = true;
      confirmed = false;
      activeSince = frame.t;
    } else if (active && isOff(value)) {
      active = false;
      if (confirmed) durations.push(frame.t - activeSince);
    }
    if (active && !confirmed && frame.t - activeSince >= minDuration) {
      confirmed = true;
      events++;
    }
  }
  return { events, durations };
}

// --- Définition des métriques ------------------------------------------------

type Spec = {
  category: MetricCategory;
  unit: MetricUnit;
  minFrames?: number;
  depth?: boolean;
  compute: (ctx: Context) => Computed | null;
  /** Signal « à surveiller » au-delà de ce seuil. */
  threshold?: (thresholds: Thresholds) => number;
};

const SPECS: Record<MetricKey, Spec> = {
  // ----- Technique -----
  stance_width: {
    category: "technique",
    unit: "shoulders",
    depth: true,
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "stanceWidth");
      return aggregate(values, qualities);
    },
  },
  guard_height: {
    category: "technique",
    unit: "torso",
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "guardHeight");
      return aggregate(values, qualities);
    },
  },
  knee_flexion: {
    category: "technique",
    unit: "deg",
    compute: ({ standing }) => bilateralMedian(standing, "kneeL", "kneeR"),
  },
  hip_flexion: {
    category: "technique",
    unit: "deg",
    compute: ({ standing }) => bilateralMedian(standing, "hipL", "hipR"),
  },
  trunk_lean: {
    category: "technique",
    unit: "deg",
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "trunkLean");
      return aggregate(values, qualities);
    },
  },
  balance_offset: {
    category: "technique",
    unit: "torso",
    depth: true,
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "comOffset");
      return aggregate(values, qualities);
    },
  },

  // ----- Physique -----
  intensity: {
    category: "physical",
    unit: "m_s",
    compute: ({ frames }) => {
      const { values, qualities } = collect(frames, "limbSpeed");
      return aggregate(values, qualities, mean);
    },
  },
  explosiveness: {
    category: "physical",
    unit: "m_s",
    minFrames: PEAK_MIN_FRAMES,
    compute: ({ frames }) => {
      const values: number[] = [];
      const qualities: number[] = [];
      for (const frame of frames) {
        const peaks = (["wristSpeed", "ankleSpeed"] as const).filter((k) => frame.values[k] !== undefined);
        if (peaks.length === 0) continue;
        values.push(Math.max(...peaks.map((k) => frame.values[k]!)));
        qualities.push(mean(peaks.map((k) => frame.q[k] ?? 0)));
      }
      return aggregate(values, qualities, (v) => quantile(v, 0.95));
    },
  },
  rhythm_variability: {
    category: "physical",
    unit: "percent",
    minFrames: 300,
    compute: ({ frames }) => {
      const { values, qualities, times } = collect(frames, "limbSpeed");
      // Intensité moyenne seconde par seconde, puis variabilité entre secondes.
      const windows = new Map<number, number[]>();
      times.forEach((t, i) => {
        const second = Math.floor(t);
        windows.set(second, [...(windows.get(second) ?? []), values[i]]);
      });
      const perSecond = [...windows.values()].filter((w) => w.length >= 5).map(mean);
      if (perSecond.length < 6) return null;
      return { value: coefficientOfVariation(perSecond) * 100, used: values.length, quality: mean(qualities) };
    },
  },
  intensity_drop: {
    category: "physical",
    unit: "percent",
    minFrames: 600,
    threshold: (t) => t.intensityDrop,
    compute: ({ frames }) => {
      const { values, qualities, times } = collect(frames, "limbSpeed");
      if (values.length < 60) return null;
      const { first, last } = thirds(times, values);
      if (first.length < 20 || last.length < 20 || !(mean(first) > 0)) return null;
      return {
        value: ((mean(first) - mean(last)) / mean(first)) * 100,
        used: values.length,
        quality: mean(qualities),
        details: { left: mean(first), right: mean(last) },
      };
    },
  },
  guard_drop_over_time: {
    category: "physical",
    unit: "torso",
    minFrames: 600,
    compute: ({ standing }) => {
      const { values, qualities, times } = collect(standing, "guardHeight");
      if (values.length < 60) return null;
      const { first, last } = thirds(times, values);
      if (first.length < 20 || last.length < 20) return null;
      return {
        value: median(first) - median(last),
        used: values.length,
        quality: mean(qualities),
      };
    },
  },
  knee_range: {
    category: "physical",
    unit: "deg",
    minFrames: MOVEMENT_MIN_FRAMES,
    compute: ({ frames }) => bilateralRange(frames, "kneeL", "kneeR"),
  },
  hip_range: {
    category: "physical",
    unit: "deg",
    minFrames: MOVEMENT_MIN_FRAMES,
    compute: ({ frames }) => bilateralRange(frames, "hipL", "hipR"),
  },
  shoulder_range: {
    category: "physical",
    unit: "deg",
    minFrames: MOVEMENT_MIN_FRAMES,
    compute: ({ frames }) => bilateralRange(frames, "shoulderL", "shoulderR"),
  },

  // ----- Prévention -----
  knee_valgus: {
    category: "injury_prevention",
    unit: "leg",
    minFrames: 30,
    depth: true,
    threshold: (t) => t.kneeValgus,
    compute: ({ standing }) => {
      // Mesuré seulement genou fléchi (sous 160°) : jambe tendue, le valgus n'a pas de sens.
      const sides = (["L", "R"] as const).map((s) => {
        const values: number[] = [];
        const qualities: number[] = [];
        for (const frame of standing) {
          const knee = frame.values[`knee${s}`];
          const valgus = frame.values[`valgus${s}`];
          if (knee === undefined || valgus === undefined || knee >= 160) continue;
          values.push(valgus);
          qualities.push(frame.q[`valgus${s}`] ?? 0);
        }
        return { values, qualities };
      });
      const usable = sides.filter((side) => side.values.length > 0);
      if (usable.length === 0) return null;
      const p90 = sides.map((side) => (side.values.length > 0 ? quantile(side.values, 0.9) : undefined));
      return {
        value: Math.max(...p90.filter((v): v is number => v !== undefined)),
        used: Math.max(...usable.map((side) => side.values.length)),
        quality: mean(usable.flatMap((side) => side.qualities)),
        details: {
          ...(p90[0] !== undefined && { left: p90[0] }),
          ...(p90[1] !== undefined && { right: p90[1] }),
        },
      };
    },
  },
  trunk_flexion: {
    category: "injury_prevention",
    unit: "deg",
    threshold: (t) => t.trunkFlexion,
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "trunkLean");
      return aggregate(values, qualities, (v) => quantile(v, 0.9));
    },
  },
  elbow_lockout: {
    category: "injury_prevention",
    unit: "percent",
    minFrames: 10,
    threshold: (t) => t.elbowLockout,
    compute: ({ frames }) => {
      const speeds = collect(frames, "wristSpeed").values;
      if (speeds.length === 0) return null;
      const fast = Math.max(EVENT_THRESHOLDS.strikeSpeed * 0.8, quantile(speeds, 0.9));
      let locked = 0;
      let used = 0;
      const qualities: number[] = [];
      for (const frame of frames) {
        const speed = frame.values.wristSpeed;
        const elbows = (["elbowL", "elbowR"] as const).filter((k) => frame.values[k] !== undefined);
        if (speed === undefined || speed < fast || elbows.length === 0) continue;
        used++;
        if (Math.max(...elbows.map((k) => frame.values[k]!)) >= EVENT_THRESHOLDS.elbowLocked) locked++;
        qualities.push(mean(elbows.map((k) => frame.q[k] ?? 0)));
      }
      if (used === 0) return null;
      return { value: (locked / used) * 100, used, quality: mean(qualities), details: { events: used } };
    },
  },
  asymmetry: {
    category: "injury_prevention",
    unit: "percent",
    minFrames: MOVEMENT_MIN_FRAMES,
    threshold: (t) => t.asymmetry,
    compute: ({ frames }) => {
      const pairs: Array<[FeatureKey, FeatureKey]> = [
        ["kneeL", "kneeR"],
        ["hipL", "hipR"],
        ["elbowL", "elbowR"],
        ["shoulderL", "shoulderR"],
      ];
      const gaps: number[] = [];
      const qualities: number[] = [];
      let used = 0;
      for (const [left, right] of pairs) {
        const l = collect(frames, left);
        const r = collect(frames, right);
        if (l.values.length < MIN_RANGE_FRAMES || r.values.length < MIN_RANGE_FRAMES) continue;
        const rl = amplitude(l.values);
        const rr = amplitude(r.values);
        // Plancher à 10° : deux petites amplitudes proches ne font pas une asymétrie.
        gaps.push(Math.abs(rl - rr) / Math.max(rl, rr, 10));
        qualities.push(mean([...l.qualities, ...r.qualities]));
        used = Math.max(used, Math.min(l.values.length, r.values.length));
      }
      if (gaps.length === 0) return null;
      return { value: mean(gaps) * 100, used, quality: mean(qualities) };
    },
  },

  // ----- Modules par discipline -----
  stance_level: {
    category: "discipline",
    unit: "leg",
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "hipHeight");
      return aggregate(values, qualities);
    },
  },
  level_changes: {
    category: "discipline",
    unit: "per_min",
    minFrames: 300,
    compute: ({ standing }) => {
      const { values, qualities, durations } = collect(standing, "hipHeight");
      if (values.length < 30) return null;
      const baseline = median(values);
      const { events } = countEvents(
        standing,
        "hipHeight",
        (v) => v < baseline - EVENT_THRESHOLDS.levelDrop,
        (v) => v > baseline - EVENT_THRESHOLDS.levelReturn,
      );
      const minutes = seconds(durations) / 60;
      return { value: events / minutes, used: values.length, quality: mean(qualities), details: { events } };
    },
  },
  guard_drops: {
    category: "discipline",
    unit: "per_min",
    minFrames: 300,
    compute: ({ standing }) => {
      const { values, qualities, durations } = collect(standing, "guardDistance");
      if (values.length < 30) return null;
      const { events } = countEvents(
        standing,
        "guardDistance",
        (v) => v > EVENT_THRESHOLDS.guardDropDistance,
        (v) => v <= EVENT_THRESHOLDS.guardReturnDistance,
        EVENT_THRESHOLDS.guardDropMinDuration,
      );
      return {
        value: events / (seconds(durations) / 60),
        used: values.length,
        quality: mean(qualities),
        details: { events },
      };
    },
  },
  guard_recovery: {
    category: "discipline",
    unit: "s",
    minFrames: 300,
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "guardDistance");
      const { durations } = countEvents(
        standing,
        "guardDistance",
        (v) => v > EVENT_THRESHOLDS.guardDropDistance,
        (v) => v <= EVENT_THRESHOLDS.guardReturnDistance,
        EVENT_THRESHOLDS.guardDropMinDuration,
      );
      if (durations.length < 2) return null;
      return {
        value: mean(durations),
        used: values.length,
        quality: mean(qualities),
        details: { events: durations.length },
      };
    },
  },
  strike_rate: {
    category: "discipline",
    unit: "per_min",
    minFrames: 300,
    compute: ({ frames }) => {
      const { values, qualities, durations } = collect(frames, "wristSpeed");
      if (values.length < 30) return null;
      const { events } = countEvents(
        frames,
        "wristSpeed",
        (v) => v >= EVENT_THRESHOLDS.strikeSpeed,
        (v) => v < EVENT_THRESHOLDS.strikeSpeed * EVENT_THRESHOLDS.strikeReset,
      );
      return {
        value: events / (seconds(durations) / 60),
        used: values.length,
        quality: mean(qualities),
        details: { events },
      };
    },
  },
  trunk_rotation: {
    category: "discipline",
    unit: "deg",
    depth: true,
    compute: ({ standing }) => {
      const { values, qualities } = collect(standing, "trunkRotation");
      return aggregate(values, qualities, (v) => quantile(v, 0.9));
    },
  },
  ground_share: {
    category: "discipline",
    unit: "percent",
    compute: ({ frames }) => {
      if (frames.length === 0) return null;
      const ground = frames.filter((frame) => !frame.standing).length;
      return {
        value: (ground / frames.length) * 100,
        used: frames.length,
        quality: mean(frames.map((frame) => frame.quality)),
      };
    },
  },
};

const round = (value: number) => Math.round(value * 10000) / 10000;

function roundDetails(details: Partial<MetricDetails>): Partial<MetricDetails> {
  return Object.fromEntries(
    Object.entries(details).map(([k, v]) => [k, typeof v === "number" ? round(v) : v]),
  );
}

/** Analyse complète d'un athlète pour une séance (une ou plusieurs séquences). */
export function analyzeAthlete(clips: readonly ClipSeries[], discipline: Discipline): AthleteAnalysis {
  const { frames, presentFrames } = extractFeatures(clips);
  const standing = frames.filter((frame) => frame.standing);
  const thresholds = thresholdsFor(discipline);
  const ctx: Context = { frames, standing, thresholds };

  const wanted = new Set(metricsFor(discipline));
  const metrics: MetricResult[] = [];
  const missing: MetricKey[] = [];

  for (const key of METRIC_KEYS) {
    if (!wanted.has(key)) continue;
    const spec = SPECS[key];
    const computed = spec.compute(ctx);
    if (!computed || !Number.isFinite(computed.value)) {
      missing.push(key);
      continue;
    }
    const confidence = computeConfidence({
      used: computed.used,
      present: presentFrames,
      quality: computed.quality,
      minFrames: spec.minFrames,
      depth: spec.depth,
    });
    const details: MetricDetails = {
      usedFrames: computed.used,
      presentFrames,
      quality: round(computed.quality),
      ...roundDetails(computed.details ?? {}),
    };
    if (spec.threshold) {
      const threshold = spec.threshold(thresholds);
      details.threshold = threshold;
      // Signal seulement si la mesure est assez fiable : on ne lance pas d'alerte sur du bruit.
      if (computed.value > threshold && confidence >= 0.5) details.flag = "watch";
    }
    metrics.push({
      key,
      category: spec.category,
      value: round(computed.value),
      unit: spec.unit,
      confidence,
      details,
    });
  }

  const usableSeconds = frames.reduce((sum, frame) => sum + frame.dt, 0);
  const groundShare = frames.length === 0 ? 0 : (frames.length - standing.length) / frames.length;
  const meanQuality = frames.length === 0 ? 0 : mean(frames.map((frame) => frame.quality));

  const notes: AnalysisNote[] = [];
  if (usableSeconds < 30) notes.push("short_presence");
  if (frames.length > 0 && meanQuality < 0.6) notes.push("low_quality");
  if (groundShare > 0.4) notes.push("ground_heavy");
  notes.push(...(DISCIPLINE_MODULES[discipline].notes ?? []));
  if (metrics.some((metric) => SPECS[metric.key].depth)) notes.push("depth_estimated");

  return {
    metrics,
    missing,
    notes,
    summary: {
      presentFrames,
      usableFrames: frames.length,
      usableSeconds: round(usableSeconds),
      groundShare: round(groundShare),
      meanQuality: round(meanQuality),
    },
  };
}

/** Métriques qui reposent sur la profondeur estimée (fiabilité réduite). */
export const DEPTH_METRICS = (Object.keys(SPECS) as MetricKey[]).filter((key) => SPECS[key].depth);
