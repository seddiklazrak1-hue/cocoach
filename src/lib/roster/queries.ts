import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Athlete, ConsentEntry, Group } from "./domain";
import { uuidSchema } from "./schemas";

// Lectures des groupes et athlètes. Aucune ne filtre sur le coach : c'est la
// RLS de Postgres qui ne renvoie que les lignes du coach connecté.
// Les volumes sont petits (dizaines de lignes), donc on préfère plusieurs
// requêtes simples à des jointures PostgREST plus difficiles à relire.

const GROUP_COLUMNS = "id, name, discipline, level, schedule, created_at";
const ATHLETE_COLUMNS =
  "id, display_name, discipline, level, weight_kg, height_cm, birth_date, consent_status, analysis_allowed, created_at";

export type Membership = { athlete_id: string; group_id: string };

export async function listGroups(): Promise<Group[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_COLUMNS)
    .order("name");
  if (error) throw new Error(error.message);
  return data as Group[];
}

export async function getGroup(id: string): Promise<Group | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Group | null;
}

export async function listAthletes(): Promise<Athlete[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_COLUMNS)
    .order("display_name");
  if (error) throw new Error(error.message);
  return data as Athlete[];
}

export async function getAthlete(id: string): Promise<Athlete | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athletes")
    .select(ATHLETE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Athlete | null;
}

/** Tous les rattachements athlète ↔ groupe du coach. */
export async function listMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athlete_groups")
    .select("athlete_id, group_id");
  if (error) throw new Error(error.message);
  return data as Membership[];
}

/** Journal de consentement d'un athlète, du plus récent au plus ancien. */
export async function listConsents(athleteId: string): Promise<ConsentEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .select("id, status, note, recorded_at")
    .eq("athlete_id", athleteId)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ConsentEntry[];
}
