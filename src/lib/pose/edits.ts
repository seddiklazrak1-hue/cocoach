// Corrections d'assignation faites par le coach dans le replay.
// Toutes les fonctions sont pures : elles renvoient un nouvel enregistrement
// sans modifier celui reçu, ce qui rend l'annulation et les tests triviaux.

import { segmentEnd, type Recording, type Segment } from "./recording";

/** Rattache un segment à un athlète, ou à personne (`null` = ne pas enregistrer). */
export function reassignSegment(
  recording: Recording,
  segmentId: string,
  athleteId: string | null,
): Recording {
  return {
    ...recording,
    segments: recording.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, athleteId, auto: false } : segment,
    ),
  };
}

/**
 * Coupe un segment en deux à l'image `atFrame` : la première partie s'arrête
 * juste avant, la seconde commence à `atFrame`. Sans effet si `atFrame` tombe
 * hors du segment ou sur sa première image.
 */
export function splitSegment(
  recording: Recording,
  segmentId: string,
  atFrame: number,
): Recording {
  const segments: Segment[] = [];
  for (const segment of recording.segments) {
    const inside = atFrame > segment.start && atFrame <= segmentEnd(segment);
    if (segment.id !== segmentId || !inside) {
      segments.push(segment);
      continue;
    }
    const cut = atFrame - segment.start;
    segments.push(
      { ...segment, id: `${segment.id}-a`, frames: segment.frames.slice(0, cut) },
      {
        ...segment,
        id: `${segment.id}-b`,
        start: atFrame,
        frames: segment.frames.slice(cut),
      },
    );
  }
  return { ...recording, segments };
}

/**
 * Corrige un échange d'identité : à partir de l'image `atFrame`, tout ce qui
 * était attribué à l'athlète A passe à B, et inversement. Ce qui précède ne
 * change pas.
 */
export function swapAthletesFrom(
  recording: Recording,
  athleteA: string,
  athleteB: string,
  atFrame: number,
): Recording {
  if (athleteA === athleteB) return recording;

  // 1. On coupe les segments de A et de B qui chevauchent l'instant du changement.
  let result = recording;
  for (const segment of recording.segments) {
    if (segment.athleteId === athleteA || segment.athleteId === athleteB) {
      result = splitSegment(result, segment.id, atFrame);
    }
  }

  // 2. On échange l'athlète de tous leurs segments qui commencent à partir de là.
  return {
    ...result,
    segments: result.segments.map((segment) => {
      if (segment.start < atFrame) return segment;
      if (segment.athleteId === athleteA) {
        return { ...segment, athleteId: athleteB, auto: false };
      }
      if (segment.athleteId === athleteB) {
        return { ...segment, athleteId: athleteA, auto: false };
      }
      return segment;
    }),
  };
}

/** Segments qui contiennent une pose à l'image `frame` (pour dessiner le replay). */
export function segmentsAt(recording: Recording, frame: number): Segment[] {
  return recording.segments.filter((segment) => {
    const index = frame - segment.start;
    return index >= 0 && index < segment.frames.length && segment.frames[index] !== null;
  });
}
