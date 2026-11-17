// Mode démonstration (sans clé API) : des retours produits par des règles
// simples à partir des métriques, sans IA. Ils respectent exactement le même
// format et les mêmes contrôles que ceux du modèle, et l'interface indique
// clairement qu'ils ne viennent pas de l'IA.

import { fr } from "@/lib/i18n/fr";
import type { MetricKey } from "@/lib/metrics/types";
import type { InsightContext } from "./context";
import type { Insight } from "./schema";

type Metric = InsightContext["metrics"][number];

/** Exercices de base selon la catégorie de la métrique travaillée. */
const EXERCISES: Partial<Record<MetricKey, { kind: Insight["exercises"][number]["kind"]; name: string; how: string; dose: string }>> = {
  guard_height: {
    kind: "technique",
    name: "Shadow garde haute",
    how: "Shadow boxing en gardant les poings à hauteur des pommettes ; un partenaire signale chaque garde qui baisse.",
    dose: "3 rounds de 2 min",
  },
  knee_flexion: {
    kind: "technique",
    name: "Déplacements genoux fléchis",
    how: "Déplacements avant-arrière et latéraux en gardant les genoux souples, le poids sur l'avant des pieds.",
    dose: "4 × 45 s",
  },
  knee_valgus: {
    kind: "physique",
    name: "Squats avec élastique aux genoux",
    how: "Squats lents avec un mini-élastique au-dessus des genoux, en poussant les genoux vers l'extérieur, dans l'axe des pieds.",
    dose: "3 × 12",
  },
  trunk_flexion: {
    kind: "physique",
    name: "Gainage et charnière de hanche",
    how: "Planche puis « good morning » au bâton pour apprendre à se pencher depuis les hanches, dos neutre.",
    dose: "3 × 30 s + 3 × 10",
  },
  asymmetry: {
    kind: "mobilite",
    name: "Travail unilatéral",
    how: "Fentes et rotations du côté le moins mobile en premier, puis de l'autre côté, sur la même amplitude.",
    dose: "2 × 8 par côté",
  },
  intensity: {
    kind: "physique",
    name: "Intervalles spécifiques",
    how: "Alternance de 30 s d'enchaînements rapides et 30 s de déplacements actifs.",
    dose: "6 à 8 répétitions",
  },
};

const DEFAULT_EXERCISES: Insight["exercises"][number][] = [
  {
    kind: "mobilite",
    name: "Échauffement articulaire",
    how: "Rotations des chevilles, genoux, hanches, épaules et cou, puis fentes dynamiques.",
    dose: "8 min",
    metrics: [],
  },
  {
    kind: "technique",
    name: "Shadow technique",
    how: "Enchaînements de la discipline à vitesse modérée, en soignant la posture plutôt que la vitesse.",
    dose: "3 rounds de 2 min",
    metrics: [],
  },
];

export function mockInsight(context: InsightContext): Insight {
  const metrics = context.metrics;
  const label = (m: Metric) => m.label.toLowerCase();
  const reliable = metrics.filter((m) => m.reliability === "fiable" && !m.watch);
  const watched = metrics.filter((m) => m.watch);
  const toConfirm = metrics.filter((m) => m.reliability === "à confirmer");
  const anchor = metrics[0];

  // Des règles simples ne savent pas juger si une valeur est « bonne » : le mode
  // démonstration présente donc des repères établis, pas des points forts.
  const strengths = (reliable.length > 0 ? reliable : metrics).slice(0, 3).map((m) => ({
    title: `Repère établi : ${label(m)}`,
    detail: `${m.label} : ${m.value}. Une première référence pour suivre ta progression d'une séance à l'autre.`,
    metrics: [m.key],
  }));

  const improvementSource = [...watched, ...toConfirm.filter((m) => !m.watch), ...metrics].filter(
    (m, i, all) => all.findIndex((x) => x.key === m.key) === i,
  );
  const improvements = improvementSource.slice(0, 3).map((m, index) => ({
    priority: index + 1,
    title: m.watch ? `Surveiller : ${label(m)}` : `Consolider : ${label(m)}`,
    detail: m.watch
      ? `${m.label} (${m.value}) dépasse le seuil de vigilance : à travailler en douceur et à faire vérifier si une gêne apparaît.`
      : `${m.label} (${m.value}) : à observer avec ton coach pour fixer un objectif sur les prochaines séances.`,
    metrics: [m.key],
  }));

  const exercises = improvementSource
    .map((m) => (EXERCISES[m.key] ? { ...EXERCISES[m.key]!, metrics: [m.key] } : null))
    .filter((e): e is Insight["exercises"][number] => e !== null)
    .slice(0, 4);
  for (const fallback of DEFAULT_EXERCISES) {
    if (exercises.length >= 2) break;
    exercises.push({ ...fallback, metrics: [anchor.key] });
  }

  const alerts = watched.slice(0, 3).map((m) => ({
    signal: `${m.label} (${m.value}) dépasse le seuil de vigilance. Point à vérifier avec un kinésithérapeute ou un médecin du sport si une gêne apparaît.`,
    metrics: [m.key],
  }));

  const usedKeys = new Set([...strengths, ...improvements, ...exercises, ...alerts].flatMap((x) => x.metrics));

  const unreliable = [...context.unreliable_metrics, ...context.not_measurable];
  const minor = context.athlete.age_group === "mineur";

  return {
    summary: `Séance de ${context.session.type.toLowerCase()} analysée sur environ ${context.session.analysed_seconds} secondes exploitables. Les retours ci-dessous s'appuient sur ${metrics.length} mesure${metrics.length > 1 ? "s" : ""} assez fiable${metrics.length > 1 ? "s" : ""}.`,
    strengths,
    improvements,
    exercises,
    alerts,
    week_plan: [
      { day: "Séance 1", focus: "Technique", content: `Échauffement, puis ${exercises[0].name.toLowerCase()} (${exercises[0].dose}).` },
      {
        day: "Séance 2",
        focus: minor ? "Physique adapté" : "Physique",
        content: `${exercises[1].name} (${exercises[1].dose})${minor ? ", sans charge lourde ni effort maximal" : ""}.`,
      },
      { day: "Séance 3", focus: "Mise en situation", content: "Travail à thème avec partenaire en reprenant les points de la semaine." },
    ],
    to_confirm: toConfirm.filter((m) => usedKeys.has(m.key)).map((m) => m.key),
    reliability:
      `${fr.insights.mockNotice} ` +
      (toConfirm.length > 0 ? `Mesures à confirmer : ${toConfirm.map(label).join(", ")}. ` : "") +
      (unreliable.length > 0 ? `Non utilisables sur cette séance : ${unreliable.map((l) => l.toLowerCase()).join(", ")}.` : ""),
  };
}

/** Retours quand aucune métrique n'est assez fiable : on n'appelle pas le modèle. */
export function insufficientInsight(context: InsightContext): Omit<Insight, "strengths" | "improvements" | "exercises" | "week_plan"> & {
  strengths: [];
  improvements: [];
  exercises: [];
  week_plan: [];
} {
  return {
    summary: fr.insights.insufficient,
    strengths: [],
    improvements: [],
    exercises: [],
    alerts: [],
    week_plan: [],
    to_confirm: [],
    reliability: [...context.notes, ...(context.unreliable_metrics.length > 0 ? [`Mesures peu fiables : ${context.unreliable_metrics.join(", ")}.`] : [])].join(" ") || fr.insights.insufficient,
  };
}
