// Squelette 3D paramétrable : on fixe des angles articulaires, il produit une
// pose complète (repère monde + projection image).
//
// Usages : fixtures de tests « à angle connu » pour les métriques, et plus tard
// génération du jeu de données de démonstration.
//
// Repère monde (comme MediaPipe) : mètres, origine au milieu des hanches,
// x vers la gauche de l'athlète, y vers le bas, z vers l'arrière (l'athlète
// regarde vers -z, donc vers la caméra quand `facing` vaut 0).

import { K, LM, type LandmarkName, type PoseSample } from "./landmarks";

type V = { x: number; y: number; z: number };

const DEG = Math.PI / 180;

/** Mensurations (mètres) d'un adulte d'environ 1,75 m. */
export const BODY = {
  pelvisHalf: 0.12,
  shoulderHalf: 0.19,
  torso: 0.52,
  thigh: 0.44,
  shank: 0.43,
  upperArm: 0.3,
  forearm: 0.27,
} as const;

export type Side = { left: number; right: number };

export type SkeletonParams = {
  /** Angle du genou (hanche-genou-cheville), 180 = jambe tendue. */
  knee?: number | Side;
  /** Avancée de la cuisse par rapport à la verticale, en degrés. */
  hipFlexion?: number | Side;
  /** Inclinaison du tronc vers l'avant par rapport à la verticale, en degrés. */
  trunkLean?: number;
  /** Rotation de la ligne des épaules par rapport à celle des hanches, en degrés. */
  trunkRotation?: number;
  /** Écart latéral entre les deux chevilles, en mètres. */
  stanceWidth?: number;
  /** Angle du coude (épaule-coude-poignet), 180 = bras tendu. */
  elbow?: number | Side;
  /** Élévation du bras vers l'avant depuis la position pendante, en degrés. */
  shoulderFlexion?: number | Side;
  /** Genou rentré vers l'intérieur (valgus), en degrés de rotation autour de l'axe hanche-cheville. Négatif = genou vers l'extérieur. */
  valgus?: number | Side;
  /** Orientation de tout le corps autour de la verticale, en degrés (0 = face caméra). */
  facing?: number;
  /** Position des hanches dans l'image (0..1). Ignoré en y si `groundY` est donné. */
  imageX?: number;
  imageY?: number;
  /** Si fourni : y image du sol, la cheville la plus basse y est posée. */
  groundY?: number;
  /** Hauteurs d'image par mètre (taille apparente de l'athlète). */
  pixelsPerMeter?: number;
  aspect?: number;
  /** Fiabilité de tous les points, ou point par point. */
  visibility?: number | Partial<Record<LandmarkName, number>>;
};

const side = (value: number | Side | undefined, fallback: number): Side =>
  value === undefined
    ? { left: fallback, right: fallback }
    : typeof value === "number"
      ? { left: value, right: value }
      : value;

const v = (x: number, y: number, z: number): V => ({ x, y, z });
const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y, a.z + b.z);
const mul = (a: V, k: number): V => v(a.x * k, a.y * k, a.z * k);
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V, b: V): V =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const unit = (a: V) => mul(a, 1 / Math.hypot(a.x, a.y, a.z));

/** Direction dans le plan sagittal : `angle` degrés depuis la verticale basse, vers l'avant (-z). */
const sagittal = (angle: number): V => v(0, Math.cos(angle * DEG), -Math.sin(angle * DEG));

/** Rotation de `p` autour de l'axe unitaire `axis` (formule de Rodrigues). */
function rotate(p: V, axis: V, angle: number): V {
  const c = Math.cos(angle * DEG);
  const s = Math.sin(angle * DEG);
  return add(add(mul(p, c), mul(cross(axis, p), s)), mul(axis, dot(axis, p) * (1 - c)));
}

/** Rotation autour de la verticale (axe y). */
const yaw = (p: V, angle: number) => rotate(p, v(0, 1, 0), angle);

export function skeletonPose(params: SkeletonParams = {}): PoseSample {
  const knee = side(params.knee, 175);
  const hipFlexion = side(params.hipFlexion, 5);
  const elbow = side(params.elbow, 60);
  const shoulderFlexion = side(params.shoulderFlexion, 30);
  const valgus = side(params.valgus, 0);
  const trunkLean = params.trunkLean ?? 5;
  const trunkRotation = params.trunkRotation ?? 0;
  const stanceWidth = params.stanceWidth ?? 0.4;

  const points = {} as Record<LandmarkName, V>;

  // --- Jambes (s = +1 gauche, -1 droite) ---
  for (const [name, s] of [
    ["left", 1],
    ["right", -1],
  ] as const) {
    const hip = v(s * BODY.pelvisHalf, 0, 0);
    const thighDir = sagittal(hipFlexion[name]);
    let kneeRel = mul(thighDir, BODY.thigh);
    // Le tibia tourne vers l'arrière de (180 - angle du genou) par rapport à la cuisse.
    const shankDir = sagittal(hipFlexion[name] - (180 - knee[name]));
    let ankleRel = add(kneeRel, mul(shankDir, BODY.shank));

    // Écartement : rotation rigide de la jambe autour de l'axe avant-arrière
    // passant par la hanche (l'angle du genou est conservé).
    const drop = ankleRel.y;
    const wanted = stanceWidth / 2 - BODY.pelvisHalf;
    const abduction = Math.asin(Math.max(-0.9, Math.min(0.9, wanted / Math.max(drop, 1e-6)))) / DEG;
    // Avec cet axe, un angle positif écarte le pied vers l'extérieur du corps.
    const forwardAxis = v(0, 0, -s);
    kneeRel = rotate(kneeRel, forwardAxis, abduction);
    ankleRel = rotate(ankleRel, forwardAxis, abduction);

    // Valgus : le genou tourne autour de l'axe hanche-cheville, vers l'intérieur
    // si l'angle est positif, vers l'extérieur s'il est négatif.
    if (valgus[name] !== 0) {
      const axis = unit(ankleRel);
      const magnitude = Math.abs(valgus[name]);
      const probe = rotate(kneeRel, axis, magnitude);
      const positiveIsInward = s * (probe.x - kneeRel.x) < 0;
      const direction = (positiveIsInward ? 1 : -1) * Math.sign(valgus[name]);
      kneeRel = rotate(kneeRel, axis, direction * magnitude);
    }

    const ankle = add(hip, ankleRel);
    points[`${name}Hip`] = hip;
    points[`${name}Knee`] = add(hip, kneeRel);
    points[`${name}Ankle`] = ankle;
    points[`${name}Heel`] = add(ankle, v(0, 0.05, 0.05));
    points[`${name}Foot`] = add(ankle, v(0, 0.06, -0.15));
  }

  // --- Tronc et tête ---
  const trunkDir = v(0, -Math.cos(trunkLean * DEG), -Math.sin(trunkLean * DEG));
  const shoulderMid = mul(trunkDir, BODY.torso);
  const shoulderAxis = yaw(v(1, 0, 0), trunkRotation);
  points.leftShoulder = add(shoulderMid, mul(shoulderAxis, BODY.shoulderHalf));
  points.rightShoulder = add(shoulderMid, mul(shoulderAxis, -BODY.shoulderHalf));
  const head = add(shoulderMid, mul(trunkDir, 0.2));
  points.nose = add(add(shoulderMid, mul(trunkDir, 0.22)), v(0, 0, -0.1));
  points.leftEar = add(head, mul(shoulderAxis, 0.07));
  points.rightEar = add(head, mul(shoulderAxis, -0.07));

  // --- Bras ---
  for (const name of ["left", "right"] as const) {
    const shoulder = points[`${name}Shoulder`];
    const upperDir = sagittal(shoulderFlexion[name]);
    const elbowPoint = add(shoulder, mul(upperDir, BODY.upperArm));
    // L'avant-bras se replie vers l'avant/le haut de (180 - angle du coude).
    const foreDir = sagittal(shoulderFlexion[name] + (180 - elbow[name]));
    const wrist = add(elbowPoint, mul(foreDir, BODY.forearm));
    const s = name === "left" ? 1 : -1;
    points[`${name}Elbow`] = elbowPoint;
    points[`${name}Wrist`] = wrist;
    points[`${name}Index`] = add(wrist, mul(foreDir, 0.08));
    points[`${name}Pinky`] = add(add(wrist, mul(foreDir, 0.07)), v(s * 0.02, 0, 0));
    points[`${name}Thumb`] = add(add(wrist, mul(foreDir, 0.05)), v(-s * 0.02, 0, 0));
  }

  // --- Orientation globale puis projection ---
  const facing = params.facing ?? 0;
  const aspect = params.aspect ?? 16 / 9;
  const ppm = params.pixelsPerMeter ?? 0.34;
  const worldPoints = Object.fromEntries(
    (Object.entries(points) as Array<[LandmarkName, V]>).map(([name, p]) => [name, yaw(p, facing)]),
  ) as Record<LandmarkName, V>;

  const lowestAnkle = Math.max(worldPoints.leftAnkle.y, worldPoints.rightAnkle.y);
  const imageX = params.imageX ?? 0.5;
  const imageY = params.groundY !== undefined ? params.groundY - lowestAnkle * ppm : (params.imageY ?? 0.55);

  const sample: PoseSample = {
    xy: new Float32Array(K * 2),
    vis: new Float32Array(K),
    world: new Float32Array(K * 3),
  };
  for (const [name, p] of Object.entries(worldPoints) as Array<[LandmarkName, V]>) {
    const i = LM[name];
    sample.world[i * 3] = p.x;
    sample.world[i * 3 + 1] = p.y;
    sample.world[i * 3 + 2] = p.z;
    // Projection orthographique : la gauche de l'athlète (+x) apparaît à droite de l'image.
    sample.xy[i * 2] = imageX + (p.x * ppm) / aspect;
    sample.xy[i * 2 + 1] = imageY + p.y * ppm;
    const vis = params.visibility;
    sample.vis[i] = typeof vis === "number" ? vis : (vis?.[name] ?? 0.95);
  }
  return sample;
}

/** Ajoute un bruit uniforme (± `amplitude` mètres) au repère monde et l'équivalent en image. */
export function withNoise(
  sample: PoseSample,
  amplitude: number,
  random: () => number,
  pixelsPerMeter = 0.34,
): PoseSample {
  const noisy: PoseSample = {
    xy: Float32Array.from(sample.xy),
    vis: Float32Array.from(sample.vis),
    world: Float32Array.from(sample.world),
  };
  for (let i = 0; i < noisy.world.length; i++) noisy.world[i] += (random() - 0.5) * 2 * amplitude;
  for (let i = 0; i < noisy.xy.length; i++) noisy.xy[i] += (random() - 0.5) * 2 * amplitude * pixelsPerMeter;
  return noisy;
}

