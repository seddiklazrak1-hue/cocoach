"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { segmentsAt } from "@/lib/pose/edits";
import { pickPose } from "@/lib/pose/picking";
import { poseAt, type Recording, type Segment } from "@/lib/pose/recording";
import { formatClock } from "@/lib/sessions/domain";
import { drawFigures, normalizedPoint, type Figure } from "./draw";

const t = fr.capture.review;

type Props = {
  recording: Recording;
  frame: number;
  onFrameChange: (frame: number) => void;
  /** Apparence de chaque segment (couleur, nom…). */
  figureFor: (segment: Segment) => Omit<Figure, "sample">;
  /** Appelé quand le coach touche un squelette. */
  onPick?: (segmentId: string) => void;
};

const WIDTH = 960;

/** Replay des squelettes seuls (aucune vidéo) : lecture, pause, curseur. */
export function ReplayPlayer({ recording, frame, onFrameChange, figureFor, onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const height = Math.round(WIDTH / recording.aspect);
  const last = Math.max(0, recording.frameCount - 1);
  // Arrivé à la fin, la lecture s'arrête d'elle-même.
  const isPlaying = playing && frame < last;

  // Dessin de l'image courante.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, WIDTH, height);
    const figures: Figure[] = [];
    for (const segment of segmentsAt(recording, frame)) {
      const sample = poseAt(segment, frame);
      if (sample) figures.push({ sample, ...figureFor(segment) });
    }
    drawFigures(ctx, WIDTH, height, figures);
  }, [recording, frame, height, figureFor]);

  // Lecture à la cadence d'enregistrement (10 images par seconde).
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => onFrameChange(frame + 1), 1000 / recording.sampleRateHz);
    return () => clearTimeout(timer);
  }, [isPlaying, frame, recording.sampleRateHz, onFrameChange]);

  const seconds = (f: number) => f / recording.sampleRateHz;

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={height}
        className="w-full cursor-pointer rounded-xl"
        onPointerDown={(event) => {
          if (!onPick) return;
          const point = normalizedPoint(event, event.currentTarget);
          const segments = segmentsAt(recording, frame);
          const samples = segments.map((segment) => poseAt(segment, frame)!);
          const index = pickPose(samples, point, recording.aspect);
          if (index >= 0) onPick(segments[index].id);
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 w-24 shrink-0"
          onClick={() => {
            if (isPlaying) return setPlaying(false);
            if (frame >= last) onFrameChange(0);
            setPlaying(true);
          }}
        >
          {isPlaying ? t.pause : t.play}
        </Button>
        <input
          type="range"
          min={0}
          max={last}
          value={frame}
          aria-label={t.position}
          className="h-11 min-w-0 flex-1 accent-primary"
          onChange={(event) => {
            setPlaying(false);
            onFrameChange(Number(event.target.value));
          }}
        />
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {formatClock(seconds(frame))} / {formatClock(seconds(last))}
        </span>
      </div>
    </div>
  );
}
