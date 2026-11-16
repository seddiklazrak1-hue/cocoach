// Enregistrement d'une séquence : des « segments » de pose à cadence fixe.
//
// Un segment = une piste du tracker, du moment où elle apparaît au moment où
// elle disparaît. Chaque segment est rattaché à un athlète (ou à personne).
// Seuls les segments rattachés à un athlète sont envoyés au serveur.

import { meanVisibility, type PoseSample } from "./landmarks";
import type { Assignment } from "./identity";
import type { TrackedPose } from "./tracker";

/** Cadence de stockage. La détection tourne plus vite ; on garde 10 poses par seconde. */
export const SAMPLE_RATE_HZ = 10;

/** Durée maximale d'une séquence : au-delà, téléphone et mémoire fatiguent. */
export const MAX_CLIP_SECONDS = 10 * 60;

export type Segment = {
  id: string;
  /** Athlète rattaché, ou `null` si le segment n'est assigné à personne. */
  athleteId: string | null;
  /** Vrai si l'assignation vient de l'aide automatique (à vérifier par le coach). */
  auto: boolean;
  /** Indice de la première image du segment dans la séquence. */
  start: number;
  /** Poses à cadence fixe ; `null` = personne non détectée à cet instant. */
  frames: Array<PoseSample | null>;
};

export type Recording = {
  sampleRateHz: number;
  /** Nombre total d'images de la séquence. */
  frameCount: number;
  /** Largeur / hauteur de l'image filmée (nécessaire pour calculer des angles en 2D). */
  aspect: number;
  /** Début de la séquence, horodatage ISO. */
  startedAt: string;
  segments: Segment[];
};

/** Accumule les poses suivies pendant la capture et les range à cadence fixe. */
export class ClipRecorder {
  private readonly byTrack = new Map<number, { start: number; frames: Array<PoseSample | null> }>();
  private lastFrame = -1;

  constructor(
    private readonly options: { aspect: number; startedAt: string; sampleRateHz?: number },
  ) {}

  private get rate() {
    return this.options.sampleRateHz ?? SAMPLE_RATE_HZ;
  }

  /** Ajoute les poses détectées à `tMs` millisecondes du début de la séquence. */
  add(tMs: number, poses: TrackedPose[]) {
    const frame = Math.floor((tMs / 1000) * this.rate);
    if (frame < 0) return;
    if (frame > this.lastFrame) this.lastFrame = frame;

    for (const pose of poses) {
      let entry = this.byTrack.get(pose.trackId);
      if (!entry) {
        entry = { start: frame, frames: [] };
        this.byTrack.set(pose.trackId, entry);
      }
      const index = frame - entry.start;
      // Une seule pose par case de temps : la première détection gagne.
      if (index < entry.frames.length) continue;
      // Cases sautées (détection plus lente que la cadence, ou piste perdue un instant).
      while (entry.frames.length < index) entry.frames.push(null);
      entry.frames.push(pose.sample);
    }
  }

  /** Termine la séquence et applique les assignations piste → athlète. */
  finish(assignments: Map<number, Assignment>): Recording {
    const segments: Segment[] = [];
    for (const [trackId, entry] of this.byTrack) {
      const assignment = assignments.get(trackId);
      segments.push({
        id: `t${trackId}`,
        athleteId: assignment?.athleteId ?? null,
        auto: assignment?.auto ?? false,
        start: entry.start,
        frames: entry.frames,
      });
    }
    segments.sort((a, b) => a.start - b.start);
    return {
      sampleRateHz: this.rate,
      frameCount: this.lastFrame + 1,
      aspect: this.options.aspect,
      startedAt: this.options.startedAt,
      segments,
    };
  }
}

/** Pose du segment à l'image `frame` de la séquence, ou `null`. */
export function poseAt(segment: Segment, frame: number): PoseSample | null {
  const index = frame - segment.start;
  return index >= 0 && index < segment.frames.length ? segment.frames[index] : null;
}

/** Dernière image (incluse) couverte par le segment. */
export function segmentEnd(segment: Segment): number {
  return segment.start + segment.frames.length - 1;
}

/** Identifiants des athlètes présents dans l'enregistrement. */
export function athleteIdsIn(recording: Recording): string[] {
  const ids = new Set<string>();
  for (const segment of recording.segments) {
    if (segment.athleteId) ids.add(segment.athleteId);
  }
  return [...ids];
}

/**
 * Série complète d'un athlète : une case par image de la séquence.
 * Si deux segments du même athlète se chevauchent (rare : double assignation),
 * on garde à chaque instant la pose la plus fiable.
 */
export function seriesForAthlete(
  recording: Recording,
  athleteId: string,
): Array<PoseSample | null> {
  const series: Array<PoseSample | null> = new Array(recording.frameCount).fill(null);
  for (const segment of recording.segments) {
    if (segment.athleteId !== athleteId) continue;
    segment.frames.forEach((sample, index) => {
      const frame = segment.start + index;
      if (!sample || frame >= recording.frameCount) return;
      const existing = series[frame];
      if (!existing || meanVisibility(sample) > meanVisibility(existing)) {
        series[frame] = sample;
      }
    });
  }
  return series;
}

export type SeriesStats = {
  /** Nombre d'images où l'athlète est détecté. */
  presentCount: number;
  /** Part de la séquence où l'athlète est détecté (0 à 1). */
  coverage: number;
  /** Fiabilité moyenne des points sur les images détectées (0 à 1). */
  meanConfidence: number;
};

export function seriesStats(series: Array<PoseSample | null>): SeriesStats {
  let presentCount = 0;
  let confidence = 0;
  for (const sample of series) {
    if (!sample) continue;
    presentCount++;
    confidence += meanVisibility(sample);
  }
  return {
    presentCount,
    coverage: series.length === 0 ? 0 : presentCount / series.length,
    meanConfidence: presentCount === 0 ? 0 : confidence / presentCount,
  };
}

/** Reconstruit un enregistrement à partir de séries déjà stockées (un segment par athlète). */
export function recordingFromSeries(
  meta: Pick<Recording, "sampleRateHz" | "frameCount" | "aspect" | "startedAt">,
  series: Array<{ athleteId: string; frames: Array<PoseSample | null> }>,
): Recording {
  return {
    ...meta,
    segments: series.map(({ athleteId, frames }) => ({
      id: `a-${athleteId}`,
      athleteId,
      auto: false,
      start: 0,
      frames,
    })),
  };
}
