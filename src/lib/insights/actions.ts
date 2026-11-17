"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import type { AthleteLevel, Discipline } from "@/lib/roster/domain";
import { uuidSchema } from "@/lib/roster/schemas";
import type { SessionKind } from "@/lib/sessions/domain";
import { createClient } from "@/lib/supabase/server";
import type { InsightInput, MetricInput } from "./context";
import { generateInsight, InsightError } from "./generate";
import { citedKeys } from "./validate";

const t = fr.insights;

export type InsightsState = { ok?: string; error?: string };

/**
 * Rédige les recommandations de chaque athlète analysé de la séance. Seules
 * des métriques pseudonymisées quittent le serveur (voir context.ts).
 */
export async function generateSessionInsights(sessionId: string): Promise<InsightsState> {
  await requireCoach();
  if (!uuidSchema.safeParse(sessionId).success) return { error: t.errorGeneric };
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, group_id, kind, duration_min")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: t.errorGeneric };
  const { data: group } = await supabase.from("groups").select("discipline").eq("id", session.group_id).maybeSingle();

  const { data: analyses } = await supabase
    .from("session_athletes")
    .select("athlete_id, analysis")
    .eq("session_id", sessionId)
    .not("analysis", "is", null);
  if (!analyses || analyses.length === 0) return { error: t.needsAnalysis };

  const athleteIds = analyses.map((row) => row.athlete_id);
  const [{ data: athletes }, { data: metrics }] = await Promise.all([
    supabase.from("athletes").select("id, level, birth_date, analysis_allowed").in("id", athleteIds),
    supabase
      .from("metrics")
      .select("athlete_id, key, category, value, unit, confidence, details")
      .eq("session_id", sessionId),
  ]);

  // Consentement revérifié : un athlète qui l'a retiré n'est pas envoyé au modèle.
  const eligible = (athletes ?? []).filter((a) => a.analysis_allowed);

  const results = await Promise.allSettled(
    eligible.map(async (athlete) => {
      const analysis = analyses.find((row) => row.athlete_id === athlete.id)!.analysis;
      const input: InsightInput = {
        athlete: { level: athlete.level as AthleteLevel, birthDate: athlete.birth_date },
        discipline: (group?.discipline ?? "other") as Discipline,
        session: { kind: session.kind as SessionKind, durationMin: session.duration_min },
        analysis: {
          usableSeconds: analysis.summary.usableSeconds,
          notes: analysis.notes,
          missing: analysis.missing,
        },
        metrics: (metrics ?? []).filter((m) => m.athlete_id === athlete.id) as MetricInput[],
      };
      const insight = await generateInsight(input);

      await supabase.from("insights").delete().eq("session_id", sessionId).eq("athlete_id", athlete.id);
      const { error } = await supabase.from("insights").insert({
        session_id: sessionId,
        athlete_id: athlete.id,
        content: insight,
        metric_keys: insight.source === "insufficient" ? [] : citedKeys(insight),
        model: insight.model ?? insight.source,
      });
      if (error) throw new Error(error.message);
    }),
  );

  revalidatePath("/", "layout");
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  const done = results.length - failures.length;
  if (failures.length > 0) {
    const reason = failures[0].reason;
    const message =
      reason instanceof InsightError && reason.reason === "refusal"
        ? t.errorRefusal
        : reason instanceof InsightError && reason.reason === "invalid"
          ? t.errorInvalid
          : t.errorGeneric;
    // Le détail technique reste dans les journaux du serveur, pas à l'écran.
    console.error("Rédaction des recommandations :", reason);
    return done > 0 ? { ok: t.done(done), error: message } : { error: message };
  }
  return { ok: t.done(done) };
}
