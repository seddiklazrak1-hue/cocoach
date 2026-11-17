// Contrôles après la validation du schéma : règles métier que le format JSON
// seul ne garantit pas. Chaque problème trouvé est renvoyé au modèle pour une
// seconde tentative ; s'il persiste, la recommandation est refusée.

import type { MetricKey } from "@/lib/metrics/types";
import type { Insight } from "./schema";

export type ValidationRules = {
  citable: readonly MetricKey[];
  toConfirm: readonly MetricKey[];
  flagged: readonly MetricKey[];
};

/**
 * Vocabulaire médical interdit : l'app n'est pas un dispositif médical, elle
 * ne nomme ni blessure ni pathologie, elle signale des points à vérifier.
 */
const MEDICAL = /\b(diagnosti\w*|pathologi\w*|tendinite\w*|entorses?|d[ée]chirures?|l[ée]sions?|fractures?|hernies?|arthrose|syndromes?|prescri\w*|traitements?\s+m[ée]dica\w*)\b/i;

/** Pas de note chiffrée ni de jugement humiliant : les retours sont orientés progression. */
const SCORE = /\b\d+(?:[.,]\d+)?\s*\/\s*(?:5|10|20|100)\b/;
const HUMILIATING = /\b(nul(?:le)?s?|m[ée]diocres?|catastrophiques?|path[ée]tiques?|lamentables?|incapables?)\b/i;

function texts(insight: Insight): string[] {
  return [
    insight.summary,
    insight.reliability,
    ...insight.strengths.flatMap((s) => [s.title, s.detail]),
    ...insight.improvements.flatMap((s) => [s.title, s.detail]),
    ...insight.exercises.flatMap((e) => [e.name, e.how, e.dose]),
    ...insight.alerts.map((a) => a.signal),
    ...insight.week_plan.flatMap((d) => [d.day, d.focus, d.content]),
  ];
}

export function citedKeys(insight: Insight): MetricKey[] {
  return [
    ...new Set([
      ...insight.strengths.flatMap((s) => s.metrics),
      ...insight.improvements.flatMap((s) => s.metrics),
      ...insight.exercises.flatMap((e) => e.metrics),
      ...insight.alerts.flatMap((a) => a.metrics),
    ]),
  ];
}

/** Renvoie la liste des problèmes (vide si la recommandation est acceptable). */
export function checkInsight(insight: Insight, rules: ValidationRules): string[] {
  const problems: string[] = [];
  const citable = new Set(rules.citable);
  const flagged = new Set(rules.flagged);
  const cited = citedKeys(insight);

  // 1. Traçabilité : seules les métriques fournies et fiables peuvent être citées.
  for (const key of [...cited, ...insight.to_confirm]) {
    if (!citable.has(key)) problems.push(`Métrique citée absente ou non fiable : ${key}`);
  }

  // 2. Fiabilité : toute métrique citée « à confirmer » doit être signalée comme telle.
  const declared = new Set(insight.to_confirm);
  for (const key of rules.toConfirm) {
    if (cited.includes(key) && !declared.has(key)) {
      problems.push(`Métrique « à confirmer » citée sans être signalée dans to_confirm : ${key}`);
    }
  }

  // 3. Alertes : uniquement sur des métriques signalées « à surveiller ».
  for (const alert of insight.alerts) {
    for (const key of alert.metrics) {
      if (!flagged.has(key)) problems.push(`Alerte sur une métrique non signalée : ${key}`);
    }
  }

  // 4. Priorités des axes d'amélioration : 1, 2, 3 sans doublon.
  const priorities = insight.improvements.map((i) => i.priority).sort();
  if (priorities.some((p, i) => p !== i + 1)) {
    problems.push("Les priorités des axes d'amélioration doivent être 1, 2, 3 sans doublon.");
  }

  // 5. Ton : ni vocabulaire médical, ni note chiffrée, ni jugement humiliant.
  for (const text of texts(insight)) {
    const medical = text.match(MEDICAL);
    if (medical) problems.push(`Vocabulaire médical interdit (« ${medical[0]} ») : signaler un point à vérifier, sans nommer de blessure.`);
    if (SCORE.test(text)) problems.push("Pas de note chiffrée sur l'athlète.");
    const harsh = text.match(HUMILIATING);
    if (harsh) problems.push(`Formulation dévalorisante interdite (« ${harsh[0]} »).`);
  }

  return [...new Set(problems)];
}
