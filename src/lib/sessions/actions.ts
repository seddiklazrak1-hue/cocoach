"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { fieldErrorsOf, uuidSchema, type FormState } from "@/lib/roster/schemas";
import { createClient } from "@/lib/supabase/server";
import { POSE_BUCKET, poseStoragePath } from "./domain";
import { clipSchema, readSessionForm, sessionSchema, type ClipInput, type SessionRaw } from "./schemas";

const e = fr.sessions.errors;
const re = fr.roster.errors;

type Supabase = Awaited<ReturnType<typeof createClient>>;

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function createSession(
  _prev: FormState<SessionRaw>,
  formData: FormData,
): Promise<FormState<SessionRaw>> {
  await requireCoach();
  const raw = readSessionForm(formData);
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      group_id: parsed.data.groupId,
      session_date: parsed.data.date,
      kind: parsed.data.kind,
      duration_min: parsed.data.durationMin,
    })
    .select("id")
    .single();
  if (error) return { error: re.generic, values: raw };

  refreshApp();
  redirect(`/sessions/${data.id}`);
}

/** Supprime les fichiers de pose listés en base pour les séances données. */
async function removePoseFiles(supabase: Supabase, sessionIds: string[]) {
  if (sessionIds.length === 0) return null;
  const { data, error } = await supabase
    .from("pose_series")
    .select("storage_path")
    .in("session_id", sessionIds);
  if (error) return error;
  if (data.length === 0) return null;
  const { error: storageError } = await supabase.storage
    .from(POSE_BUCKET)
    .remove(data.map((row) => row.storage_path));
  return storageError;
}

export async function deleteSession(
  sessionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  if (!uuidSchema.safeParse(sessionId).success) return { error: re.notFound };
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (typed !== fr.sessions.confirmWord) return { error: re.confirmMismatch };

  const supabase = await createClient();
  // Fichiers d'abord : la cascade SQL efface les lignes, pas les fichiers du stockage.
  if (await removePoseFiles(supabase, [sessionId])) return { error: re.generic };
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) return { error: re.generic };

  refreshApp();
  redirect("/sessions");
}

/**
 * Enregistre en base une séquence dont le navigateur vient d'envoyer les
 * fichiers. Toutes les lignes sont insérées en une seule requête : soit tout
 * passe, soit rien (par exemple si le trigger SQL refuse un athlète sans
 * consentement). En cas d'échec, le navigateur supprime les fichiers envoyés.
 */
export async function registerClip(
  input: ClipInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const coach = await requireCoach();
  const parsed = clipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: e.clipInvalid };
  const { sessionId, clipId, startedAt, entries } = parsed.data;

  // Le chemin doit être exactement celui attendu : pas de fichier ailleurs.
  const pathsOk = entries.every(
    (entry) => entry.storagePath === poseStoragePath(coach.id, sessionId, clipId, entry.athleteId),
  );
  const athletes = new Set(entries.map((entry) => entry.athleteId));
  if (!pathsOk || athletes.size !== entries.length) return { ok: false, error: e.clipInvalid };

  const supabase = await createClient();
  const { error } = await supabase.from("pose_series").insert(
    entries.map((entry) => ({
      session_id: sessionId,
      athlete_id: entry.athleteId,
      clip_id: clipId,
      started_at: startedAt,
      storage_path: entry.storagePath,
      sample_rate_hz: entry.sampleRateHz,
      frame_count: entry.frameCount,
      duration_s: entry.durationS,
      mean_confidence: entry.meanConfidence,
    })),
  );
  if (error) {
    return { ok: false, error: error.code === "23514" ? e.consent : re.generic };
  }

  // Présence à la séance, et séance marquée « filmée ».
  await supabase.from("session_athletes").upsert(
    entries.map((entry) => ({ session_id: sessionId, athlete_id: entry.athleteId, present: true })),
    { onConflict: "session_id,athlete_id", ignoreDuplicates: true },
  );
  await supabase
    .from("sessions")
    .update({ status: "captured" })
    .eq("id", sessionId)
    .eq("status", "draft");

  refreshApp();
  return { ok: true };
}

export async function deleteClip(sessionId: string, clipId: string) {
  await requireCoach();
  if (!uuidSchema.safeParse(sessionId).success || !uuidSchema.safeParse(clipId).success) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pose_series")
    .select("storage_path")
    .eq("session_id", sessionId)
    .eq("clip_id", clipId);
  if (!data || data.length === 0) return;
  const { error } = await supabase.storage
    .from(POSE_BUCKET)
    .remove(data.map((row) => row.storage_path));
  if (error) return;
  await supabase.from("pose_series").delete().eq("session_id", sessionId).eq("clip_id", clipId);

  refreshApp();
}
