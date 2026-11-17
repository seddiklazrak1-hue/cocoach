// Dessin des squelettes sur un <canvas> (capture en direct et replay).

import { K, LM, SKELETON, type PoseSample } from "@/lib/pose/landmarks";

export type Figure = {
  sample: PoseSample;
  color: string;
  label?: string;
  /** Pointillés : assignation automatique à vérifier. */
  dashed?: boolean;
  /** Trait épaissi : personne sélectionnée. */
  highlight?: boolean;
};

export const ATHLETE_COLORS = [
  "#16a34a",
  "#2563eb",
  "#ea580c",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
];
export const UNASSIGNED_COLOR = "#9ca3af";

/** Couleur stable d'un athlète : sa position dans la liste du groupe. */
export function colorFor(athleteId: string | null | undefined, athleteIds: readonly string[]) {
  const index = athleteId ? athleteIds.indexOf(athleteId) : -1;
  return index < 0 ? UNASSIGNED_COLOR : ATHLETE_COLORS[index % ATHLETE_COLORS.length];
}

const MIN_VISIBILITY = 0.3;

export function drawFigures(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  figures: readonly Figure[],
) {
  const unit = height / 300;
  for (const figure of figures) {
    const { sample } = figure;
    const px = (i: number) => sample.xy[i * 2] * width;
    const py = (i: number) => sample.xy[i * 2 + 1] * height;
    const visible = (i: number) => sample.vis[i] >= MIN_VISIBILITY;

    ctx.save();
    ctx.strokeStyle = figure.color;
    ctx.fillStyle = figure.color;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, unit * (figure.highlight ? 1.8 : 1.1));
    ctx.setLineDash(figure.dashed ? [unit * 4, unit * 3] : []);
    for (const [a, b] of SKELETON) {
      const i = LM[a];
      const j = LM[b];
      if (!visible(i) || !visible(j)) continue;
      ctx.beginPath();
      ctx.moveTo(px(i), py(i));
      ctx.lineTo(px(j), py(j));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    let top = Infinity;
    let topX = 0;
    for (let i = 0; i < K; i++) {
      if (!visible(i)) continue;
      ctx.beginPath();
      ctx.arc(px(i), py(i), Math.max(2, unit * 1.3), 0, Math.PI * 2);
      ctx.fill();
      if (py(i) < top) {
        top = py(i);
        topX = px(i);
      }
    }

    if (figure.label && top !== Infinity) {
      const fontSize = Math.max(12, unit * 7);
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      const textWidth = ctx.measureText(figure.label).width;
      const padX = fontSize * 0.45;
      const boxHeight = fontSize * 1.5;
      const x = Math.min(Math.max(topX - textWidth / 2 - padX, 2), width - textWidth - padX * 2 - 2);
      const y = Math.max(top - boxHeight - unit * 4, 2);
      ctx.fillStyle = figure.color;
      ctx.beginPath();
      ctx.roundRect(x, y, textWidth + padX * 2, boxHeight, boxHeight / 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(figure.label, x + padX, y + boxHeight / 2);
    }
    ctx.restore();
  }
}

/** Point du canvas touché, en coordonnées normalisées (0 à 1). */
export function normalizedPoint(
  event: { clientX: number; clientY: number },
  element: Element,
) {
  const rect = element.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}
