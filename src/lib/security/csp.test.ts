import { describe, expect, it } from "vitest";
import { POSE_MODEL_URL } from "@/components/capture/pose-engine";
import { buildConnectSrc, buildCsp } from "./csp";

const supabaseUrl = "https://abcdefghijklmnopqrst.supabase.co";

/** Reproduit la règle du navigateur pour une origine https simple. */
function allows(sources: string[], url: string) {
  const { origin } = new URL(url);
  return sources.includes(origin);
}

describe("CSP connect-src", () => {
  const sources = buildConnectSrc({ supabaseUrl, dev: false });

  it("autorise Supabase et les fichiers du modèle de pose", () => {
    expect(allows(sources, `${supabaseUrl}/storage/v1/object/pose-series/x.bin`)).toBe(true);
    expect(allows(sources, POSE_MODEL_URL)).toBe(true);
    expect(allows(sources, "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm/x.wasm")).toBe(true);
  });

  it("bloque les statistiques d'usage envoyées par MediaPipe", () => {
    expect(allows(sources, "https://odml.pa.googleapis.com/v1/log")).toBe(false);
  });

  it("n'ouvre localhost qu'en développement", () => {
    expect(buildCsp({ supabaseUrl, dev: false })).not.toContain("localhost");
    expect(buildCsp({ supabaseUrl, dev: true })).toContain("ws://localhost:*");
  });

  it("reste valide sans Supabase configuré", () => {
    expect(buildCsp({ supabaseUrl: "", dev: false })).toBe(
      "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com",
    );
  });
});
