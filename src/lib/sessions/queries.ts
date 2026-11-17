import "server-only";
import { uuidSchema } from "@/lib/roster/schemas";
import { createClient } from "@/lib/supabase/server";
import { groupClips, type Clip, type PoseSeriesRow, type Session } from "./domain";

// Lectures des séances. Comme partout, la RLS limite au coach connecté.

const SESSION_COLUMNS = "id, group_id, session_date, kind, duration_min, status, created_at";

export async function listSessions(): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Session[];
}

export async function getSession(id: string): Promise<Session | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Session | null;
}

export async function listClips(sessionId: string): Promise<Clip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pose_series")
    .select("clip_id, athlete_id, started_at, duration_s, frame_count, mean_confidence, storage_path")
    .eq("session_id", sessionId)
    .order("started_at");
  if (error) throw new Error(error.message);
  return groupClips(data as PoseSeriesRow[]);
}
