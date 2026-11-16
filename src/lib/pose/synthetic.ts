// Poses synthétiques : un bonhomme bâton paramétrable.
// Sert aux tests du tracker, de l'enregistreur et du codec, et servira de base
// au jeu de données de démonstration (phase 4 et 7).

import { K, LM, type LandmarkName, type PoseSample } from "./landmarks";

/** Générateur pseudo-aléatoire déterministe (mulberry32) : mêmes tests à chaque exécution. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Position de chaque point, en proportion de la taille du corps (x : droite, y : bas, origine aux hanches). */
const BODY: Record<LandmarkName, readonly [number, number]> = {
  nose: [0, -0.47],
  leftEar: [0.04, -0.46],
  rightEar: [-0.04, -0.46],
  leftShoulder: [0.1, -0.33],
  rightShoulder: [-0.1, -0.33],
  leftElbow: [0.13, -0.18],
  rightElbow: [-0.13, -0.18],
  leftWrist: [0.11, -0.3],
  rightWrist: [-0.11, -0.3],
  leftPinky: [0.11, -0.33],
  rightPinky: [-0.11, -0.33],
  leftIndex: [0.1, -0.34],
  rightIndex: [-0.1, -0.34],
  leftThumb: [0.09, -0.32],
  rightThumb: [-0.09, -0.32],
  leftHip: [0.06, 0],
  rightHip: [-0.06, 0],
  leftKnee: [0.08, 0.25],
  rightKnee: [-0.08, 0.25],
  leftAnkle: [0.09, 0.48],
  rightAnkle: [-0.09, 0.48],
  leftHeel: [0.08, 0.5],
  rightHeel: [-0.08, 0.5],
  leftFoot: [0.12, 0.51],
  rightFoot: [-0.12, 0.51],
};

export type SyntheticPoseOptions = {
  /** Centre des hanches dans l'image (0 à 1). */
  cx: number;
  cy: number;
  /** Taille du corps en proportion de la hauteur d'image. */
  height?: number;
  /** Largeur / hauteur de l'image. */
  aspect?: number;
  /** Temps en secondes : anime un léger balancement et un mouvement des bras. */
  t?: number;
  /** Bruit de détection (écart max, en proportion de l'image). */
  jitter?: number;
  random?: () => number;
  /** Visibilité de tous les points (0 à 1). */
  visibility?: number;
};

/** Construit une pose debout, en garde, vue de face. */
export function syntheticPose(options: SyntheticPoseOptions): PoseSample {
  const {
    cx,
    cy,
    height = 0.6,
    aspect = 16 / 9,
    t = 0,
    jitter = 0,
    random = Math.random,
    visibility = 0.95,
  } = options;

  const sample: PoseSample = {
    xy: new Float32Array(K * 2),
    vis: new Float32Array(K).fill(visibility),
    world: new Float32Array(K * 3),
  };

  const sway = 0.01 * Math.sin(t * 2.1); // balancement du buste
  const punch = 0.05 * Math.max(0, Math.sin(t * 3.3)); // bras qui s'avance

  for (const [name, [bx, by]] of Object.entries(BODY) as Array<
    [LandmarkName, readonly [number, number]]
  >) {
    const i = LM[name];
    const upperBody = by < 0 ? 1 : 0;
    const isLeftArm = name.startsWith("left") && by < -0.1 && by > -0.4;
    let x = bx + upperBody * sway + (isLeftArm ? punch : 0);
    let y = by - (isLeftArm ? punch * 0.3 : 0);
    if (jitter > 0) {
      x += (random() - 0.5) * 2 * jitter;
      y += (random() - 0.5) * 2 * jitter;
    }
    // x est divisé par le ratio : une même distance occupe moins de largeur normalisée.
    sample.xy[i * 2] = cx + (x * height) / aspect;
    sample.xy[i * 2 + 1] = cy + y * height;
    // Monde : mètres, pour un corps de 1,75 m ; profondeur nulle (vue de face).
    sample.world[i * 3] = x * 1.75;
    sample.world[i * 3 + 1] = y * 1.75;
    sample.world[i * 3 + 2] = 0;
  }
  return sample;
}
