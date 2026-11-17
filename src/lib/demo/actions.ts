"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { DEMO_GROUPS, DEMO_PREFIX, demoAnalysis, SESSION_KINDS, SESSIONS_PER_GROUP } from "./generate";

const t = fr.demo;

export type DemoState = { ok?: string; error?: string };

/** Ajoute le jeu de démonstration au compte du coach connecté. */
export async function loadDemo(): Promise<DemoState> {
  await requireCoach();
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("groups")
    .select("id")
    .like("name", `${DEMO_PREFIX}%`)
    .limit(1);
  if (existingError) return { error: t.error };
  if (existing && existing.length > 0) return { error: t.alreadyLoaded };

  try {
    const { data: groups, error: groupError } = await supabase
      .from("groups")
      .insert(DEMO_GROUPS.map((g) => ({ name: g.name, discipline: g.discipline, level: "mixed" })))
      .select("id, name");
    if (groupError || !groups) throw new Error(groupError?.message ?? "groupes");

    const roster = DEMO_GROUPS.flatMap((group, gi) => group.athletes.map((athlete) => ({ group, gi, athlete })));
    const { data: athletes, error: athleteError } = await supabase
      .from("athletes")
      .insert(
        roster.map(({ group, athlete }) => ({
          display_name: athlete.name,
          discipline: group.discipline,
          level: athlete.level,
          birth_date: athlete.birthDate,
        })),
      )
      .select("id, display_name");
    if (athleteError || !athletes) throw new Error(athleteError?.message ?? "athlètes");
    // Les athlètes reviennent dans l'ordre d'insertion : on associe par position.
    const athleteIds = athletes.map((a) => a.id);

    const { error: consentError } = await supabase.from("consents").insert(
      roster.map(({ athlete }, i) => ({ athlete_id: athleteIds[i], status: athlete.consent })),
    );
    if (consentError) throw new Error(consentError.message);

    const { error: membershipError } = await supabase.from("athlete_groups").insert(
      roster.map(({ gi }, i) => ({ athlete_id: athleteIds[i], group_id: groups[gi].id })),
    );
    if (membershipError) throw new Error(membershipError.message);

    const today = new Date();
    const plan = groups.flatMap((group, gi) =>
      Array.from({ length: SESSIONS_PER_GROUP }, (_, k) => {
        const daysAgo = 1 + (SESSIONS_PER_GROUP - 1 - k) * 7 + gi;
        const date = new Date(today.getTime() - daysAgo * 86_400_000);
        return {
          gi,
          k,
          row: {
            group_id: group.id,
            session_date: date.toISOString().slice(0, 10),
            kind: SESSION_KINDS[k],
            duration_min: 60,
            status: "analyzed",
          },
        };
      }),
    );
    const { data: sessions, error: sessionError } = await supabase
      .from("sessions")
      .insert(plan.map((p) => p.row))
      .select("id");
    if (sessionError || !sessions) throw new Error(sessionError?.message ?? "séances");

    const presence: Array<{ session_id: string; athlete_id: string; present: boolean; analysis: unknown; analyzed_at: string }> = [];
    const metrics: Array<Record<string, unknown>> = [];
    const now = new Date().toISOString();
    plan.forEach(({ gi: sessionGroup, k }, si) => {
      const sessionId = sessions[si].id;
      roster.forEach(({ group, gi, athlete }, i) => {
        if (gi !== sessionGroup) return;
        const seed = 1000 * (gi + 1) + 10 * (i + 1) + k;
        const analysis = demoAnalysis(athlete, group.discipline, k, seed);
        const athleteId = athleteIds[i];
        presence.push({
          session_id: sessionId,
          athlete_id: athleteId,
          present: true,
          analysis: {
            discipline: group.discipline,
            summary: analysis.summary,
            notes: analysis.notes,
            missing: analysis.missing,
          },
          analyzed_at: now,
        });
        for (const metric of analysis.metrics) {
          metrics.push({
            session_id: sessionId,
            athlete_id: athleteId,
            key: metric.key,
            category: metric.category,
            value: metric.value,
            unit: metric.unit,
            confidence: metric.confidence,
            details: metric.details,
          });
        }
      });
    });

    const { error: presenceError } = await supabase.from("session_athletes").insert(presence);
    if (presenceError) throw new Error(presenceError.message);
    const { error: metricError } = await supabase.from("metrics").insert(metrics);
    if (metricError) throw new Error(metricError.message);

    revalidatePath("/", "layout");
    return { ok: t.loaded(groups.length, athletes.length, sessions.length) };
  } catch (error) {
    // Pas de rollback automatique ici : on efface ce qui a pu être créé pour ne pas laisser de demi-démo.
    console.error("Chargement de la démo :", error);
    await removeDemo(supabase);
    return { error: t.error };
  }
}

/** Efface la démo, et uniquement elle : les noms commençant par le préfixe « Démo · ». */
export async function clearDemo(): Promise<DemoState> {
  await requireCoach();
  const supabase = await createClient();
  const removed = await removeDemo(supabase);
  if (removed === null) return { error: t.error };
  if (removed === 0) return { error: t.notLoaded };
  revalidatePath("/", "layout");
  return { ok: t.cleared };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Renvoie le nombre de groupes supprimés, ou null en cas d'erreur. */
async function removeDemo(supabase: Supabase): Promise<number | null> {
  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .delete()
    .like("name", `${DEMO_PREFIX}%`)
    .select("id");
  if (groupError) return null;
  const { error: athleteError } = await supabase
    .from("athletes")
    .delete()
    .like("display_name", `${DEMO_PREFIX}%`);
  if (athleteError) return null;
  return groups?.length ?? 0;
}
