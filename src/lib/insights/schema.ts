// Format des recommandations rédigées par le modèle.
//
// Le schéma est construit POUR CHAQUE ATHLÈTE : les clés de métriques citables
// forment une énumération limitée à ses métriques fiables. Avec la sortie
// structurée de l'API, le modèle ne peut donc pas citer une métrique absente,
// et la réponse est revalidée avec ce même schéma côté serveur.

import { z } from "zod";
import type { MetricKey } from "@/lib/metrics/types";

export const EXERCISE_KINDS = ["technique", "physique", "mobilite"] as const;

export function buildInsightSchema(citable: readonly MetricKey[]) {
  if (citable.length === 0) throw new Error("Aucune métrique citable");
  const keys = z.enum(citable as [MetricKey, ...MetricKey[]]);
  // Chaque élément doit s'appuyer sur au moins une métrique (traçabilité).
  const cite = z.array(keys).min(1).max(4);

  return z.object({
    summary: z.string().min(20).max(500),
    strengths: z
      .array(z.object({ title: z.string().min(3).max(90), detail: z.string().min(10).max(350), metrics: cite }))
      .min(1)
      .max(3),
    improvements: z
      .array(
        z.object({
          priority: z.number().int().min(1).max(3),
          title: z.string().min(3).max(90),
          detail: z.string().min(10).max(350),
          metrics: cite,
        }),
      )
      .min(1)
      .max(3),
    exercises: z
      .array(
        z.object({
          kind: z.enum(EXERCISE_KINDS),
          name: z.string().min(3).max(90),
          how: z.string().min(10).max(350),
          dose: z.string().min(2).max(90),
          metrics: cite,
        }),
      )
      .min(2)
      .max(6),
    alerts: z.array(z.object({ signal: z.string().min(10).max(300), metrics: cite })).max(3),
    week_plan: z
      .array(
        z.object({
          day: z.string().min(2).max(30),
          focus: z.string().min(3).max(90),
          content: z.string().min(10).max(300),
        }),
      )
      .min(3)
      .max(5),
    /** Métriques citées dont la fiabilité est « à confirmer » : signalées comme telles à l'écran. */
    to_confirm: z.array(keys).max(citable.length),
    /** Ce qui est fiable, ce qui ne l'est pas, ce qui n'a pas pu être mesuré. */
    reliability: z.string().min(20).max(600),
  });
}

export type Insight = z.infer<ReturnType<typeof buildInsightSchema>>;

/** Ce qui est enregistré en base dans `insights.content`. */
export type StoredInsight = Insight & {
  /** « claude » = rédigé par le modèle ; « rules » = mode démonstration sans IA ; « insufficient » = pas assez de données. */
  source: "claude" | "rules" | "insufficient";
  model?: string;
};
