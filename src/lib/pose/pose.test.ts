import { describe, expect, it } from "vitest";
import { decodeSeries, encodeSeries, packSeries, unpackSeries } from "./codec";
import {
  reassignSegment,
  segmentsAt,
  splitSegment,
  swapAthletesFrom,
} from "./edits";
import { IdentityBook } from "./identity";
import { K, LM, MEDIAPIPE_INDICES, toPoseSample, type PoseSample } from "./landmarks";
import {
  athleteIdsIn,
  ClipRecorder,
  recordingFromSeries,
  seriesForAthlete,
  seriesStats,
  type Recording,
} from "./recording";
import { seededRandom, syntheticPose } from "./synthetic";
import { iou, PoseTracker, type TrackedPose } from "./tracker";

const ASPECT = 16 / 9;
const pose = (cx: number, t = 0, extra: Partial<Parameters<typeof syntheticPose>[0]> = {}) =>
  syntheticPose({ cx, cy: 0.55, t, aspect: ASPECT, ...extra });

describe("landmarks", () => {
  it("garde 25 points sur les 33 de MediaPipe, sans les yeux ni la bouche", () => {
    expect(K).toBe(25);
    expect(MEDIAPIPE_INDICES).toHaveLength(25);
    for (const face of [1, 2, 3, 4, 5, 6, 9, 10]) {
      expect(MEDIAPIPE_INDICES).not.toContain(face);
    }
  });

  it("convertit une pose MediaPipe en échantillon compact", () => {
    const raw = Array.from({ length: 33 }, (_, i) => ({
      x: i / 100,
      y: i / 50,
      z: 0,
      visibility: 0.5,
    }));
    const sample = toPoseSample(raw, raw);
    // Genou gauche = point 25 de MediaPipe.
    expect(sample.xy[LM.leftKnee * 2]).toBeCloseTo(0.25);
    expect(sample.xy[LM.leftKnee * 2 + 1]).toBeCloseTo(0.5);
    expect(sample.vis[LM.leftKnee]).toBeCloseTo(0.5);
    expect(sample.world[LM.leftKnee * 3]).toBeCloseTo(0.25);
  });
});

describe("PoseTracker", () => {
  const ids = (tracked: TrackedPose[]) => tracked.map((p) => p.trackId);

  it("garde le même numéro pour deux personnes immobiles, même si l'ordre des détections change", () => {
    const tracker = new PoseTracker({ aspect: ASPECT });
    const first = tracker.update([pose(0.3), pose(0.7)], 0);
    expect(ids(first)).toEqual([1, 2]);
    // Ordre inversé à l'image suivante.
    const second = tracker.update([pose(0.7, 0.03), pose(0.3, 0.03)], 33);
    expect(ids(second)).toEqual([2, 1]);
  });

  it("suit deux personnes qui se déplacent", () => {
    const tracker = new PoseTracker({ aspect: ASPECT });
    let last: TrackedPose[] = [];
    for (let f = 0; f < 60; f++) {
      const t = f / 30;
      // A va de 0,2 à 0,4 ; B va de 0,8 à 0,6 : ils se rapprochent sans se croiser.
      last = tracker.update([pose(0.2 + 0.1 * t, t), pose(0.8 - 0.1 * t, t)], f * 33);
    }
    expect(ids(last)).toEqual([1, 2]);
  });

  it("retrouve une personne après une occlusion brève, pas après une longue", () => {
    const tracker = new PoseTracker({ aspect: ASPECT, maxLostMs: 800 });
    tracker.update([pose(0.3), pose(0.7)], 0);
    // B masqué pendant 400 ms.
    tracker.update([pose(0.3)], 200);
    tracker.update([pose(0.3)], 400);
    expect(ids(tracker.update([pose(0.3), pose(0.7)], 600))).toEqual([1, 2]);
    // B masqué pendant 2 s : la piste est abandonnée, il reçoit un nouveau numéro.
    tracker.update([pose(0.3)], 1600);
    tracker.update([pose(0.3)], 2600);
    expect(ids(tracker.update([pose(0.3), pose(0.7)], 2700))).toEqual([1, 3]);
  });

  it("ouvre une nouvelle piste pour une personne qui entre dans le cadre", () => {
    const tracker = new PoseTracker({ aspect: ASPECT });
    tracker.update([pose(0.25), pose(0.5)], 0);
    expect(ids(tracker.update([pose(0.25), pose(0.5), pose(0.8)], 33))).toEqual([
      1, 2, 3,
    ]);
  });

  it("ne confond pas quelqu'un qui apparaît loin avec une piste existante", () => {
    const tracker = new PoseTracker({ aspect: ASPECT });
    tracker.update([pose(0.15)], 0);
    // La personne de gauche disparaît, une autre apparaît à l'opposé.
    expect(ids(tracker.update([pose(0.85)], 33))).toEqual([2]);
  });

  it("calcule le recouvrement de deux boîtes", () => {
    const a = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { minX: 1, minY: 0, maxX: 3, maxY: 2 })).toBeCloseTo(1 / 3);
    expect(iou(a, { minX: 5, minY: 5, maxX: 6, maxY: 6 })).toBe(0);
  });
});

describe("IdentityBook", () => {
  /** Fait tourner tracker + carnet sur une suite d'images. */
  function run(
    book: IdentityBook,
    tracker: PoseTracker,
    frames: Array<{ t: number; xs: number[] }>,
  ) {
    let tracked: TrackedPose[] = [];
    for (const frame of frames) {
      tracked = tracker.update(
        frame.xs.map((x) => pose(x, frame.t / 1000)),
        frame.t,
      );
      book.observe(frame.t, tracked);
    }
    return tracked;
  }

  it("réattribue automatiquement un athlète après une occlusion, en le signalant", () => {
    const book = new IdentityBook();
    const tracker = new PoseTracker({ aspect: ASPECT, maxLostMs: 300 });
    run(book, tracker, [{ t: 0, xs: [0.3, 0.7] }]);
    book.assign(1, "sami");
    book.assign(2, "lina");

    // Lina masquée 1,5 s (la piste 2 est abandonnée), puis réapparaît au même endroit.
    const tracked = run(book, tracker, [
      { t: 100, xs: [0.3, 0.7] },
      { t: 800, xs: [0.3] },
      { t: 1600, xs: [0.3] },
      { t: 1700, xs: [0.3, 0.71] },
    ]);
    const newTrack = tracked[1].trackId;
    expect(newTrack).not.toBe(2);
    expect(book.get(newTrack)).toEqual({ athleteId: "lina", auto: true });
    expect(book.get(1)).toEqual({ athleteId: "sami", auto: false });
  });

  it("ne réattribue rien si c'est ambigu, trop tard ou trop loin", () => {
    // Ambigu : deux athlètes perdus au même endroit.
    const ambiguous = new IdentityBook();
    const trackerA = new PoseTracker({ aspect: ASPECT, maxLostMs: 300 });
    run(ambiguous, trackerA, [{ t: 0, xs: [0.48, 0.52] }]);
    ambiguous.assign(1, "sami");
    ambiguous.assign(2, "lina");
    const a = run(ambiguous, trackerA, [
      { t: 100, xs: [0.48, 0.52] },
      { t: 1000, xs: [] },
      { t: 1100, xs: [0.5] },
    ]);
    expect(ambiguous.get(a[0].trackId)).toBeUndefined();

    // Trop tard : réapparition après 6 s.
    const late = new IdentityBook();
    const trackerB = new PoseTracker({ aspect: ASPECT, maxLostMs: 300 });
    run(late, trackerB, [{ t: 0, xs: [0.5] }]);
    late.assign(1, "sami");
    const b = run(late, trackerB, [
      { t: 100, xs: [0.5] },
      { t: 3000, xs: [] },
      { t: 6200, xs: [0.5] },
    ]);
    expect(late.get(b[0].trackId)).toBeUndefined();

    // Trop loin : réapparition à l'autre bout de l'image.
    const far = new IdentityBook();
    const trackerC = new PoseTracker({ aspect: ASPECT, maxLostMs: 300 });
    run(far, trackerC, [{ t: 0, xs: [0.15] }]);
    far.assign(1, "sami");
    const c = run(far, trackerC, [
      { t: 100, xs: [0.15] },
      { t: 1000, xs: [] },
      { t: 1100, xs: [0.85] },
    ]);
    expect(far.get(c[0].trackId)).toBeUndefined();
  });

  it("un athlète réassigné à une autre piste visible quitte la première", () => {
    const book = new IdentityBook();
    const tracker = new PoseTracker({ aspect: ASPECT });
    run(book, tracker, [{ t: 0, xs: [0.3, 0.7] }]);
    book.assign(1, "sami");
    book.assign(2, "sami"); // le coach s'est trompé de squelette, il corrige
    expect(book.get(1)).toBeUndefined();
    expect(book.get(2)).toEqual({ athleteId: "sami", auto: false });
  });
});

describe("ClipRecorder", () => {
  function record(seconds: number, fps: number, gapFromTo?: [number, number]) {
    const tracker = new PoseTracker({ aspect: ASPECT, maxLostMs: 800 });
    const recorder = new ClipRecorder({ aspect: ASPECT, startedAt: "2026-11-17T10:00:00Z" });
    for (let f = 0; f < seconds * fps; f++) {
      const tMs = (f * 1000) / fps;
      const second = !gapFromTo || tMs < gapFromTo[0] || tMs >= gapFromTo[1];
      const samples = second
        ? [pose(0.3, tMs / 1000), pose(0.7, tMs / 1000)]
        : [pose(0.3, tMs / 1000)];
      recorder.add(tMs, tracker.update(samples, tMs));
    }
    return recorder;
  }

  it("range une détection à 30 images/s dans des cases à 10 Hz", () => {
    const recording = record(3, 30).finish(new Map());
    expect(recording.frameCount).toBe(30);
    expect(recording.segments).toHaveLength(2);
    for (const segment of recording.segments) {
      expect(segment.start).toBe(0);
      expect(segment.frames).toHaveLength(30);
      expect(segment.frames.every((frame) => frame !== null)).toBe(true);
      expect(segment.athleteId).toBeNull();
    }
  });

  it("laisse des cases vides quand la détection est plus lente que la cadence", () => {
    const recording = record(2, 5).finish(new Map());
    const [segment] = recording.segments;
    expect(segment.frames.filter(Boolean)).toHaveLength(10);
    expect(segment.frames[1]).toBeNull();
  });

  it("marque l'absence pendant une occlusion brève, sans couper le segment", () => {
    const recording = record(3, 30, [1000, 1500]).finish(new Map());
    expect(recording.segments).toHaveLength(2);
    const occluded = recording.segments[1];
    expect(occluded.frames[9]).not.toBeNull();
    expect(occluded.frames[12]).toBeNull();
    expect(occluded.frames[16]).not.toBeNull();
  });

  it("applique les assignations et ne retient que les athlètes désignés", () => {
    const recording = record(2, 30).finish(
      new Map([[1, { athleteId: "sami", auto: false }]]),
    );
    expect(athleteIdsIn(recording)).toEqual(["sami"]);
    const series = seriesForAthlete(recording, "sami");
    expect(series).toHaveLength(20);
    expect(seriesStats(series)).toMatchObject({ presentCount: 20, coverage: 1 });
    expect(seriesStats(series).meanConfidence).toBeCloseTo(0.95, 2);
  });
});

describe("corrections dans le replay", () => {
  /** Deux athlètes, 20 images : A à gauche (x = 0,3), B à droite (x = 0,7). */
  function twoAthletes(): Recording {
    const frames = (cx: number) =>
      Array.from({ length: 20 }, (_, f) => pose(cx, f / 10) as PoseSample | null);
    return recordingFromSeries(
      { sampleRateHz: 10, frameCount: 20, aspect: ASPECT, startedAt: "2026-11-17T10:00:00Z" },
      [
        { athleteId: "A", frames: frames(0.3) },
        { athleteId: "B", frames: frames(0.7) },
      ],
    );
  }
  const hipX = (sample: PoseSample | null) => sample!.xy[LM.leftHip * 2];

  it("coupe un segment en deux sans perdre d'image", () => {
    const split = splitSegment(twoAthletes(), "a-A", 8);
    const parts = split.segments.filter((s) => s.athleteId === "A");
    expect(parts.map((s) => [s.start, s.frames.length])).toEqual([
      [0, 8],
      [8, 12],
    ]);
    expect(seriesForAthlete(split, "A").filter(Boolean)).toHaveLength(20);
    // Couper hors du segment ne change rien.
    expect(splitSegment(twoAthletes(), "a-A", 0).segments).toHaveLength(2);
    expect(splitSegment(twoAthletes(), "a-A", 99).segments).toHaveLength(2);
  });

  it("échange deux athlètes à partir d'un instant, sans toucher à ce qui précède", () => {
    const original = twoAthletes();
    const fixed = swapAthletesFrom(original, "A", "B", 12);
    const a = seriesForAthlete(fixed, "A");
    const b = seriesForAthlete(fixed, "B");
    // Avant l'image 12 : inchangé.
    expect(hipX(a[11])).toBeLessThan(0.5);
    expect(hipX(b[11])).toBeGreaterThan(0.5);
    // À partir de l'image 12 : échangé.
    expect(hipX(a[12])).toBeGreaterThan(0.5);
    expect(hipX(b[12])).toBeLessThan(0.5);
    expect(a.filter(Boolean)).toHaveLength(20);
    // L'enregistrement d'origine n'est pas modifié.
    expect(original.segments).toHaveLength(2);
    expect(hipX(seriesForAthlete(original, "A")[15])).toBeLessThan(0.5);
  });

  it("deux échanges au même instant s'annulent", () => {
    const twice = swapAthletesFrom(swapAthletesFrom(twoAthletes(), "A", "B", 7), "A", "B", 7);
    expect(hipX(seriesForAthlete(twice, "A")[15])).toBeLessThan(0.5);
    expect(hipX(seriesForAthlete(twice, "B")[15])).toBeGreaterThan(0.5);
  });

  it("retire un segment de l'envoi quand on le désassigne", () => {
    const edited = reassignSegment(twoAthletes(), "a-B", null);
    expect(athleteIdsIn(edited)).toEqual(["A"]);
    expect(segmentsAt(edited, 5)).toHaveLength(2); // toujours dessiné dans le replay
  });
});

describe("codec", () => {
  const meta = { sampleRateHz: 10, aspect: ASPECT, startedAt: "2026-11-17T10:00:00Z" };

  it("restitue les poses à la précision de quantification près", () => {
    const random = seededRandom(1);
    const frames: Array<PoseSample | null> = Array.from({ length: 50 }, (_, f) =>
      f % 7 === 3 ? null : pose(0.2 + f * 0.01, f / 10, { jitter: 0.004, random }),
    );
    const { header, frames: decoded } = decodeSeries(encodeSeries(frames, meta));

    expect(header).toMatchObject({ version: 1, frameCount: 50, sampleRateHz: 10 });
    expect(header.aspect).toBeCloseTo(ASPECT);
    frames.forEach((frame, f) => {
      const back = decoded[f];
      if (!frame) return expect(back).toBeNull();
      for (let i = 0; i < K * 2; i++) {
        expect(Math.abs(back!.xy[i] - frame.xy[i])).toBeLessThan(2e-5);
      }
      for (let i = 0; i < K; i++) {
        expect(Math.abs(back!.vis[i] - frame.vis[i])).toBeLessThan(0.003);
      }
      for (let i = 0; i < K * 3; i++) {
        expect(Math.abs(back!.world[i] - frame.world[i])).toBeLessThan(1e-4);
      }
    });
  });

  it("supporte les coordonnées hors cadre et les valeurs extrêmes", () => {
    const frame = pose(0.5);
    frame.xy[0] = -0.3;
    frame.xy[1] = 1.4;
    frame.world[0] = -3.5;
    frame.world[1] = 3.5;
    const [back] = decodeSeries(encodeSeries([frame], meta)).frames;
    expect(back!.xy[0]).toBeCloseTo(-0.3, 4);
    expect(back!.xy[1]).toBeCloseTo(1.4, 4);
    expect(back!.world[0]).toBeCloseTo(-3.5, 3);
    expect(back!.world[1]).toBeCloseTo(3.5, 3);
  });

  it("refuse un fichier qui n'est pas au bon format", () => {
    expect(() => decodeSeries(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(
      /signature/,
    );
  });

  it("tient sous 1 Mo pour 5 minutes d'un athlète en mouvement, bruit de détection compris", async () => {
    const random = seededRandom(42);
    const frames = Array.from({ length: 5 * 60 * 10 }, (_, f) => {
      const t = f / 10;
      return pose(0.5 + 0.2 * Math.sin(t * 0.4), t, {
        cy: 0.55 + 0.03 * Math.sin(t * 1.3),
        jitter: 0.004, // tremblement typique d'un détecteur de pose
        random,
      });
    });
    const packed = await packSeries(frames, meta);
    const megabytes = packed.length / (1024 * 1024);
    expect(megabytes).toBeLessThan(1);

    const { frames: decoded } = await unpackSeries(packed);
    expect(decoded).toHaveLength(3000);
    expect(decoded[1234]!.xy[LM.nose * 2]).toBeCloseTo(frames[1234].xy[LM.nose * 2], 4);
  });
});
