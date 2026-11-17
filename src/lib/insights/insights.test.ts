/**
 * Recommandations : tous ces tests tournent SANS clé API. Le modèle est
 * remplacé par un faux client qui renvoie des réponses choisies.
 */
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { MetricKey } from "@/lib/metrics/types";
import { buildContext, type InsightInput, type MetricInput } from "./context";
import { DEFAULT_MODEL, generateInsight, insightsMode, InsightError, type MessagesClient } from "./generate";
import { insufficientInsight, mockInsight } from "./mock";
import { retryMessage, SYSTEM_PROMPT, userMessage } from "./prompt";
import { buildInsightSchema, type Insight } from "./schema";
import { checkInsight, citedKeys } from "./validate";

const metric = (
  key: MetricKey,
  confidence: number,
  extra: Partial<MetricInput> = {},
): MetricInput => ({
  key,
  category: "technique",
  value: 120,
  unit: "deg",
  confidence,
  details: { usedFrames: 300, presentFrames: 300, quality: confidence },
  ...extra,
});

function input(metrics: MetricInput[], birthDate: string | null = "1999-03-14"): InsightInput {
  return {
    athlete: { level: "intermediate", birthDate },
    discipline: "boxing",
    session: { kind: "sparring", durationMin: 60 },
    analysis: { usableSeconds: 312.4, notes: ["depth_estimated"], missing: ["level_changes"] },
    metrics,
  };
}

const STANDARD = input([
  metric("knee_flexion", 0.85),
  metric("guard_height", 0.82, { unit: "torso", value: -0.12 }),
  metric("intensity", 0.55, { category: "physical", unit: "m_s", value: 0.84 }),
  metric("knee_valgus", 0.72, {
    category: "injury_prevention",
    unit: "leg",
    value: 0.11,
    details: { usedFrames: 120, presentFrames: 300, quality: 0.8, flag: "watch", threshold: 0.08, left: 0.11, right: 0.03 },
  }),
  metric("asymmetry", 0.2, { category: "injury_prevention", unit: "percent", value: 40 }),
]);

/** Une réponse conforme pour STANDARD, modifiable test par test. */
function validInsight(): Insight {
  return {
    summary: "Belle séance de sparring : ta garde et tes appuis sont réguliers.",
    strengths: [{ title: "Genoux bien fléchis", detail: "Environ 120° de flexion : une garde stable.", metrics: ["knee_flexion"] }],
    improvements: [
      { priority: 1, title: "Genou gauche qui rentre", detail: "À travailler en douceur sur les flexions.", metrics: ["knee_valgus"] },
      { priority: 2, title: "Garder les mains hautes", detail: "Ta garde descend un peu sous les épaules.", metrics: ["guard_height"] },
    ],
    exercises: [
      { kind: "physique", name: "Squats avec élastique", how: "Genoux poussés vers l'extérieur, lentement.", dose: "3 × 12", metrics: ["knee_valgus"] },
      { kind: "technique", name: "Shadow garde haute", how: "Poings à hauteur des pommettes tout le round.", dose: "3 × 2 min", metrics: ["guard_height"] },
    ],
    alerts: [{ signal: "Genou gauche qui rentre en flexion : à faire vérifier par un kiné.", metrics: ["knee_valgus"] }],
    week_plan: [
      { day: "Séance 1", focus: "Technique", content: "Shadow garde haute et déplacements." },
      { day: "Séance 2", focus: "Physique", content: "Squats avec élastique et gainage." },
      { day: "Séance 3", focus: "Sparring léger", content: "Mise en situation en gardant les mains hautes." },
    ],
    to_confirm: [],
    reliability: "Mesures fiables sur les genoux et la garde ; l'asymétrie n'a pas pu être mesurée de façon fiable.",
  };
}

describe("contexte envoyé au modèle", () => {
  const { context, citable, toConfirm, flagged } = buildContext(STANDARD);
  const sent = userMessage(context);

  it("ne contient ni prénom, ni date de naissance, ni identifiant", () => {
    expect(context.athlete.code).toBe("Athlète A");
    expect(sent).not.toContain("1999");
    expect(sent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(Object.keys(context.athlete).sort()).toEqual(["age_group", "code", "discipline", "level"]);
    expect(context.athlete.age_group).toBe("adulte");
    expect(buildContext(input([metric("knee_flexion", 0.9)], "2013-01-01")).context.athlete.age_group).toBe("mineur");
    expect(buildContext(input([metric("knee_flexion", 0.9)], null)).context.athlete.age_group).toBe("inconnu");
  });

  it("transmet des valeurs déjà formatées : le modèle ne calcule rien", () => {
    const knee = context.metrics.find((m) => m.key === "knee_flexion")!;
    expect(knee.value).toBe("≈ 120°");
    expect(context.metrics.find((m) => m.key === "knee_valgus")!.sides).toBe("gauche 11 % de la jambe · droite 3 % de la jambe");
    expect(context.session).toEqual({ type: "Sparring", planned_minutes: 60, analysed_seconds: 312 });
  });

  it("écarte les mesures peu fiables et marque celles à confirmer", () => {
    expect(citable).toEqual(["knee_flexion", "guard_height", "intensity", "knee_valgus"]);
    expect(context.unreliable_metrics).toEqual(["Asymétrie gauche/droite"]);
    expect(sent).not.toContain("40 %"); // la valeur d'une mesure peu fiable n'est jamais envoyée
    expect(toConfirm).toEqual(["intensity"]);
    expect(context.metrics.find((m) => m.key === "intensity")!.reliability).toBe("à confirmer");
    expect(flagged).toEqual(["knee_valgus"]);
    expect(context.not_measurable).toEqual(["Changements de niveau"]);
  });
});

describe("schéma de sortie", () => {
  const schema = buildInsightSchema(["knee_flexion", "guard_height", "intensity", "knee_valgus"]);

  it("accepte une réponse conforme", () => {
    expect(schema.safeParse(validInsight()).success).toBe(true);
  });

  it("rejette la citation d'une métrique inexistante ou absente pour cet athlète", () => {
    const invented = validInsight();
    invented.strengths[0].metrics = ["vo2max" as MetricKey];
    expect(schema.safeParse(invented).success).toBe(false);
    const other = validInsight();
    other.strengths[0].metrics = ["strike_rate"];
    expect(schema.safeParse(other).success).toBe(false);
  });

  it("exige que chaque conseil cite au moins une métrique", () => {
    const uncited = validInsight();
    uncited.exercises[0].metrics = [];
    expect(schema.safeParse(uncited).success).toBe(false);
  });

  it("refuse de construire un schéma sans aucune métrique citable", () => {
    expect(() => buildInsightSchema([])).toThrow();
  });
});

describe("contrôles métier", () => {
  const { citable, toConfirm, flagged } = buildContext(STANDARD);
  const rules = { citable, toConfirm, flagged };

  it("accepte une réponse conforme", () => {
    expect(checkInsight(validInsight(), rules)).toEqual([]);
    expect(citedKeys(validInsight()).sort()).toEqual(["guard_height", "knee_flexion", "knee_valgus"]);
  });

  it("rejette une métrique non fiable ou absente", () => {
    const bad = validInsight();
    bad.strengths[0].metrics = ["asymmetry"];
    expect(checkInsight(bad, rules).join()).toContain("asymmetry");
  });

  it("exige de signaler une mesure « à confirmer » qui est citée", () => {
    const bad = validInsight();
    bad.strengths.push({ title: "Bonne intensité", detail: "Tu bouges beaucoup sur la séance.", metrics: ["intensity"] });
    expect(checkInsight(bad, rules).join()).toContain("to_confirm");
    bad.to_confirm = ["intensity"];
    expect(checkInsight(bad, rules)).toEqual([]);
  });

  it("refuse une alerte sur une métrique non signalée", () => {
    const bad = validInsight();
    bad.alerts.push({ signal: "Garde basse à surveiller de près.", metrics: ["guard_height"] });
    expect(checkInsight(bad, rules).join()).toContain("guard_height");
  });

  it("refuse des priorités en double", () => {
    const bad = validInsight();
    bad.improvements[1].priority = 1;
    expect(checkInsight(bad, rules).join()).toContain("priorités");
  });

  it.each([
    ["un diagnostic", "Cela ressemble à une tendinite du genou."],
    ["un diagnostic", "Ce diagnostic suggère une fragilité."],
    ["une note chiffrée", "Garde : 6/10, peut mieux faire."],
    ["un jugement humiliant", "Ta garde est nulle sur ce round."],
  ])("refuse %s", (_label, text) => {
    const bad = validInsight();
    bad.summary = text;
    expect(checkInsight(bad, rules).length).toBeGreaterThan(0);
  });
});

describe("mode démonstration (sans IA)", () => {
  it.each([
    ["séance standard", STANDARD],
    ["une seule mesure", input([metric("trunk_lean", 0.9)])],
    ["mineur avec signal", input([metric("knee_valgus", 0.8, { details: { usedFrames: 200, presentFrames: 200, quality: 0.8, flag: "watch" } })], "2013-06-01")],
    ["tout à confirmer", input([metric("intensity", 0.5), metric("guard_height", 0.45)])],
  ])("produit des retours conformes : %s", (_label, data) => {
    const { context, citable, toConfirm, flagged } = buildContext(data);
    const insight = mockInsight(context);
    expect(buildInsightSchema(citable).safeParse(insight).success).toBe(true);
    expect(checkInsight(insight, { citable, toConfirm, flagged })).toEqual([]);
    expect(insight.alerts.length).toBe(flagged.length);
  });

  it("adapte la charge pour un mineur et le dit", () => {
    const { context } = buildContext(input([metric("knee_flexion", 0.9)], "2013-06-01"));
    expect(mockInsight(context).week_plan[1].content).toContain("sans charge lourde");
  });

  it("explique quand rien n'est assez fiable", () => {
    const { context } = buildContext(input([metric("asymmetry", 0.1)]));
    const insight = insufficientInsight(context);
    expect(insight.strengths).toEqual([]);
    expect(insight.reliability).toContain("Asymétrie");
  });
});

describe("rédaction par le modèle (faux client)", () => {
  type ParseParams = Parameters<MessagesClient["parse"]>[0];
  const response = (parsed: unknown, stop_reason = "end_turn") => ({ parsed_output: parsed, stop_reason, content: [] });

  function fakeClient(...answers: Array<unknown | Error>) {
    const calls: ParseParams[] = [];
    const parse = vi.fn(async (params: ParseParams) => {
      // Copie superficielle : le format de sortie contient une fonction (non clonable).
      calls.push({ ...params, messages: [...params.messages] });
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next;
    });
    return { client: { parse } as unknown as MessagesClient, calls, parse };
  }

  it("bascule en mode démonstration sans clé API", async () => {
    const previous = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(insightsMode()).toBe("rules");
    const insight = await generateInsight(STANDARD);
    expect(insight.source).toBe("rules");
    if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous;
  });

  it("n'appelle pas le modèle quand aucune mesure n'est fiable", async () => {
    const { client, parse } = fakeClient();
    const insight = await generateInsight(input([metric("asymmetry", 0.2)]), { client, mode: "claude" });
    expect(insight.source).toBe("insufficient");
    expect(parse).not.toHaveBeenCalled();
  });

  it("envoie une requête conforme : Haiku 5.5, sortie JSON structurée, sans température ni données personnelles", async () => {
    const { client, calls } = fakeClient(response(validInsight()));
    const insight = await generateInsight(STANDARD, { client, mode: "claude" });
    expect(insight).toMatchObject({ source: "claude", model: DEFAULT_MODEL });
    const [request] = calls;
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.system).toBe(SYSTEM_PROMPT);
    expect(request).not.toHaveProperty("temperature");
    expect(request.output_config?.format?.type).toBe("json_schema");
    expect(JSON.stringify(request.messages)).not.toContain("1999");
  });

  it("retente une fois en expliquant les problèmes, puis accepte la réponse corrigée", async () => {
    const wrong = validInsight();
    wrong.alerts.push({ signal: "Garde basse : attention à toi.", metrics: ["guard_height"] });
    const { client, calls } = fakeClient(response(wrong), response(validInsight()));
    const insight = await generateInsight(STANDARD, { client, mode: "claude" });
    expect(insight.source).toBe("claude");
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls[1].messages)).toContain("refusée");
    expect(retryMessage(["X"])).toContain("- X");
  });

  it("retente aussi quand la réponse ne respecte pas le schéma", async () => {
    const { client, calls } = fakeClient(new Anthropic.AnthropicError("Failed to parse structured output"), response(validInsight()));
    expect((await generateInsight(STANDARD, { client, mode: "claude" })).source).toBe("claude");
    expect(calls).toHaveLength(2);
  });

  it("refuse après deux réponses non conformes", async () => {
    const wrong = validInsight();
    wrong.summary = "Ta garde est catastrophique, rien ne va dans cette séance.";
    const { client } = fakeClient(response(wrong), response(wrong));
    await expect(generateInsight(STANDARD, { client, mode: "claude" })).rejects.toMatchObject({ reason: "invalid" });
  });

  it("gère un refus du modèle et une réponse tronquée", async () => {
    const refused = fakeClient(response(null, "refusal"));
    await expect(generateInsight(STANDARD, { client: refused.client, mode: "claude" })).rejects.toMatchObject({ reason: "refusal" });
    const truncated = fakeClient(response(null, "max_tokens"), response(null, "max_tokens"));
    await expect(generateInsight(STANDARD, { client: truncated.client, mode: "claude" })).rejects.toBeInstanceOf(InsightError);
  });

  it("remonte une erreur d'API sans retenter", async () => {
    const { client, parse } = fakeClient(new Anthropic.APIError(529, undefined, "Overloaded", new Headers()));
    await expect(generateInsight(STANDARD, { client, mode: "claude" })).rejects.toMatchObject({ reason: "api" });
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it("ignore une variable ANTHROPIC_MODEL laissée vide", async () => {
    const { client, calls } = fakeClient(response(validInsight()));
    process.env.ANTHROPIC_MODEL = "";
    await generateInsight(STANDARD, { client, mode: "claude" });
    delete process.env.ANTHROPIC_MODEL;
    expect(calls[0].model).toBe(DEFAULT_MODEL);
  });

  it("utilise le modèle choisi par ANTHROPIC_MODEL", async () => {
    const { client, calls } = fakeClient(response(validInsight()));
    process.env.ANTHROPIC_MODEL = "claude-opus-5-5";
    await generateInsight(STANDARD, { client, mode: "claude" });
    delete process.env.ANTHROPIC_MODEL;
    expect(calls[0].model).toBe("claude-opus-5-5");
  });
});
