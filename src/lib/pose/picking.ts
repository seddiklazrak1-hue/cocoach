// Quelle pose le coach a-t-il touchée ?

import { boundingBox, type Box } from "./tracker";
import type { PoseSample } from "./landmarks";

/** Distance max (en hauteurs d'image) pour accepter un toucher à côté d'un squelette. */
const NEAR_ENOUGH = 0.15;

/**
 * Renvoie l'indice de la pose touchée au point (x, y) normalisé, ou -1.
 * Priorité au squelette qui contient le point (le plus petit si plusieurs se
 * chevauchent), sinon au plus proche s'il est assez près.
 */
export function pickPose(
  samples: ReadonlyArray<PoseSample>,
  point: { x: number; y: number },
  aspect: number,
): number {
  const px = point.x * aspect;
  const py = point.y;
  let best = -1;
  let bestArea = Infinity;
  let nearest = -1;
  let nearestDistance = Infinity;

  samples.forEach((sample, index) => {
    const box: Box = boundingBox(sample, aspect);
    const inside = px >= box.minX && px <= box.maxX && py >= box.minY && py <= box.maxY;
    const area = (box.maxX - box.minX) * (box.maxY - box.minY);
    if (inside && area < bestArea) {
      best = index;
      bestArea = area;
    }
    const dx = Math.max(box.minX - px, 0, px - box.maxX);
    const dy = Math.max(box.minY - py, 0, py - box.maxY);
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });

  if (best >= 0) return best;
  return nearestDistance <= NEAR_ENOUGH ? nearest : -1;
}
