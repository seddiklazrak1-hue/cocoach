// Contexte envoyé au modèle : uniquement des métriques, pseudonymisées.
//
// Jamais envoyés : prénom, date de naissance, poids, taille, identifiants,
// vidéo ou séries de pose. Seulement la tranche d'âge (adulte / mineur), le
// niveau, la discipline, et les métriques déjà calculées et formatées en
// français : le modèle rédige, il ne calcule rien.

import { fr } from "@/lib/i18n/fr";
import { confidenceLevel, formatMetric, formatValue } from "@/lib/metrics/format";
import type { AnalysisNote, MetricCategory, MetricDetails, MetricKey, MetricUnit } from "@/lib/metrics/types";
import { isMinor, type AthleteLevel, type Discipline } from "@/lib/roster/domain";
import type { SessionKind } from "@/lib/sessions/domain";

/** En dessous : la métrique n'est pas citable (ni valeur ni conseil dessus). */
export const MIN_CITABLE_CONFIDENCE = 0.4;
/** En dessous : citable, mais à présenter comme « à confirmer ». */
export const CONFIRMED_CONFIDENCE = 0.7;

export type MetricInput = {
  key: MetricKey;
  category: MetricCategory;
  value: number;
  unit: MetricUnit;
  confidence: number;
  details: MetricDetails;
};

export type InsightInput = {
  athlete: { level: AthleteLevel; birthDate: string | null };
  discipline: Discipline;
  session: { kind: SessionKind; durationMin: number | null };
  analysis: { usableSeconds: number; notes: AnalysisNote[]; missing: MetricKey[] };
  metrics: MetricInput[];
};

export type InsightContext = {
  athlete: { code: string; age_group: "adulte" | "mineur" | "inconnu"; level: string; discipline: string };
  session: { type: string; planned_minutes: number | null; analysed_seconds: number };
  metrics: Array<{
    key: MetricKey;
    label: string;
    category: string;
    value: string;
    sides?: string;
    reliability: "fiable" | "à confirmer";
    confidence: number;
    watch: boolean;
    how_measured: string;
  }>;
  unreliable_metrics: string[];
  not_measurable: string[];
  notes: string[];
};

export function buildContext(input: InsightInput): {
  context: InsightContext;
  citable: MetricKey[];
  toConfirm: MetricKey[];
  flagged: MetricKey[];
} {
  const t = fr.metrics;
  const citableMetrics = input.metrics.filter((m) => m.confidence >= MIN_CITABLE_CONFIDENCE);
  const unreliable = input.metrics.filter((m) => m.confidence < MIN_CITABLE_CONFIDENCE);

  const context: InsightContext = {
    athlete: {
      // Pseudonyme fixe : le modèle ne connaît jamais le prénom.
      code: "Athlète A",
      age_group:
        input.athlete.birthDate === null ? "inconnu" : isMinor(input.athlete.birthDate) ? "mineur" : "adulte",
      level: fr.roster.levels[input.athlete.level],
      discipline: fr.roster.disciplines[input.discipline],
    },
    session: {
      type: fr.sessions.kinds[input.session.kind],
      planned_minutes: input.session.durationMin,
      analysed_seconds: Math.round(input.analysis.usableSeconds),
    },
    metrics: citableMetrics.map((m) => ({
      key: m.key,
      label: t.items[m.key].label,
      category: t.categories[m.category],
      value: formatMetric(m.key, m.unit, m.value),
      ...(m.details.left !== undefined &&
        m.details.right !== undefined && {
          sides: t.sides(formatValue(m.key, m.unit, m.details.left), formatValue(m.key, m.unit, m.details.right)),
        }),
      reliability: confidenceLevel(m.confidence) === "high" ? "fiable" : "à confirmer",
      confidence: m.confidence,
      watch: m.details.flag === "watch",
      how_measured: t.items[m.key].description,
    })),
    unreliable_metrics: unreliable.map((m) => t.items[m.key].label),
    not_measurable: input.analysis.missing.map((key) => t.items[key].label),
    notes: input.analysis.notes.map((note) => t.notes[note]),
  };

  return {
    context,
    citable: citableMetrics.map((m) => m.key),
    toConfirm: citableMetrics.filter((m) => m.confidence < CONFIRMED_CONFIDENCE).map((m) => m.key),
    // Une alerte n'est possible que sur une métrique signalée ET citable.
    flagged: citableMetrics.filter((m) => m.details.flag === "watch").map((m) => m.key),
  };
}
