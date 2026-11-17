// Rédaction des recommandations : appel à l'API Claude avec sortie JSON
// structurée, contrôles métier, une seconde tentative si besoin.
// Sans clé API, bascule sur le mode démonstration (règles, sans IA).

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildContext, type InsightInput } from "./context";
import { insufficientInsight, mockInsight } from "./mock";
import { retryMessage, SYSTEM_PROMPT, userMessage } from "./prompt";
import { buildInsightSchema, type StoredInsight } from "./schema";
import { checkInsight } from "./validate";

/**
 * Haiku 5.5 par défaut : choix validé au lancement du projet pour le coût
 * (environ 0,2 centime par athlète). Réglable avec ANTHROPIC_MODEL, par
 * exemple `claude-opus-5-5` pour une rédaction plus fine.
 */
export const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_ATTEMPTS = 2;

/** Sous-ensemble du client Anthropic utilisé ici (remplaçable dans les tests). */
export type MessagesClient = Pick<Anthropic["messages"], "parse">;

export class InsightError extends Error {
  constructor(
    message: string,
    readonly reason: "refusal" | "invalid" | "api",
  ) {
    super(message);
  }
}

export function insightsMode(): "claude" | "rules" {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "rules";
}

export async function generateInsight(
  input: InsightInput,
  options: { client?: MessagesClient; model?: string; mode?: "claude" | "rules" } = {},
): Promise<StoredInsight> {
  const { context, citable, toConfirm, flagged } = buildContext(input);
  const rules = { citable, toConfirm, flagged };

  // Rien de fiable à dire : on ne paie pas un appel pour inventer.
  if (citable.length === 0) return { ...insufficientInsight(context), source: "insufficient" };

  const mode = options.mode ?? insightsMode();
  if (mode === "rules") {
    const insight = mockInsight(context);
    const problems = checkInsight(insight, rules);
    if (problems.length > 0) throw new InsightError(problems.join(" "), "invalid");
    return { ...insight, source: "rules" };
  }

  const client = options.client ?? new Anthropic().messages;
  // `||` et non `??` : une variable laissée vide dans .env vaut "" et doit retomber sur le défaut.
  const model = options.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const schema = buildInsightSchema(citable);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage(context) }];
  let problems: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await client.parse({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages,
        output_config: { format: zodOutputFormat(schema), effort: "medium" },
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new InsightError(`API Claude : ${error.status ?? ""} ${error.message}`, "api");
      }
      // Réponse non conforme au schéma : on retente avec l'explication.
      problems = [error instanceof Error ? error.message : String(error)];
      messages.push({ role: "user", content: retryMessage(problems) });
      continue;
    }

    if (response.stop_reason === "refusal") {
      throw new InsightError("Le modèle a refusé de rédiger ces retours.", "refusal");
    }
    const insight = response.parsed_output;
    if (!insight) {
      problems = [`Réponse incomplète (arrêt : ${response.stop_reason}).`];
      messages.push({ role: "user", content: retryMessage(problems) });
      continue;
    }
    problems = checkInsight(insight, rules);
    if (problems.length === 0) return { ...insight, source: "claude", model };
    messages.push({ role: "user", content: retryMessage(problems) });
  }

  throw new InsightError(`Retours refusés après ${MAX_ATTEMPTS} essais : ${problems.join(" ")}`, "invalid");
}
