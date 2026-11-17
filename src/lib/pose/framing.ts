// Conseils de cadrage en direct, calculés à partir des poses détectées.

import { meanVisibility } from "./landmarks";
import type { TrackedPose } from "./tracker";

export type FramingWarning = "noPerson" | "tooFar" | "edge" | "lowConfidence";

/** En dessous de cette taille (diagonale du corps, en hauteurs d'image), l'athlète est trop loin. */
const MIN_BODY_SIZE = 0.35;
const EDGE_MARGIN = 0.005;
const MIN_CONFIDENCE = 0.5;

export function framingWarnings(
  poses: ReadonlyArray<Pick<TrackedPose, "box" | "size" | "sample">>,
  aspect: number,
): FramingWarning[] {
  if (poses.length === 0) return ["noPerson"];
  const warnings: FramingWarning[] = [];

  const sizes = poses.map((pose) => pose.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  if (median < MIN_BODY_SIZE) warnings.push("tooFar");

  const touchesEdge = poses.some(
    ({ box }) =>
      box.minX <= EDGE_MARGIN ||
      box.maxX >= aspect - EDGE_MARGIN ||
      box.minY <= EDGE_MARGIN ||
      box.maxY >= 1 - EDGE_MARGIN,
  );
  if (touchesEdge) warnings.push("edge");

  const confidence =
    poses.reduce((sum, pose) => sum + meanVisibility(pose.sample), 0) / poses.length;
  if (confidence < MIN_CONFIDENCE) warnings.push("lowConfidence");

  return warnings;
}
