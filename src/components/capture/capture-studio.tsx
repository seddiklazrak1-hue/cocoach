"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { packSeries } from "@/lib/pose/codec";
import {
  athleteIdsIn,
  MAX_CLIP_SECONDS,
  seriesForAthlete,
  seriesStats,
  type Recording,
} from "@/lib/pose/recording";
import { registerClip } from "@/lib/sessions/actions";
import { formatClock, POSE_BUCKET, poseStoragePath } from "@/lib/sessions/domain";
import type { ClipInput } from "@/lib/sessions/schemas";
import { createClient } from "@/lib/supabase/client";
import { ClipReview, type AthleteOption } from "./clip-review";
import { colorFor, normalizedPoint } from "./draw";
import { LiveSession, type LiveSnapshot } from "./live-session";
import { PlacementGuide } from "./placement-guide";
import { loadPoseEngine } from "./pose-engine";

const t = fr.capture;

type Props = {
  sessionId: string;
  coachId: string;
  athletes: AthleteOption[];
};

type Phase = "source" | "live" | "review" | "saved";
type Source = "camera" | "file";
const EMPTY_SNAPSHOT: LiveSnapshot = {
  fps: 0,
  warnings: [],
  onScreen: [],
  recording: false,
  elapsed: 0,
};

/** En dessous, l'analyse est jugée trop lente pour bien capter les mouvements rapides. */
const SLOW_FPS = 12;

class SaveError extends Error {}

/**
 * Écran de capture : caméra (ou fichier local) → squelettes en direct →
 * assignation au toucher → enregistrement → relecture → envoi des séries.
 * La vidéo ne quitte jamais l'appareil.
 */
export function CaptureStudio({ sessionId, coachId, athletes }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("source");
  const [engineState, setEngineState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [live, setLive] = useState<LiveSnapshot>(EMPTY_SNAPSHOT);
  /** Personne touchée, et l'athlète qui lui était déjà assigné. */
  const [picked, setPicked] = useState<{ trackId: number; athleteId: string | null } | null>(null);
  const [clip, setClip] = useState<Recording | null>(null);
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number; bytes: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const athleteIds = athletes.map((athlete) => athlete.id);
  const nameOf = new Map(athletes.map((athlete) => [athlete.id, athlete.name]));

  // --- Source vidéo ----------------------------------------------------------

  function stopSource() {
    sessionRef.current?.stop();
    sessionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = null;
  }

  async function start(source: Source, file?: File) {
    setSourceError(null);
    setEngineState("loading");
    let engine;
    try {
      engine = await loadPoseEngine();
      setEngineState("ready");
    } catch {
      setEngineState("error");
      return;
    }

    stopSource();
    const video = videoRef.current!;
    video.muted = true;
    video.playsInline = true;
    try {
      if (source === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        video.srcObject = stream;
      } else if (file) {
        fileUrlRef.current = URL.createObjectURL(file);
        video.src = fileUrlRef.current;
      }
      await new Promise<void>((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("video")), { once: true });
      });
      await video.play();
    } catch {
      stopSource();
      setSourceError(t.cameraError);
      return;
    }

    const session = new LiveSession({
      video,
      canvas: canvasRef.current!,
      engine,
      source,
      athleteIds,
      nameOf,
      onSnapshot: setLive,
      onAutoStop: () => finishRecording(),
    });
    sessionRef.current = session;
    setAspect(session.aspect);
    setLive(EMPTY_SNAPSHOT);
    setPhase("live");
    session.start();
  }

  // --- Enregistrement --------------------------------------------------------

  async function startRecording() {
    sessionRef.current?.startRecording();
    try {
      // Empêche l'écran du téléphone de se mettre en veille pendant l'enregistrement.
      wakeLockRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // Non supporté ou refusé : sans gravité.
    }
  }

  function finishRecording() {
    const session = sessionRef.current;
    if (!session?.isRecording) return;
    const result = session.stopRecording();
    void wakeLockRef.current?.release();
    wakeLockRef.current = null;
    if (!result) return; // arrêt immédiat : rien à relire
    stopSource();
    setPicked(null);
    setSaveError(null);
    setClip(result);
    setPhase("review");
  }

  // Nettoyage en quittant la page.
  useEffect(
    () => () => {
      sessionRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      void wakeLockRef.current?.release();
    },
    [],
  );

  // --- Assignation au toucher ------------------------------------------------

  function onStagePointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const session = sessionRef.current;
    if (!session) return;
    const trackId = session.pick(normalizedPoint(event, event.currentTarget));
    session.highlight(trackId);
    setPicked(
      trackId === null
        ? null
        : { trackId, athleteId: session.assignmentOf(trackId)?.athleteId ?? null },
    );
  }

  function choose(athleteId: string | null) {
    if (!picked) return;
    sessionRef.current?.assign(picked.trackId, athleteId);
    sessionRef.current?.highlight(null);
    setPicked(null);
  }

  // --- Envoi -----------------------------------------------------------------

  async function save(result: Recording) {
    const allowed = new Set(athletes.filter((a) => a.allowed).map((a) => a.id));
    const ids = athleteIdsIn(result).filter((id) => allowed.has(id));
    const clipId = crypto.randomUUID();
    const supabase = createClient();
    const uploaded: string[] = [];
    const entries: ClipInput["entries"] = [];
    let bytes = 0;

    setSaveError(null);
    setSaving({ done: 0, total: ids.length });
    try {
      for (const athleteId of ids) {
        const series = seriesForAthlete(result, athleteId);
        const seriesInfo = seriesStats(series);
        if (seriesInfo.presentCount === 0) continue;
        const packed = await packSeries(series, {
          sampleRateHz: result.sampleRateHz,
          aspect: result.aspect,
          startedAt: result.startedAt,
        });
        const path = poseStoragePath(coachId, sessionId, clipId, athleteId);
        const { error } = await supabase.storage
          .from(POSE_BUCKET)
          .upload(path, new Blob([packed as BlobPart]), {
            contentType: "application/octet-stream",
            upsert: false,
          });
        if (error) throw error;
        uploaded.push(path);
        bytes += packed.length;
        entries.push({
          athleteId,
          storagePath: path,
          sampleRateHz: result.sampleRateHz,
          frameCount: series.length,
          durationS: series.length / result.sampleRateHz,
          meanConfidence: seriesInfo.meanConfidence,
        });
        setSaving({ done: entries.length, total: ids.length });
      }
      const response = await registerClip({
        sessionId,
        clipId,
        startedAt: result.startedAt,
        entries,
      });
      if (!response.ok) throw new SaveError(response.error);
      setSaved({ count: entries.length, bytes });
      setClip(null);
      setPhase("saved");
      router.refresh();
    } catch (error) {
      // Rien ne doit rester à moitié enregistré : on retire les fichiers envoyés.
      if (uploaded.length > 0) await supabase.storage.from(POSE_BUCKET).remove(uploaded);
      setSaveError(error instanceof SaveError ? error.message : t.review.saveError);
    } finally {
      setSaving(null);
    }
  }

  function reset() {
    setClip(null);
    setSaved(null);
    setLive(EMPTY_SNAPSHOT);
    setPhase("source");
  }

  // --- Rendu -----------------------------------------------------------------

  const assigned = live.onScreen.filter((person) => person.athleteId);
  const unassignedCount = live.onScreen.length - assigned.length;

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">{t.privacy}</p>

      {phase === "source" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold">{t.sourceTitle}</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              className="h-11 px-5"
              disabled={engineState === "loading"}
              onClick={() => start("camera")}
            >
              {t.useCamera}
            </Button>
            <label
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "h-11 cursor-pointer px-5",
              })}
            >
              {t.useFile}
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                disabled={engineState === "loading"}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void start("file", file);
                }}
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">{t.fileHint}</p>
          {engineState === "loading" && (
            <p role="status" className="text-sm">
              {t.loadingEngine}
            </p>
          )}
          {engineState === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {t.engineError}
            </p>
          )}
          {sourceError && (
            <p role="alert" className="text-sm text-destructive">
              {sourceError}
            </p>
          )}
          <PlacementGuide open />
        </section>
      )}

      {/* La scène reste montée : la vidéo doit exister avant de lui donner une source. */}
      <section className={phase === "live" ? "flex flex-col gap-3" : "hidden"}>
        <div
          className="relative w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: String(aspect) }}
        >
          <video ref={videoRef} className="absolute inset-0 h-full w-full" muted playsInline />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full cursor-pointer touch-manipulation"
            onPointerDown={onStagePointer}
          />
          {live.recording && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white">
              <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
              {t.recording} {formatClock(live.elapsed)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{t.fps(live.fps)}</span>
          <span>{t.people(live.onScreen.length)}</span>
        </div>
        {live.fps > 0 && live.fps < SLOW_FPS && (
          <p className="text-sm text-amber-800">{t.slowDevice}</p>
        )}
        {live.warnings.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-amber-800">
            {live.warnings.map((warning) => (
              <li key={warning}>{t.warnings[warning]}</li>
            ))}
          </ul>
        )}

        {picked ? (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <p className="font-medium">{t.assignTitle}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {athletes.map((athlete) => (
                <Button
                  key={athlete.id}
                  type="button"
                  variant={picked.athleteId === athlete.id ? "secondary" : "outline"}
                  size="lg"
                  className="h-11 justify-start gap-2"
                  disabled={!athlete.allowed}
                  onClick={() => choose(athlete.id)}
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: colorFor(athlete.id, athleteIds) }}
                  />
                  {athlete.name}
                  {!athlete.allowed && (
                    <span className="text-xs text-muted-foreground">({t.assignBlocked})</span>
                  )}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {picked.athleteId && (
                <Button type="button" variant="ghost" size="lg" className="h-11" onClick={() => choose(null)}>
                  {t.unassign}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-11"
                onClick={() => {
                  sessionRef.current?.highlight(null);
                  setPicked(null);
                }}
              >
                {t.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm">{t.tapToAssign}</p>
        )}

        {live.onScreen.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t.onScreen} :{" "}
            {[
              ...assigned.map(
                (person) =>
                  `${nameOf.get(person.athleteId!) ?? "?"}${person.auto ? ` (${t.autoAssigned})` : ""}`,
              ),
              ...(unassignedCount > 0 ? [`${unassignedCount} ${t.unassigned}`] : []),
            ].join(", ")}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {live.recording ? (
            <Button type="button" variant="destructive" size="lg" className="h-11 px-6" onClick={finishRecording}>
              {t.stop}
            </Button>
          ) : (
            <Button type="button" size="lg" className="h-11 px-6" onClick={startRecording}>
              {t.record}
            </Button>
          )}
          {!live.recording && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-11"
              onClick={() => {
                stopSource();
                reset();
              }}
            >
              {t.changeSource}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t.maxDuration(MAX_CLIP_SECONDS / 60)}</p>
        <PlacementGuide />
      </section>

      {phase === "review" && clip && (
        <ClipReview
          recording={clip}
          athletes={athletes}
          saving={saving}
          error={saveError}
          onSave={save}
          onDiscard={reset}
        />
      )}

      {phase === "saved" && saved && (
        <section className="flex flex-col items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <h2 className="font-heading text-lg font-semibold">{t.saved.title}</h2>
          <p className="text-sm leading-relaxed">
            {t.saved.body(saved.count, `${Math.max(1, Math.round(saved.bytes / 1024))} Ko`)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="lg" className="h-11 px-5" onClick={reset}>
              {t.saved.another}
            </Button>
            <Link
              href={`/sessions/${sessionId}`}
              className={buttonVariants({ variant: "outline", size: "lg", className: "h-11 bg-white px-5" })}
            >
              {t.saved.back}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
