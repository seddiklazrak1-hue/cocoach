// Étape 1 : pour chaque image, les valeurs élémentaires (angles, distances,
// vitesses), chacune avec la fiabilité des points qui ont servi à la calculer.
//
// Règle centrale : une valeur n'est calculée que si TOUS ses points sont
// suffisamment visibles. Sinon elle vaut `undefined` et l'image est ignorée
// pour cette métrique (mais peut servir aux autres).

import { LM, type LandmarkName, type PoseSample } from "@/lib/pose/landmarks";
import {
  add,
  angleBetween,
  distance,
  dot,
  jointAngle,
  meanVisibilityOf,
  mid,
  norm,
  normalize,
  projectOnPlane,
  scale,
  sub,
  UP,
  world,
} from "./geometry";

/** En dessous, un point est jugé trop incertain pour servir à un calcul. */
export const MIN_POINT_VISIBILITY = 0.5;
/** En dessous, l'image entière est jugée peu fiable et ignorée. */
export const MIN_FRAME_QUALITY = 0.4;
/** Au-delà, une vitesse est une erreur de suivi (échange d'identité, saut), pas un mouvement. */
export const MAX_PLAUSIBLE_SPEED = 12;

export const FEATURE_KEYS = [
  "kneeL",
  "kneeR",
  "hipL",
  "hipR",
  "elbowL",
  "elbowR",
  "shoulderL",
  "shoulderR",
  "trunkLean",
  "trunkRotation",
  "stanceWidth",
  "guardHeight",
  "guardDistance",
  "comOffset",
  "hipHeight",
  "valgusL",
  "valgusR",
  "limbSpeed",
  "wristSpeed",
  "ankleSpeed",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FrameFeatures = {
  /** Temps en secondes sur l'ensemble de la séance (séquences mises bout à bout). */
  t: number;
  /** Durée d'une image (1 / cadence), pour convertir un nombre d'images en secondes. */
  dt: number;
  clip: number;
  /** Athlète debout (faux = au sol, ou tronc quasi horizontal). */
  standing: boolean;
  /** Fiabilité moyenne de tous les points de l'image. */
  quality: number;
  values: Partial<Record<FeatureKey, number>>;
  /** Fiabilité des points ayant servi à chaque valeur. */
  q: Partial<Record<FeatureKey, number>>;
};

const LIMBS: readonly LandmarkName[] = [
  "leftWrist",
  "rightWrist",
  "leftElbow",
  "rightElbow",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
];

function visible(sample: PoseSample, names: readonly LandmarkName[]) {
  return names.every((name) => sample.vis[LM[name]] >= MIN_POINT_VISIBILITY);
}

/** Calcule une valeur si ses points sont visibles, et enregistre sa fiabilité. */
function put(
  out: FrameFeatures,
  key: FeatureKey,
  sample: PoseSample,
  names: readonly LandmarkName[],
  compute: () => number | null,
) {
  if (!visible(sample, names)) return;
  const value = compute();
  if (value === null || !Number.isFinite(value)) return;
  out.values[key] = value;
  out.q[key] = meanVisibilityOf(sample, names);
}

/** Écart du genou vers l'intérieur, rapporté à la longueur de jambe (positif = genou rentré). */
export function medialKneeDeviation(sample: PoseSample, side: "left" | "right"): number | null {
  const s = side === "left" ? 1 : -1;
  const hip = world(sample, `${side}Hip`);
  const knee = world(sample, `${side}Knee`);
  const ankle = world(sample, `${side}Ankle`);
  const lateral = normalize(sub(world(sample, "leftHip"), world(sample, "rightHip")));
  const legAxis = normalize(sub(ankle, hip));
  if (!lateral || !legAxis) return null;
  const rel = sub(knee, hip);
  const perpendicular = sub(rel, scale(legAxis, dot(rel, legAxis)));
  const legLength = distance(hip, ankle);
  // La gauche est +x : pour la jambe gauche, « vers l'intérieur » c'est vers -lateral.
  return (-s * dot(perpendicular, lateral)) / legLength;
}

/** Angle entre la ligne des épaules et celle des hanches, vue de dessus (degrés). */
export function trunkRotationAngle(sample: PoseSample): number | null {
  const shoulders = projectOnPlane(sub(world(sample, "leftShoulder"), world(sample, "rightShoulder")), UP);
  const hips = projectOnPlane(sub(world(sample, "leftHip"), world(sample, "rightHip")), UP);
  return angleBetween(shoulders, hips);
}

/** Valeurs statiques d'une image (sans les vitesses). */
export function staticFeatures(sample: PoseSample, t: number, clip: number, dt = 0.1): FrameFeatures {
  const out: FrameFeatures = { t, dt, clip, standing: true, quality: 0, values: {}, q: {} };
  let sum = 0;
  for (let i = 0; i < sample.vis.length; i++) sum += sample.vis[i];
  out.quality = sum / sample.vis.length;

  const w = (name: LandmarkName) => world(sample, name);
  const hipMid = () => mid(w("leftHip"), w("rightHip"));
  const shoulderMid = () => mid(w("leftShoulder"), w("rightShoulder"));
  const shoulderWidth = () => distance(w("leftShoulder"), w("rightShoulder"));
  const torso = () => distance(hipMid(), shoulderMid());

  for (const [side, suffix] of [
    ["left", "L"],
    ["right", "R"],
  ] as const) {
    put(out, `knee${suffix}`, sample, [`${side}Hip`, `${side}Knee`, `${side}Ankle`], () =>
      jointAngle(w(`${side}Hip`), w(`${side}Knee`), w(`${side}Ankle`)),
    );
    put(out, `hip${suffix}`, sample, [`${side}Shoulder`, `${side}Hip`, `${side}Knee`], () =>
      jointAngle(w(`${side}Shoulder`), w(`${side}Hip`), w(`${side}Knee`)),
    );
    put(out, `elbow${suffix}`, sample, [`${side}Shoulder`, `${side}Elbow`, `${side}Wrist`], () =>
      jointAngle(w(`${side}Shoulder`), w(`${side}Elbow`), w(`${side}Wrist`)),
    );
    put(out, `shoulder${suffix}`, sample, [`${side}Hip`, `${side}Shoulder`, `${side}Elbow`], () =>
      jointAngle(w(`${side}Hip`), w(`${side}Shoulder`), w(`${side}Elbow`)),
    );
    put(
      out,
      `valgus${suffix}`,
      sample,
      ["leftHip", "rightHip", `${side}Knee`, `${side}Ankle`],
      () => medialKneeDeviation(sample, side),
    );
  }

  const trunkPoints: LandmarkName[] = ["leftHip", "rightHip", "leftShoulder", "rightShoulder"];
  put(out, "trunkLean", sample, trunkPoints, () => angleBetween(sub(shoulderMid(), hipMid()), UP));
  put(out, "trunkRotation", sample, trunkPoints, () => trunkRotationAngle(sample));

  put(out, "stanceWidth", sample, ["leftAnkle", "rightAnkle", "leftShoulder", "rightShoulder"], () =>
    distance(w("leftAnkle"), w("rightAnkle")) / shoulderWidth(),
  );

  // Garde : hauteur des poignets par rapport aux épaules, en longueurs de tronc
  // (0 = à hauteur d'épaules, positif = plus haut).
  put(out, "guardHeight", sample, [...trunkPoints, "leftWrist", "rightWrist"], () => {
    const shoulderY = shoulderMid().y;
    const wristY = (w("leftWrist").y + w("rightWrist").y) / 2;
    return (shoulderY - wristY) / torso();
  });
  // Garde (idée du prototype) : distance moyenne des mains au visage, en largeurs d'épaules.
  // Valable en garde orthodoxe comme en garde inversée.
  put(out, "guardDistance", sample, ["nose", "leftWrist", "rightWrist", "leftShoulder", "rightShoulder"], () => {
    const nose = w("nose");
    return (distance(w("leftWrist"), nose) + distance(w("rightWrist"), nose)) / 2 / shoulderWidth();
  });

  // Équilibre : écart horizontal entre un centre de masse approché et le milieu des appuis.
  put(out, "comOffset", sample, [...trunkPoints, "leftAnkle", "rightAnkle"], () => {
    const com = add(scale(hipMid(), 0.6), scale(shoulderMid(), 0.4));
    const base = mid(w("leftAnkle"), w("rightAnkle"));
    return norm(projectOnPlane(sub(com, base), UP)) / torso();
  });

  // Hauteur des hanches au-dessus de la cheville la plus basse, en longueurs de jambe.
  const legPoints: LandmarkName[] = ["leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle"];
  put(out, "hipHeight", sample, legPoints, () => {
    const legLength =
      (distance(w("leftHip"), w("leftKnee")) +
        distance(w("leftKnee"), w("leftAnkle")) +
        distance(w("rightHip"), w("rightKnee")) +
        distance(w("rightKnee"), w("rightAnkle"))) /
      2;
    const lowestAnkle = Math.max(w("leftAnkle").y, w("rightAnkle").y);
    return (lowestAnkle - hipMid().y) / legLength;
  });

  // Au sol : hanches très proches du sol, ou tronc presque horizontal avec les
  // hanches basses. Une entrée de jambes en lutte (tronc penché, hanches à
  // mi-hauteur) reste comptée « debout ».
  const lean = out.values.trunkLean;
  const hipHeight = out.values.hipHeight;
  const onGround =
    (hipHeight !== undefined && hipHeight < 0.35) ||
    (lean !== undefined && lean > 75 && (hipHeight === undefined || hipHeight < 0.6));
  out.standing = !onGround;
  return out;
}

/** Vitesse (m/s) de chaque point entre deux images consécutives, ou `null` si non mesurable. */
function pointSpeed(a: PoseSample, b: PoseSample, name: LandmarkName, dt: number): number | null {
  if (!visible(a, [name]) || !visible(b, [name])) return null;
  const speed = distance(world(a, name), world(b, name)) / dt;
  return speed <= MAX_PLAUSIBLE_SPEED ? speed : null;
}

/** Ajoute les vitesses calculées entre l'image précédente et l'image courante. */
export function addSpeeds(out: FrameFeatures, previous: PoseSample, current: PoseSample, dt: number) {
  const speeds = new Map<LandmarkName, number>();
  for (const name of LIMBS) {
    const speed = pointSpeed(previous, current, name, dt);
    if (speed !== null) speeds.set(name, speed);
  }
  const quality = (names: readonly LandmarkName[]) =>
    (meanVisibilityOf(previous, names) + meanVisibilityOf(current, names)) / 2;

  // Au moins la moitié des membres doivent être mesurables pour une vitesse moyenne fiable.
  const measured = [...speeds.keys()];
  if (measured.length >= LIMBS.length / 2) {
    out.values.limbSpeed = [...speeds.values()].reduce((a, b) => a + b, 0) / measured.length;
    out.q.limbSpeed = quality(measured);
  }
  const pick = (names: readonly LandmarkName[], key: "wristSpeed" | "ankleSpeed") => {
    const values = names.map((name) => speeds.get(name)).filter((v): v is number => v !== undefined);
    if (values.length === 0) return;
    out.values[key] = Math.max(...values);
    out.q[key] = quality(names.filter((name) => speeds.has(name)));
  };
  pick(["leftWrist", "rightWrist"], "wristSpeed");
  pick(["leftAnkle", "rightAnkle"], "ankleSpeed");
}

/** Toutes les images utilisables d'un athlète, toutes séquences confondues. */
export function extractFeatures(
  clips: ReadonlyArray<{ frames: ReadonlyArray<PoseSample | null>; sampleRateHz: number }>,
): { frames: FrameFeatures[]; presentFrames: number } {
  const frames: FrameFeatures[] = [];
  let presentFrames = 0;
  let offset = 0;
  clips.forEach((clip, clipIndex) => {
    const dt = 1 / clip.sampleRateHz;
    let previous: PoseSample | null = null;
    clip.frames.forEach((sample, index) => {
      if (!sample) {
        previous = null; // pas de vitesse à travers un trou
        return;
      }
      presentFrames++;
      const features = staticFeatures(sample, offset + index * dt, clipIndex, dt);
      if (features.quality < MIN_FRAME_QUALITY) {
        previous = null;
        return; // image peu fiable : ignorée entièrement
      }
      if (previous) addSpeeds(features, previous, sample, dt);
      frames.push(features);
      previous = sample;
    });
    offset += clip.frames.length * dt;
  });
  return { frames, presentFrames };
}

