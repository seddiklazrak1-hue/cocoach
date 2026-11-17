import { describe, expect, it } from "vitest";
import { DEMO_GROUPS, DEMO_PREFIX, demoAnalysis, demoClip } from "./generate";

const athlete = DEMO_GROUPS[0].athletes[0];

describe("données de démonstration", () => {
  it("contient trois groupes, douze athlètes, dont un mineur avec accord parental", () => {
    const all = DEMO_GROUPS.flatMap((g) => g.athletes);
    expect(DEMO_GROUPS).toHaveLength(3);
    expect(all).toHaveLength(12);
    expect(all.filter((a) => a.consent === "minor_parental_confirmed")).toHaveLength(1);
  });

  it("préfixe chaque nom de groupe et d'athlète, pour pouvoir tout effacer sans toucher aux vraies données", () => {
    for (const group of DEMO_GROUPS) {
      expect(group.name.startsWith(DEMO_PREFIX)).toBe(true);
      for (const a of group.athletes) expect(a.name.startsWith(DEMO_PREFIX)).toBe(true);
    }
  });

  it("produit les mêmes images pour la même graine", () => {
    const a = demoClip(athlete.profile, 0, 10, 7);
    const b = demoClip(athlete.profile, 0, 10, 7);
    expect(a.frames.length).toBe(100);
    expect(a.frames[5]?.world).toEqual(b.frames[5]?.world);
  });

  it("laisse quelques images absentes, comme une vraie détection", () => {
    const clip = demoClip(athlete.profile, 0, 60, 3);
    const missing = clip.frames.filter((f) => f === null).length;
    expect(missing).toBeGreaterThan(0);
    expect(missing / clip.frames.length).toBeLessThan(0.1);
  });

  it("passe par le pipeline réel : une analyse exploitable avec des métriques", () => {
    const analysis = demoAnalysis(athlete, DEMO_GROUPS[0].discipline, 0, 11);
    expect(analysis.summary.usableSeconds).toBeGreaterThan(30);
    expect(analysis.metrics.length).toBeGreaterThan(5);
    expect(analysis.metrics.some((m) => m.confidence >= 0.4)).toBe(true);
  });
});
