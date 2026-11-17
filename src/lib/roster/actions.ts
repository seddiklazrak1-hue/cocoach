"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { isMinor } from "./domain";
import {
  athleteCreateSchema,
  athleteUpdateSchema,
  consentSchema,
  fieldErrorsOf,
  groupSchema,
  readAthleteForm,
  readGroupForm,
  uuidSchema,
  type AthleteRaw,
  type FormState,
  type GroupRaw,
} from "./schemas";

// Toutes les écritures sur les groupes, les athlètes et les consentements.
// Chaque action : (1) vérifie la session, (2) valide la saisie avec Zod,
// (3) écrit via le client Supabase du coach, donc sous RLS.

const e = fr.roster.errors;
const POSE_BUCKET = "pose-series";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Rafraîchit toutes les pages du coach (listes, fiches, tableau de bord). */
function refreshApp() {
  revalidatePath("/", "layout");
}

// --- Groupes -----------------------------------------------------------------

export async function createGroup(
  _prev: FormState<GroupRaw>,
  formData: FormData,
): Promise<FormState<GroupRaw>> {
  await requireCoach();
  const raw = readGroupForm(formData);
  const parsed = groupSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return { error: e.generic, values: raw };

  refreshApp();
  redirect(`/groups/${data.id}`);
}

export async function updateGroup(
  groupId: string,
  _prev: FormState<GroupRaw>,
  formData: FormData,
): Promise<FormState<GroupRaw>> {
  await requireCoach();
  const raw = readGroupForm(formData);
  const parsed = groupSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  }
  if (!uuidSchema.safeParse(groupId).success) return { error: e.notFound };

  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update(parsed.data)
    .eq("id", groupId);
  if (error) return { error: e.generic, values: raw };

  refreshApp();
  redirect(`/groups/${groupId}`);
}

export async function deleteGroup(
  groupId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  if (!uuidSchema.safeParse(groupId).success) return { error: e.notFound };

  const supabase = await createClient();
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { error: e.notFound };
  if (!confirmationMatches(formData, group.name)) {
    return { error: e.confirmMismatch };
  }

  // Les séances du groupe partent en cascade, mais leurs fichiers de pose sont
  // dans le stockage : on les retire d'abord, sinon ils resteraient orphelins.
  const { data: sessions, error: sessionsError } = await supabase
    .from("sessions")
    .select("id")
    .eq("group_id", groupId);
  if (sessionsError) return { error: e.generic };
  if (sessions.length > 0) {
    const { data: series, error: seriesError } = await supabase
      .from("pose_series")
      .select("storage_path")
      .in(
        "session_id",
        sessions.map((session) => session.id),
      );
    if (seriesError) return { error: e.generic };
    if (series.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(POSE_BUCKET)
        .remove(series.map((row) => row.storage_path));
      if (storageError) return { error: e.generic };
    }
  }

  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) return { error: e.generic };

  refreshApp();
  redirect("/groups");
}

/** Ajoute au groupe les athlètes cochés dans le formulaire. */
export async function addGroupMembers(groupId: string, formData: FormData) {
  await requireCoach();
  const athleteIds = formData
    .getAll("athleteIds")
    .map(String)
    .filter((id) => uuidSchema.safeParse(id).success);
  if (!uuidSchema.safeParse(groupId).success || athleteIds.length === 0) return;

  const supabase = await createClient();
  await supabase.from("athlete_groups").upsert(
    athleteIds.map((athlete_id) => ({ athlete_id, group_id: groupId })),
    { onConflict: "athlete_id,group_id", ignoreDuplicates: true },
  );
  refreshApp();
}

export async function removeGroupMember(groupId: string, athleteId: string) {
  await requireCoach();
  if (
    !uuidSchema.safeParse(groupId).success ||
    !uuidSchema.safeParse(athleteId).success
  ) {
    return;
  }
  const supabase = await createClient();
  await supabase
    .from("athlete_groups")
    .delete()
    .eq("group_id", groupId)
    .eq("athlete_id", athleteId);
  refreshApp();
}

// --- Athlètes ----------------------------------------------------------------

export async function createAthlete(
  _prev: FormState<AthleteRaw>,
  formData: FormData,
): Promise<FormState<AthleteRaw>> {
  await requireCoach();
  const raw = readAthleteForm(formData);
  const parsed = athleteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  }
  const { groupIds, consent, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athletes")
    .insert(toAthleteRow(fields))
    .select("id")
    .single();
  if (error) return { error: e.generic, values: raw };

  await setAthleteGroups(supabase, data.id, groupIds);
  if (consent !== "missing") {
    // Le statut de l'athlète est mis à jour par le trigger SQL `apply_consent`.
    await supabase
      .from("consents")
      .insert({ athlete_id: data.id, status: consent });
  }

  refreshApp();
  redirect(`/athletes/${data.id}`);
}

export async function updateAthlete(
  athleteId: string,
  _prev: FormState<AthleteRaw>,
  formData: FormData,
): Promise<FormState<AthleteRaw>> {
  await requireCoach();
  const raw = readAthleteForm(formData);
  const parsed = athleteUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  }
  if (!uuidSchema.safeParse(athleteId).success) return { error: e.notFound };
  const { groupIds, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("athletes")
    .update(toAthleteRow(fields))
    .eq("id", athleteId)
    .select("consent_status")
    .maybeSingle();
  if (error) return { error: e.generic, values: raw };
  if (!data) return { error: e.notFound };

  await setAthleteGroups(supabase, athleteId, groupIds);

  // Si la nouvelle date de naissance révèle un mineur alors qu'un consentement
  // « adulte » était enregistré, ce consentement ne vaut plus : on le remet à
  // « non recueilli », avec une entrée explicite au journal.
  if (
    data.consent_status === "adult_confirmed" &&
    isMinor(fields.birthDate)
  ) {
    await supabase.from("consents").insert({
      athlete_id: athleteId,
      status: "missing",
      note: fr.roster.consent.autoResetNote,
    });
  }

  refreshApp();
  redirect(`/athletes/${athleteId}`);
}

/**
 * Droit à l'effacement : supprime l'athlète et TOUT ce qui lui est rattaché.
 * Les lignes en base partent en cascade (clés étrangères ON DELETE CASCADE) ;
 * les fichiers de pose, eux, sont dans Storage et doivent être retirés à part.
 */
export async function deleteAthlete(
  athleteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  if (!uuidSchema.safeParse(athleteId).success) return { error: e.notFound };

  const supabase = await createClient();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("display_name")
    .eq("id", athleteId)
    .maybeSingle();
  if (!athlete) return { error: e.notFound };
  if (!confirmationMatches(formData, athlete.display_name)) {
    return { error: e.confirmMismatch };
  }

  // 1. Fichiers d'abord : si cette étape échoue, on s'arrête et rien n'est
  //    perdu de vue (les chemins sont encore listés en base).
  const { data: series, error: seriesError } = await supabase
    .from("pose_series")
    .select("storage_path")
    .eq("athlete_id", athleteId);
  if (seriesError) return { error: e.generic };
  if (series.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(POSE_BUCKET)
      .remove(series.map((row) => row.storage_path));
    if (storageError) return { error: e.generic };
  }

  // 2. Puis la fiche : la cascade SQL efface le reste.
  const { error } = await supabase.from("athletes").delete().eq("id", athleteId);
  if (error) return { error: e.generic };

  refreshApp();
  redirect(`/athletes?efface=${encodeURIComponent(athlete.display_name)}`);
}

// --- Consentement ------------------------------------------------------------

export async function recordConsent(
  athleteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  if (!uuidSchema.safeParse(athleteId).success) return { error: e.notFound };

  const parsed = consentSchema.safeParse({
    status: String(formData.get("status") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data: athlete } = await supabase
    .from("athletes")
    .select("birth_date")
    .eq("id", athleteId)
    .maybeSingle();
  if (!athlete) return { error: e.notFound };
  if (
    parsed.data.status === "adult_confirmed" &&
    isMinor(athlete.birth_date)
  ) {
    return { fieldErrors: { status: e.minorNeedsParent } };
  }

  const { error } = await supabase
    .from("consents")
    .insert({ athlete_id: athleteId, ...parsed.data });
  if (error) return { error: e.generic };

  refreshApp();
  return {};
}

// --- Aides internes ----------------------------------------------------------

/** Compare le nom retapé par le coach au nom réel (sans tenir compte de la casse). */
function confirmationMatches(formData: FormData, expected: string) {
  const typed = String(formData.get("confirm") ?? "");
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}

function toAthleteRow(fields: {
  displayName: string;
  discipline: string | null;
  level: string;
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
}) {
  return {
    display_name: fields.displayName,
    discipline: fields.discipline,
    level: fields.level,
    weight_kg: fields.weightKg,
    height_cm: fields.heightCm,
    birth_date: fields.birthDate,
  };
}

/** Aligne les groupes de l'athlète sur la liste cochée (ajouts + retraits). */
async function setAthleteGroups(
  supabase: Supabase,
  athleteId: string,
  groupIds: string[],
) {
  const { data: current } = await supabase
    .from("athlete_groups")
    .select("group_id")
    .eq("athlete_id", athleteId);
  const currentIds = new Set((current ?? []).map((row) => row.group_id));
  const wantedIds = new Set(groupIds);

  const toAdd = groupIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !wantedIds.has(id));

  if (toAdd.length > 0) {
    await supabase
      .from("athlete_groups")
      .insert(toAdd.map((group_id) => ({ athlete_id: athleteId, group_id })));
  }
  if (toRemove.length > 0) {
    await supabase
      .from("athlete_groups")
      .delete()
      .eq("athlete_id", athleteId)
      .in("group_id", toRemove);
  }
}
