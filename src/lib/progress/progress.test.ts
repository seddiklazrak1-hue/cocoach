import { describe, expect, it } from "vitest";
import {
  buildAthleteSeries,
  buildGroupSeries,
  endpoints,
  shortDate,
  type MetricRow,
  type SessionRef,
} from "./domain";

const sessions: SessionRef[] = [
  { id: "s2", date: "2026-11-10" },
  { id: "s1", date: "2026-11-03" },
  { id: "s3", date: "2026-11-17" },
];

function row(overrides: Partial<MetricRow> & Pick<MetricRow, "sessionId" | "key">): MetricRow {
  return {
    athleteId: "a1",
    value: 1,
    unit: "torso",
    confidence: 0.9,
    watch: false,
    ...overrides,
  };
}

describe("buildAthleteSeries", () => {
  it("trie les points par date et range les courbes dans l'ordre des métriques", () => {
    const series = buildAthleteSeries(sessions, [
      row({ sessionId: "s2", key: "guard_height", value: 2 }),
      row({ sessionId: "s1", key: "guard_height", value: 1 }),
      row({ sessionId: "s1", key: "stance_width", value: 3 }),
    ]);
    expect(series.map((s) => s.key)).toEqual(["stance_width", "guard_height"]);
    expect(series[1].points.map((p) => p.date)).toEqual(["2026-11-03", "2026-11-10"]);
    expect(series[1].points.map((p) => p.value)).toEqual([1, 2]);
  });

  it("écarte les mesures sous le seuil de fiabilité et les séances inconnues", () => {
    const series = buildAthleteSeries(sessions, [
      row({ sessionId: "s1", key: "guard_height", confidence: 0.39 }),
      row({ sessionId: "s1", key: "knee_flexion", confidence: 0.4 }),
      row({ sessionId: "inconnue", key: "knee_flexion" }),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe("knee_flexion");
    expect(series[0].points).toHaveLength(1);
  });

  it("garde le signal « à surveiller » sur chaque point", () => {
    const [series] = buildAthleteSeries(sessions, [
      row({ sessionId: "s1", key: "knee_valgus", unit: "leg", watch: true }),
    ]);
    expect(series.points[0].watch).toBe(true);
  });

  it("renvoie une liste vide sans mesure", () => {
    expect(buildAthleteSeries(sessions, [])).toEqual([]);
  });
});

describe("buildGroupSeries", () => {
  it("moyenne seulement les mesures fiables (0,7 et plus)", () => {
    const { series } = buildGroupSeries(sessions, [
      row({ sessionId: "s1", key: "guard_height", athleteId: "a1", value: 2, confidence: 0.9 }),
      row({ sessionId: "s1", key: "guard_height", athleteId: "a2", value: 4, confidence: 0.8 }),
      row({ sessionId: "s1", key: "guard_height", athleteId: "a3", value: 100, confidence: 0.5 }),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].points).toEqual([{ sessionId: "s1", date: "2026-11-03", mean: 3, athletes: 2 }]);
  });

  it("ne compte comme analysé que l'athlète au-dessus du seuil de confiance", () => {
    const { sessions: summaries } = buildGroupSeries(sessions, [
      row({ sessionId: "s1", key: "guard_height", athleteId: "a1", confidence: 0.5 }),
      row({ sessionId: "s1", key: "knee_valgus", athleteId: "a2", confidence: 0.9, watch: true }),
      row({ sessionId: "s1", key: "knee_valgus", athleteId: "a2", confidence: 0.9, watch: true }),
      row({ sessionId: "s1", key: "knee_valgus", athleteId: "a3", confidence: 0.2, watch: true }),
    ]);
    const s1 = summaries.find((s) => s.sessionId === "s1");
    expect(s1).toEqual({ sessionId: "s1", date: "2026-11-03", analysedAthletes: 2, watchAthletes: 1 });
  });

  it("garde une séance sans mesure, avec zéro athlète analysé, et trie par date", () => {
    const { sessions: summaries } = buildGroupSeries(sessions, [
      row({ sessionId: "s2", key: "guard_height" }),
    ]);
    expect(summaries.map((s) => s.sessionId)).toEqual(["s1", "s2", "s3"]);
    expect(summaries[0].analysedAthletes).toBe(0);
    expect(summaries[2].watchAthletes).toBe(0);
  });

  it("ignore les lignes d'une séance inconnue", () => {
    const { series, sessions: summaries } = buildGroupSeries(sessions, [
      row({ sessionId: "inconnue", key: "guard_height" }),
    ]);
    expect(series).toEqual([]);
    expect(summaries.every((s) => s.analysedAthletes === 0)).toBe(true);
  });
});

describe("endpoints", () => {
  it("renvoie null sans point", () => {
    expect(endpoints([])).toBeNull();
  });

  it("donne première, dernière mesure et écart, avec value ou mean", () => {
    expect(endpoints([{ value: 2 }, { value: 5 }])).toEqual({ first: 2, last: 5, delta: 3, count: 2 });
    expect(endpoints([{ mean: 4 }, { mean: 1 }])).toEqual({ first: 4, last: 1, delta: -3, count: 2 });
  });
});

describe("shortDate", () => {
  it("affiche jour et mois", () => {
    expect(shortDate("2026-11-17")).toBe("17/11");
  });
});
