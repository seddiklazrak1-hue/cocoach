import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEDIAPIPE_VERSION } from "@/components/capture/pose-engine";
import { formatClock, formatDuration, groupClips, poseStoragePath } from "@/lib/sessions/domain";
import { clipSchema, sessionSchema } from "@/lib/sessions/schemas";
import { framingWarnings } from "./framing";
import { pickPose } from "./picking";
import { syntheticPose } from "./synthetic";
import { PoseTracker } from "./tracker";

const ASPECT = 16 / 9;
const tracked = (xs: number[], extra: Partial<Parameters<typeof syntheticPose>[0]> = {}) =>
  new PoseTracker({ aspect: ASPECT }).update(
    xs.map((cx) => syntheticPose({ cx, cy: 0.55, aspect: ASPECT, ...extra })),
    0,
  );

describe("framingWarnings", () => {
  it("ne signale rien pour un cadrage correct", () => {
    expect(framingWarnings(tracked([0.3, 0.7]), ASPECT)).toEqual([]);
  });

  it("signale l'absence de personne, la distance, le bord du cadre et la faible fiabilité", () => {
    expect(framingWarnings([], ASPECT)).toEqual(["noPerson"]);
    expect(framingWarnings(tracked([0.5], { height: 0.2 }), ASPECT)).toContain("tooFar");
    expect(framingWarnings(tracked([0.01]), ASPECT)).toContain("edge");
    expect(framingWarnings(tracked([0.5], { visibility: 0.3 }), ASPECT)).toContain("lowConfidence");
  });
});

describe("pickPose", () => {
  const samples = [0.25, 0.75].map((cx) => syntheticPose({ cx, cy: 0.55, aspect: ASPECT }));

  it("trouve le squelette touché, ou le plus proche s'il est assez près", () => {
    expect(pickPose(samples, { x: 0.25, y: 0.5 }, ASPECT)).toBe(0);
    expect(pickPose(samples, { x: 0.75, y: 0.4 }, ASPECT)).toBe(1);
    expect(pickPose(samples, { x: 0.32, y: 0.5 }, ASPECT)).toBe(0);
  });

  it("ne renvoie rien pour un toucher loin de tout le monde", () => {
    expect(pickPose(samples, { x: 0.5, y: 0.05 }, ASPECT)).toBe(-1);
    expect(pickPose([], { x: 0.5, y: 0.5 }, ASPECT)).toBe(-1);
  });
});

describe("séances", () => {
  it("valide une séance et convertit la durée", () => {
    const parsed = sessionSchema.parse({
      groupId: "0b8f6a52-3c1e-4d7a-9f2b-6e5d4c3b2a10",
      date: "2026-11-17",
      kind: "sparring",
      durationMin: "90",
    });
    expect(parsed.durationMin).toBe(90);
    expect(
      sessionSchema.safeParse({ ...parsed, durationMin: "", date: "2026-02-30" }).success,
    ).toBe(false);
  });

  it("refuse une séquence trop longue ou sans athlète", () => {
    const base = {
      sessionId: "0b8f6a52-3c1e-4d7a-9f2b-6e5d4c3b2a10",
      clipId: "5f0c2f4e-6a51-4c0f-9a0e-2b7d0c1e9f11",
      startedAt: new Date().toISOString(),
    };
    const entry = {
      athleteId: "9d3b8c7a-1e2f-4a5b-8c6d-7e8f9a0b1c2d",
      storagePath: "x",
      sampleRateHz: 10,
      frameCount: 100,
      durationS: 10,
      meanConfidence: 0.8,
    };
    expect(clipSchema.safeParse({ ...base, entries: [entry] }).success).toBe(true);
    expect(clipSchema.safeParse({ ...base, entries: [] }).success).toBe(false);
    expect(
      clipSchema.safeParse({ ...base, entries: [{ ...entry, frameCount: 999_999 }] }).success,
    ).toBe(false);
  });

  it("range les fichiers par séquence et formate les durées", () => {
    const row = (clip: string, athlete: string, startedAt: string, duration: number) => ({
      clip_id: clip,
      athlete_id: athlete,
      started_at: startedAt,
      duration_s: duration,
      frame_count: duration * 10,
      mean_confidence: 0.8,
      storage_path: `${clip}/${athlete}`,
    });
    const clips = groupClips([
      row("b", "x", "2026-11-17T10:10:00Z", 30),
      row("a", "x", "2026-11-17T10:00:00Z", 60),
      row("a", "y", "2026-11-17T10:00:00Z", 58),
    ]);
    expect(clips.map((c) => [c.clipId, c.series.length, c.durationS])).toEqual([
      ["a", 2, 60],
      ["b", 1, 30],
    ]);
    expect(formatDuration(245)).toBe("4 min 05 s");
    expect(formatDuration(48)).toBe("48 s");
    expect(formatClock(65)).toBe("1:05");
    expect(poseStoragePath("c", "s", "k", "a")).toBe("c/s/k/a.bin");
  });
});

it("la version de MediaPipe chargée depuis le CDN correspond au paquet installé", () => {
  const installed = JSON.parse(
    readFileSync("node_modules/@mediapipe/tasks-vision/package.json", "utf8"),
  ).version;
  expect(MEDIAPIPE_VERSION).toBe(installed);
});
