// Suivi des personnes d'une image à la suivante.
//
// MediaPipe détecte des poses à chaque image, mais sans dire « celle-ci est la
// même personne qu'à l'image d'avant ». Ce module attribue un numéro de piste
// stable à chaque personne en comparant positions et boîtes englobantes.
//
// Limite assumée : quand deux athlètes se croisent ou s'accrochent (clinch),
// les pistes peuvent s'échanger. C'est pour ça que le coach peut corriger
// l'assignation dans le replay.

import { K, type PoseSample } from "./landmarks";

export type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** Une pose avec le numéro de piste que le tracker lui a attribué. */
export type TrackedPose = {
  trackId: number;
  sample: PoseSample;
  /** Boîte englobante, en « hauteurs d'image » (x multiplié par le ratio largeur/hauteur). */
  box: Box;
  center: { x: number; y: number };
  /** Diagonale de la boîte : sert d'échelle pour juger si un déplacement est plausible. */
  size: number;
};

type Track = {
  id: number;
  box: Box;
  center: { x: number; y: number };
  size: number;
  /** Vitesse du centre, en unités par milliseconde (pour prédire la position suivante). */
  velocity: { x: number; y: number };
  lastSeenMs: number;
};

export type TrackerOptions = {
  /** Largeur / hauteur de l'image. */
  aspect: number;
  /** Durée pendant laquelle une piste perdue peut être retrouvée (occlusion brève). */
  maxLostMs?: number;
};

const MIN_VISIBILITY = 0.3;
/** Au-delà de ce coût, on considère que ce n'est pas la même personne. */
const MAX_MATCH_COST = 0.85;

/** Boîte englobante des points suffisamment visibles d'une pose. */
export function boundingBox(sample: PoseSample, aspect: number): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const extend = (i: number) => {
    const x = sample.xy[i * 2] * aspect;
    const y = sample.xy[i * 2 + 1];
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y;
    if (y > box.maxY) box.maxY = y;
  };
  let used = 0;
  for (let i = 0; i < K; i++) {
    if (sample.vis[i] >= MIN_VISIBILITY) {
      extend(i);
      used++;
    }
  }
  // Pose très peu visible : on prend tous les points plutôt qu'une boîte vide.
  if (used < 4) for (let i = 0; i < K; i++) extend(i);
  return box;
}

function describe(sample: PoseSample, aspect: number) {
  const box = boundingBox(sample, aspect);
  return {
    box,
    center: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
    size: Math.hypot(box.maxX - box.minX, box.maxY - box.minY),
  };
}

/** Recouvrement de deux boîtes : 0 = disjointes, 1 = identiques. */
export function iou(a: Box, b: Box): number {
  const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const height = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (width <= 0 || height <= 0) return 0;
  const intersection = width * height;
  const areaA = (a.maxX - a.minX) * (a.maxY - a.minY);
  const areaB = (b.maxX - b.minX) * (b.maxY - b.minY);
  return intersection / (areaA + areaB - intersection);
}

function shift(box: Box, dx: number, dy: number): Box {
  return {
    minX: box.minX + dx,
    maxX: box.maxX + dx,
    minY: box.minY + dy,
    maxY: box.maxY + dy,
  };
}

export class PoseTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private readonly aspect: number;
  private readonly maxLostMs: number;

  constructor(options: TrackerOptions) {
    this.aspect = options.aspect;
    this.maxLostMs = options.maxLostMs ?? 800;
  }

  /**
   * Associe les poses détectées à l'instant `tMs` aux pistes existantes.
   * Les poses sans piste proche ouvrent une nouvelle piste.
   */
  update(samples: PoseSample[], tMs: number): TrackedPose[] {
    const detections = samples.map((sample) => ({
      sample,
      ...describe(sample, this.aspect),
    }));

    // Coût de chaque paire (piste, détection) : mélange de recouvrement des
    // boîtes et de distance entre centres, rapportée à la taille du corps.
    const pairs: Array<{ track: number; detection: number; cost: number }> = [];
    this.tracks.forEach((track, t) => {
      const dt = tMs - track.lastSeenMs;
      const dx = track.velocity.x * dt;
      const dy = track.velocity.y * dt;
      const predictedBox = shift(track.box, dx, dy);
      const predicted = { x: track.center.x + dx, y: track.center.y + dy };
      detections.forEach((detection, d) => {
        const distance = Math.hypot(
          detection.center.x - predicted.x,
          detection.center.y - predicted.y,
        );
        const scale = Math.max(track.size, detection.size, 1e-6);
        const cost =
          0.5 * (1 - iou(predictedBox, detection.box)) +
          0.5 * Math.min(1, distance / scale);
        if (cost <= MAX_MATCH_COST) pairs.push({ track: t, detection: d, cost });
      });
    });

    // Association gloutonne : on valide les paires de la moins coûteuse à la
    // plus coûteuse. Avec 2 à 4 personnes, c'est aussi bon qu'un algorithme
    // optimal et bien plus simple à relire.
    pairs.sort((a, b) => a.cost - b.cost);
    const trackOf = new Map<number, number>(); // détection → piste
    const usedTracks = new Set<number>();
    for (const pair of pairs) {
      if (usedTracks.has(pair.track) || trackOf.has(pair.detection)) continue;
      usedTracks.add(pair.track);
      trackOf.set(pair.detection, pair.track);
    }

    const result: TrackedPose[] = detections.map((detection, d) => {
      const matched = trackOf.get(d);
      let track: Track;
      if (matched === undefined) {
        track = {
          id: this.nextId++,
          box: detection.box,
          center: detection.center,
          size: detection.size,
          velocity: { x: 0, y: 0 },
          lastSeenMs: tMs,
        };
        this.tracks.push(track);
      } else {
        track = this.tracks[matched];
        const dt = Math.max(1, tMs - track.lastSeenMs);
        // Vitesse lissée : la moitié de l'ancienne, la moitié de la nouvelle.
        track.velocity = {
          x: 0.5 * track.velocity.x + (0.5 * (detection.center.x - track.center.x)) / dt,
          y: 0.5 * track.velocity.y + (0.5 * (detection.center.y - track.center.y)) / dt,
        };
        track.box = detection.box;
        track.center = detection.center;
        track.size = detection.size;
        track.lastSeenMs = tMs;
      }
      return {
        trackId: track.id,
        sample: detection.sample,
        box: detection.box,
        center: detection.center,
        size: detection.size,
      };
    });

    // Les pistes non revues depuis trop longtemps sont abandonnées.
    this.tracks = this.tracks.filter(
      (track) => tMs - track.lastSeenMs <= this.maxLostMs,
    );

    return result;
  }
}
