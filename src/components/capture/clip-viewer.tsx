"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { unpackSeries } from "@/lib/pose/codec";
import { recordingFromSeries, type Recording, type Segment } from "@/lib/pose/recording";
import { POSE_BUCKET } from "@/lib/sessions/domain";
import { createClient } from "@/lib/supabase/client";
import { colorFor } from "./draw";
import { ReplayPlayer } from "./replay-player";

const t = fr.sessions;

type Props = {
  series: ReadonlyArray<{ athleteId: string; storagePath: string }>;
  athletes: ReadonlyArray<{ id: string; name: string }>;
};

/**
 * Revoit une séquence enregistrée à partir des fichiers de pose stockés.
 * Prouve aussi l'aller-retour complet : compression, envoi, lecture, décodage.
 */
export function ClipViewer({ series, athletes }: Props) {
  const [state, setState] = useState<"closed" | "loading" | "open" | "error">("closed");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [frame, setFrame] = useState(0);
  const athleteIds = useMemo(() => athletes.map((athlete) => athlete.id), [athletes]);
  const nameOf = useMemo(
    () => new Map(athletes.map((athlete) => [athlete.id, athlete.name])),
    [athletes],
  );

  async function open() {
    if (recording) return setState("open");
    setState("loading");
    try {
      const supabase = createClient();
      const decoded = await Promise.all(
        series.map(async ({ athleteId, storagePath }) => {
          const { data, error } = await supabase.storage.from(POSE_BUCKET).download(storagePath);
          if (error || !data) throw error ?? new Error("download");
          const { header, frames } = await unpackSeries(new Uint8Array(await data.arrayBuffer()));
          return { athleteId, header, frames };
        }),
      );
      const first = decoded[0].header;
      setRecording(
        recordingFromSeries(
          {
            sampleRateHz: first.sampleRateHz,
            aspect: first.aspect,
            startedAt: first.startedAt,
            frameCount: Math.max(...decoded.map((d) => d.frames.length)),
          },
          decoded.map(({ athleteId, frames }) => ({ athleteId, frames })),
        ),
      );
      setFrame(0);
      setState("open");
    } catch {
      setState("error");
    }
  }

  const figureFor = useCallback(
    (segment: Segment) => ({
      color: colorFor(segment.athleteId, athleteIds),
      label: segment.athleteId ? (nameOf.get(segment.athleteId) ?? "?") : undefined,
    }),
    [athleteIds, nameOf],
  );

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 self-start"
        disabled={state === "loading"}
        onClick={() => (state === "open" ? setState("closed") : open())}
      >
        {state === "open" ? t.hideClip : state === "loading" ? t.loadingClip : t.viewClip}
      </Button>
      {state === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {t.clipLoadError}
        </p>
      )}
      {state === "open" && recording && (
        <ReplayPlayer
          recording={recording}
          frame={frame}
          onFrameChange={setFrame}
          figureFor={figureFor}
        />
      )}
    </div>
  );
}
