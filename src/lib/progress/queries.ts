import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MetricDetails, MetricKey, MetricUnit } from "@/lib/metrics/types";
import type { MetricRow, SessionRef } from "./domain";

// Lectures de la progression. La RLS limite tout au coach connecté.

type Supabase = Awaited<ReturnType<typeof createClient>>;

type MetricRecord = {
  session_id: string;
  athlete_id: string;
  key: string;
  value: number;
  unit: string | null;
  confidence: number;
  details: MetricDetails | null;
};

function toRows(records: MetricRecord[]): MetricRow[] {
  return records.map((r) => ({
    sessionId: r.session_id,
    athleteId: r.athlete_id,
    key: r.key as MetricKey,
    value: r.value,
    unit: (r.unit ?? "s") as MetricUnit,
    confidence: r.confidence,
    watch: r.details?.flag === "watch",
  }));
}

async function sessionsByIds(supabase: Supabase, ids: string[]): Promise<SessionRef[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("sessions").select("id, session_date").in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.id, date: s.session_date }));
}

/** Toutes les mesures d'un athlète, avec la date de chaque séance. */
export async function getAthleteProgress(athleteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metrics")
    .select("session_id, athlete_id, key, value, unit, confidence, details")
    .eq("athlete_id", athleteId);
  if (error) throw new Error(error.message);
  const records = (data ?? []) as MetricRecord[];
  const sessions = await sessionsByIds(supabase, [...new Set(records.map((r) => r.session_id))]);
  return { sessions, rows: toRows(records) };
}

/** Toutes les séances d'un groupe et leurs mesures (vide si pas encore analysées). */
export async function getGroupProgress(groupId: string) {
  const supabase = await createClient();
  const { data: sessionRows, error: sessionError } = await supabase
    .from("sessions")
    .select("id, session_date")
    .eq("group_id", groupId)
    .order("session_date");
  if (sessionError) throw new Error(sessionError.message);
  const sessions: SessionRef[] = (sessionRows ?? []).map((s) => ({ id: s.id, date: s.session_date }));
  if (sessions.length === 0) return { sessions, rows: [] as MetricRow[] };

  const { data, error } = await supabase
    .from("metrics")
    .select("session_id, athlete_id, key, value, unit, confidence, details")
    .in("session_id", sessions.map((s) => s.id));
  if (error) throw new Error(error.message);
  return { sessions, rows: toRows((data ?? []) as MetricRecord[]) };
}
