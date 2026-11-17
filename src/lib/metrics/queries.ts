import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AnalysisNote, AthleteAnalysis, MetricCategory, MetricDetails, MetricKey, MetricUnit } from "./types";

export type StoredMetric = {
  athlete_id: string;
  key: MetricKey;
  category: MetricCategory;
  value: number;
  unit: MetricUnit;
  confidence: number;
  details: MetricDetails;
};

export type StoredAnalysis = {
  athlete_id: string;
  analyzed_at: string;
  analysis: {
    discipline: string;
    summary: AthleteAnalysis["summary"];
    notes: AnalysisNote[];
    missing: MetricKey[];
  };
};

/** Métriques et résumés d'analyse d'une séance (RLS : seulement les données du coach). */
export async function getSessionAnalysis(sessionId: string) {
  const supabase = await createClient();
  const [metrics, analyses] = await Promise.all([
    supabase
      .from("metrics")
      .select("athlete_id, key, category, value, unit, confidence, details")
      .eq("session_id", sessionId),
    supabase
      .from("session_athletes")
      .select("athlete_id, analyzed_at, analysis")
      .eq("session_id", sessionId)
      .not("analysis", "is", null),
  ]);
  if (metrics.error) throw new Error(metrics.error.message);
  if (analyses.error) throw new Error(analyses.error.message);
  return {
    metrics: metrics.data as StoredMetric[],
    analyses: analyses.data as StoredAnalysis[],
  };
}
