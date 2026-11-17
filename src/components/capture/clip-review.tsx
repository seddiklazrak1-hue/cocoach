"use client";

import { useCallback, useMemo, useState } from "react";
import { Select } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { reassignSegment, splitSegment, swapAthletesFrom } from "@/lib/pose/edits";
import {
  athleteIdsIn,
  segmentEnd,
  seriesForAthlete,
  seriesStats,
  type Recording,
  type Segment,
} from "@/lib/pose/recording";
import { formatClock } from "@/lib/sessions/domain";
import { colorFor } from "./draw";
import { ReplayPlayer } from "./replay-player";

const t = fr.capture.review;

export type AthleteOption = { id: string; name: string; allowed: boolean };

type Props = {
  recording: Recording;
  athletes: AthleteOption[];
  saving: { done: number; total: number } | null;
  error: string | null;
  onSave: (recording: Recording) => void;
  onDiscard: () => void;
};

/** Un segment de moins de 3 images (0,3 s) est du bruit de détection : on ne l'affiche pas. */
const MIN_SEGMENT_FRAMES = 3;

export function reliabilityLabel(confidence: number) {
  if (confidence >= 0.7) return t.reliability.good;
  if (confidence >= 0.5) return t.reliability.medium;
  return t.reliability.low;
}

/** Relecture d'une séquence, corrections d'identité, puis envoi. */
export function ClipReview({ recording, athletes, saving, error, onSave, onDiscard }: Props) {
  const [clip, setClip] = useState(recording);
  const [frame, setFrame] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const athleteIds = useMemo(() => athletes.map((athlete) => athlete.id), [athletes]);
  const nameOf = useMemo(
    () => new Map(athletes.map((athlete) => [athlete.id, athlete.name])),
    [athletes],
  );
  const allowed = athletes.filter((athlete) => athlete.allowed);

  const visibleSegments = clip.segments.filter(
    (segment) => segment.frames.filter(Boolean).length >= MIN_SEGMENT_FRAMES,
  );
  const numberOf = useMemo(
    () => new Map(visibleSegments.map((segment, index) => [segment.id, index + 1])),
    [visibleSegments],
  );

  const present = athleteIdsIn(clip).filter((id) => nameOf.has(id));
  const toSave = present.filter((id) => athletes.find((a) => a.id === id)?.allowed);
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");
  const a = present.includes(swapA) ? swapA : (present[0] ?? "");
  const b = present.includes(swapB) && swapB !== a ? swapB : (present.find((id) => id !== a) ?? "");

  const seconds = (f: number) => f / clip.sampleRateHz;

  const figureFor = useCallback(
    (segment: Segment) => ({
      color: colorFor(segment.athleteId, athleteIds),
      label: segment.athleteId
        ? `${nameOf.get(segment.athleteId) ?? "?"}${segment.auto ? " ?" : ""}`
        : t.track(numberOf.get(segment.id) ?? 0),
      dashed: segment.auto,
      highlight: segment.id === selected,
    }),
    [athleteIds, nameOf, numberOf, selected],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">{t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <ReplayPlayer
        recording={clip}
        frame={frame}
        onFrameChange={setFrame}
        figureFor={figureFor}
        onPick={setSelected}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h3 className="font-medium">{t.tracksTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.tracksHint}</p>
        </div>
        <ul className="divide-y rounded-xl border">
          {visibleSegments.map((segment) => {
            const canSplit = frame > segment.start && frame <= segmentEnd(segment);
            return (
              <li
                key={segment.id}
                className={`flex flex-col gap-2 px-4 py-3 ${segment.id === selected ? "bg-muted/60" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: colorFor(segment.athleteId, athleteIds) }}
                  />
                  <span className="font-medium">{t.track(numberOf.get(segment.id) ?? 0)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatClock(seconds(segment.start))}–{formatClock(seconds(segmentEnd(segment)))}
                  </span>
                  {segment.auto && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {fr.capture.autoAssigned}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    aria-label={t.track(numberOf.get(segment.id) ?? 0)}
                    className="min-w-0 flex-1 sm:max-w-xs"
                    value={segment.athleteId ?? ""}
                    onChange={(event) =>
                      setClip(reassignSegment(clip, segment.id, event.target.value || null))
                    }
                  >
                    <option value="">{t.nobody}</option>
                    {allowed.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        {athlete.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11"
                    onClick={() => {
                      setFrame(segment.start);
                      setSelected(segment.id);
                    }}
                  >
                    {t.goTo}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="h-11"
                    title={t.splitHint}
                    disabled={!canSplit}
                    onClick={() => setClip(splitSegment(clip, segment.id, frame))}
                  >
                    {t.split}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {present.length >= 2 && (
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <div>
            <h3 className="font-medium">{t.swapTitle}</h3>
            <p className="text-sm text-muted-foreground">{t.swapHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label={t.swapA} className="w-auto" value={a} onChange={(e) => setSwapA(e.target.value)}>
              {present.map((id) => (
                <option key={id} value={id}>
                  {nameOf.get(id)}
                </option>
              ))}
            </Select>
            <span className="text-sm text-muted-foreground">{t.swapB}</span>
            <Select aria-label={t.swapB} className="w-auto" value={b} onChange={(e) => setSwapB(e.target.value)}>
              {present
                .filter((id) => id !== a)
                .map((id) => (
                  <option key={id} value={id}>
                    {nameOf.get(id)}
                  </option>
                ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11"
              disabled={!a || !b || a === b}
              onClick={() => setClip(swapAthletesFrom(clip, a, b, frame))}
            >
              {t.swap(formatClock(seconds(frame)))}
            </Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-medium">{t.summaryTitle}</h3>
        {toSave.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.summaryEmpty}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {toSave.map((id) => {
              const stats = seriesStats(seriesForAthlete(clip, id));
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: colorFor(id, athleteIds) }}
                  />
                  <span className="font-medium">{nameOf.get(id)}</span>
                  <span className="text-muted-foreground">
                    {t.coverage(Math.round(stats.coverage * 100))} ·{" "}
                    {reliabilityLabel(stats.meanConfidence)}
                    {stats.coverage < 0.2 && ` · ${t.shortPresence}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          className="h-11 px-5"
          disabled={toSave.length === 0 || saving !== null}
          onClick={() => onSave(clip)}
        >
          {saving ? t.saving(saving.done, saving.total) : t.save(toSave.length)}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="h-11 px-5"
          disabled={saving !== null}
          onClick={() => {
            if (window.confirm(t.discardConfirm)) onDiscard();
          }}
        >
          {t.discard}
        </Button>
      </div>
    </div>
  );
}
