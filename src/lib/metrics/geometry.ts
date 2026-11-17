// Géométrie de base sur les poses : points, angles, distances.
//
// Deux repères coexistent :
// - « image » (xy) : coordonnées normalisées 0..1, y vers le bas. Une distance
//   en x doit être multipliée par le ratio largeur/hauteur pour être comparable
//   à une distance en y.
// - « monde » (world) : estimation 3D en mètres de MediaPipe, origine au milieu
//   des hanches, y vers le bas (même sens que l'image). La profondeur (z) est
//   la composante la plus bruitée : les métriques qui en dépendent beaucoup ont
//   une fiabilité réduite (voir `DEPTH_PENALTY`).

import { LM, type LandmarkName, type PoseSample } from "@/lib/pose/landmarks";

export type Vec3 = { x: number; y: number; z: number };

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);
export const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));

export const RAD_TO_DEG = 180 / Math.PI;

/** Angle (degrés, 0 à 180) entre deux vecteurs ; `null` si l'un est nul. */
export function angleBetween(u: Vec3, v: Vec3): number | null {
  const nu = norm(u);
  const nv = norm(v);
  if (nu < 1e-9 || nv < 1e-9) return null;
  const cos = Math.max(-1, Math.min(1, dot(u, v) / (nu * nv)));
  return Math.acos(cos) * RAD_TO_DEG;
}

/** Angle au sommet `b` du triangle a-b-c (ex. genou : hanche-genou-cheville). 180 = segment tendu. */
export function jointAngle(a: Vec3, b: Vec3, c: Vec3): number | null {
  return angleBetween(sub(a, b), sub(c, b));
}

/** Point du repère monde (mètres). */
export function world(sample: PoseSample, name: LandmarkName): Vec3 {
  const i = LM[name] * 3;
  return { x: sample.world[i], y: sample.world[i + 1], z: sample.world[i + 2] };
}

/** Point du repère image, x corrigé par le ratio pour que les distances soient isotropes (z = 0). */
export function image(sample: PoseSample, name: LandmarkName, aspect: number): Vec3 {
  const i = LM[name] * 2;
  return { x: sample.xy[i] * aspect, y: sample.xy[i + 1], z: 0 };
}

export function visibility(sample: PoseSample, name: LandmarkName): number {
  return sample.vis[LM[name]];
}

/** Fiabilité moyenne d'un ensemble de points. */
export function meanVisibilityOf(sample: PoseSample, names: readonly LandmarkName[]): number {
  if (names.length === 0) return 0;
  let sum = 0;
  for (const name of names) sum += visibility(sample, name);
  return sum / names.length;
}

/** Vers le haut dans le repère monde (y pointe vers le bas). */
export const UP: Vec3 = { x: 0, y: -1, z: 0 };

/** Projection de `v` sur le plan perpendiculaire à `axis` (unitaire). */
export function projectOnPlane(v: Vec3, axis: Vec3): Vec3 {
  return sub(v, scale(axis, dot(v, axis)));
}

export function normalize(v: Vec3): Vec3 | null {
  const n = norm(v);
  return n < 1e-9 ? null : scale(v, 1 / n);
}

/** Longueur du tronc (milieu des hanches → milieu des épaules) : unité de taille du corps. */
export function torsoLength(sample: PoseSample): number {
  return distance(
    mid(world(sample, "leftHip"), world(sample, "rightHip")),
    mid(world(sample, "leftShoulder"), world(sample, "rightShoulder")),
  );
}

// --- Statistiques simples ----------------------------------------------------

export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Quantile par interpolation linéaire (q entre 0 et 1). */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

export const median = (values: readonly number[]) => quantile(values, 0.5);

export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)));
}

/** Écart-type / moyenne (0 si la moyenne est nulle). */
export function coefficientOfVariation(values: readonly number[]): number {
  const m = mean(values);
  if (!(m > 1e-9)) return 0;
  return standardDeviation(values) / m;
}
