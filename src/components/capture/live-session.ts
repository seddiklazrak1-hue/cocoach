// Boucle de capture en direct, hors de React.
//
// À chaque nouvelle image vidéo : détection MediaPipe → suivi des personnes →
// identités → (enregistrement) → dessin. Cette boucle tourne 15 à 30 fois par
// seconde : la garder hors de React évite de redessiner la page à chaque image.
// L'interface reçoit un résumé (`LiveSnapshot`) une fois par seconde, ou dès
// qu'une assignation change.

import { framingWarnings, type FramingWarning } from "@/lib/pose/framing";
import { IdentityBook } from "@/lib/pose/identity";
import { toPoseSample } from "@/lib/pose/landmarks";
import { pickPose } from "@/lib/pose/picking";
import { ClipRecorder, MAX_CLIP_SECONDS, type Recording } from "@/lib/pose/recording";
import { PoseTracker, type TrackedPose } from "@/lib/pose/tracker";
import { colorFor, drawFigures, UNASSIGNED_COLOR } from "./draw";
import type { loadPoseEngine } from "./pose-engine";

type Engine = Awaited<ReturnType<typeof loadPoseEngine>>;

export type LiveSnapshot = {
  fps: number;
  warnings: FramingWarning[];
  /** Personnes à l'image et leur assignation éventuelle. */
  onScreen: Array<{ trackId: number; athleteId: string | null; auto: boolean }>;
  recording: boolean;
  /** Durée enregistrée, en secondes. */
  elapsed: number;
};

type Options = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  engine: Engine;
  /** « file » : le temps suit la position dans la vidéo ; « camera » : l'horloge réelle. */
  source: "camera" | "file";
  athleteIds: readonly string[];
  nameOf: ReadonlyMap<string, string>;
  onSnapshot: (snapshot: LiveSnapshot) => void;
  /** Durée maximale atteinte, ou fin du fichier vidéo pendant l'enregistrement. */
  onAutoStop: () => void;
};

export class LiveSession {
  readonly aspect: number;
  private readonly tracker: PoseTracker;
  private readonly book = new IdentityBook();
  private recorder: ClipRecorder | null = null;
  private recordStart = 0;
  private poses: TrackedPose[] = [];
  private highlighted: number | null = null;
  private raf: number | null = null;
  private lastVideoTime = -1;
  private lastTs = 0;
  private frames = 0;
  private since = 0;
  private fps = 0;
  private lastClipT = 0;

  constructor(private readonly options: Options) {
    const { video, canvas } = options;
    this.aspect = video.videoWidth / video.videoHeight || 16 / 9;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    this.tracker = new PoseTracker({ aspect: this.aspect });
    // Fichier : lecture en boucle pendant l'aperçu, pour avoir le temps
    // d'assigner les athlètes avant d'enregistrer.
    if (options.source === "file") video.loop = true;
    video.addEventListener("ended", this.onEnded);
  }

  start() {
    this.since = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.options.video.removeEventListener("ended", this.onEnded);
  }

  get isRecording() {
    return this.recorder !== null;
  }

  startRecording() {
    const { video, source } = this.options;
    this.recorder = new ClipRecorder({ aspect: this.aspect, startedAt: new Date().toISOString() });
    if (source === "file") {
      // Un fichier s'analyse en entier : on repart du début, et la fin de la
      // vidéo arrête l'enregistrement. Les assignations déjà faites sont gardées.
      video.loop = false;
      video.currentTime = 0;
      this.recordStart = 0;
    } else {
      this.recordStart = performance.now();
    }
    this.emit();
  }

  /** Termine l'enregistrement et renvoie la séquence (ou `null` si elle est vide). */
  stopRecording(): Recording | null {
    if (!this.recorder) return null;
    const result = this.recorder.finish(this.book.snapshot());
    this.recorder = null;
    this.emit();
    return result.frameCount >= 2 ? result : null;
  }

  /** Personne touchée au point normalisé (x, y), ou `null`. */
  pick(point: { x: number; y: number }): number | null {
    const index = pickPose(
      this.poses.map((pose) => pose.sample),
      point,
      this.aspect,
    );
    return index >= 0 ? this.poses[index].trackId : null;
  }

  highlight(trackId: number | null) {
    this.highlighted = trackId;
  }

  assignmentOf(trackId: number) {
    return this.book.get(trackId);
  }

  assign(trackId: number, athleteId: string | null) {
    if (athleteId) this.book.assign(trackId, athleteId);
    else this.book.unassign(trackId);
    this.emit();
  }

  private onEnded = () => {
    if (this.recorder) this.options.onAutoStop();
  };

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const { video, engine, source } = this.options;
    if (video.readyState < 2 || video.paused || video.ended) return;
    if (video.currentTime === this.lastVideoTime) return; // pas de nouvelle image
    this.lastVideoTime = video.currentTime;

    // MediaPipe exige des horodatages strictement croissants.
    let ts = performance.now();
    if (ts <= this.lastTs) ts = this.lastTs + 0.01;
    this.lastTs = ts;

    let result;
    try {
      result = engine.detectForVideo(video, ts);
    } catch {
      return;
    }
    const samples = result.landmarks.map((points, i) =>
      toPoseSample(points, result.worldLandmarks[i] ?? []),
    );
    const clipT = source === "file" ? video.currentTime * 1000 : ts;
    this.lastClipT = clipT;
    this.poses = this.tracker.update(samples, clipT);
    const reassigned = this.book.observe(clipT, this.poses);
    this.recorder?.add(clipT - this.recordStart, this.poses);
    this.draw();

    this.frames++;
    const now = performance.now();
    const secondElapsed = now - this.since >= 1000;
    if (secondElapsed) {
      this.fps = Math.round((this.frames * 1000) / (now - this.since));
      this.frames = 0;
      this.since = now;
    }
    if (secondElapsed || reassigned.length > 0) this.emit();
    if (this.recorder && (clipT - this.recordStart) / 1000 >= MAX_CLIP_SECONDS) {
      this.options.onAutoStop();
    }
  };

  private emit() {
    this.options.onSnapshot({
      fps: this.fps,
      warnings: framingWarnings(this.poses, this.aspect),
      onScreen: this.poses.map((pose) => {
        const assignment = this.book.get(pose.trackId);
        return {
          trackId: pose.trackId,
          athleteId: assignment?.athleteId ?? null,
          auto: assignment?.auto ?? false,
        };
      }),
      recording: this.recorder !== null,
      elapsed: this.recorder ? Math.max(0, (this.lastClipT - this.recordStart) / 1000) : 0,
    });
  }

  private draw() {
    const { canvas, athleteIds, nameOf } = this.options;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFigures(
      ctx,
      canvas.width,
      canvas.height,
      this.poses.map((pose) => {
        const assignment = this.book.get(pose.trackId);
        return {
          sample: pose.sample,
          color: assignment ? colorFor(assignment.athleteId, athleteIds) : UNASSIGNED_COLOR,
          label: assignment
            ? `${nameOf.get(assignment.athleteId) ?? "?"}${assignment.auto ? " ?" : ""}`
            : undefined,
          dashed: assignment?.auto,
          highlight: pose.trackId === this.highlighted,
        };
      }),
    );
  }
}
