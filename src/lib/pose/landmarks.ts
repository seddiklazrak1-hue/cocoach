// Points articulaires conservés et format d'un échantillon de pose.
//
// MediaPipe renvoie 33 points par personne, dont 11 sur le visage (yeux,
// bouche…). On n'en garde que 25 : le nez et les oreilles suffisent pour situer
// la tête, et moins de points du visage = moins de données personnelles.

/** Noms des points conservés, dans l'ordre où ils sont stockés. */
export const LANDMARK_NAMES = [
  "nose",
  "leftEar",
  "rightEar",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftPinky",
  "rightPinky",
  "leftIndex",
  "rightIndex",
  "leftThumb",
  "rightThumb",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
  "leftHeel",
  "rightHeel",
  "leftFoot",
  "rightFoot",
] as const;

export type LandmarkName = (typeof LANDMARK_NAMES)[number];

/** Nombre de points par pose. */
export const K = LANDMARK_NAMES.length;

/** Indice d'un point dans nos tableaux, ex. `LM.leftKnee`. */
export const LM = Object.fromEntries(
  LANDMARK_NAMES.map((name, index) => [name, index]),
) as Record<LandmarkName, number>;

/** Pour chaque point conservé, son indice dans les 33 points de MediaPipe. */
export const MEDIAPIPE_INDICES = [
  0, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 31, 32,
] as const;

/** Segments à tracer pour dessiner le squelette. */
export const SKELETON: ReadonlyArray<readonly [LandmarkName, LandmarkName]> = [
  ["leftEar", "nose"],
  ["nose", "rightEar"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["leftWrist", "leftIndex"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["rightWrist", "rightIndex"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["leftAnkle", "leftHeel"],
  ["leftHeel", "leftFoot"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
  ["rightAnkle", "rightHeel"],
  ["rightHeel", "rightFoot"],
];

/**
 * Une pose à un instant donné.
 * - `xy`    : K × (x, y) dans l'image, normalisés entre 0 et 1 (origine en haut à gauche).
 * - `vis`   : K fiabilités entre 0 et 1 (probabilité que le point soit visible).
 * - `world` : K × (x, y, z) en mètres, origine au milieu des hanches. C'est une
 *             ESTIMATION 3D de MediaPipe, bruitée en profondeur.
 */
export type PoseSample = {
  xy: Float32Array;
  vis: Float32Array;
  world: Float32Array;
};

/** Point brut tel que MediaPipe le fournit. */
type RawLandmark = { x: number; y: number; z: number; visibility?: number };

/** Convertit une pose MediaPipe (33 points) en `PoseSample` (25 points). */
export function toPoseSample(
  image: ReadonlyArray<RawLandmark>,
  world: ReadonlyArray<RawLandmark>,
): PoseSample {
  const sample: PoseSample = {
    xy: new Float32Array(K * 2),
    vis: new Float32Array(K),
    world: new Float32Array(K * 3),
  };
  MEDIAPIPE_INDICES.forEach((source, i) => {
    const point = image[source];
    sample.xy[i * 2] = point.x;
    sample.xy[i * 2 + 1] = point.y;
    sample.vis[i] = point.visibility ?? 0;
    const metric = world[source];
    if (metric) {
      sample.world[i * 3] = metric.x;
      sample.world[i * 3 + 1] = metric.y;
      sample.world[i * 3 + 2] = metric.z;
    }
  });
  return sample;
}

/** Fiabilité moyenne d'une pose (moyenne des visibilités de ses points). */
export function meanVisibility(sample: PoseSample): number {
  let sum = 0;
  for (let i = 0; i < K; i++) sum += sample.vis[i];
  return sum / K;
}
