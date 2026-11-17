"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { unpackSeries } from "@/lib/pose/codec";
import type { Discipline } from "@/lib/roster/domain";
import { uuidSchema } from "@/lib/roster/schemas";
import { POSE_BUCKET } from "@/lib/sessions/domain";
import { createClient } from "@/lib/supabase/server";
import { analyzeAthlete } from "./analyze";
import type { ClipSeries } from "./types";

const t = fr.metrics;

export type AnalyzeState = { ok?: string; error?: string };

/**
 * Analyse une séance : télécharge les séries de pose, calcule les métriques de
 * chaque athlète AYANT un consentement valide, et les enregistre.
 *
 * Tout se passe côté serveur, sur les seules données de pose (jamais de vidéo),
 * avec le client Supabase du coach : la RLS s'applique comme partout.
 */
export async function analyzeSession(sessionId: string): Promise<AnalyzeState> {
  await requireCoach();
  if (!uuidSchema.safeParse(sessionId).success) return { error: t.errorGeneric };
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, group_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { error: t.errorGeneric };
  const { data: group } = await supabase
    .from("groups")
    .select("discipline")
    .eq("id", session.group_id)
    .maybeSingle();
  const discipline = (group?.discipline ?? "other") as Discipline;

  const { data: series, error: seriesError } = await supabase
    .from("pose_series")
    .select("athlete_id, storage_path, started_at")
    .eq("session_id", sessionId)
    .order("started_at");
  if (seriesError) return { error: t.errorGeneric };
  if (series.length === 0) return { error: t.noClips };

  const athleteIds = [...new Set(series.map((row) => row.athlete_id))];
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, analysis_allowed")
    .in("id", athleteIds);
  // Consentement vérifié AU MOMENT de l'analyse : s'il a été retiré depuis la
  // capture, l'athlète n'est pas analysé et ses anciennes métriques sont retirées.
  const allowed = new Set((athletes ?? []).filter((a) => a.analysis_allowed).map((a) => a.id));
  const skipped = athleteIds.filter((id) => !allowed.has(id));

  let analyzed = 0;
  for (const athleteId of athleteIds.filter((id) => allowed.has(id))) {
    const clips: ClipSeries[] = [];
    for (const row of series.filter((r) => r.athlete_id === athleteId)) {
      const { data: file, error } = await supabase.storage.from(POSE_BUCKET).download(row.storage_path);
      if (error || !file) return { error: t.errorDownload };
      try {
        const { header, frames } = await unpackSeries(new Uint8Array(await file.arrayBuffer()));
        clips.push({ frames, sampleRateHz: header.sampleRateHz, aspect: header.aspect });
      } catch {
        return { error: t.errorDownload };
      }
    }

    const analysis = analyzeAthlete(clips, discipline);
    const { error: deleteError } = await supabase
      .from("metrics")
      .delete()
      .eq("session_id", sessionId)
      .eq("athlete_id", athleteId);
    if (deleteError) return { error: t.errorGeneric };
    if (analysis.metrics.length > 0) {
      const { error: insertError } = await supabase.from("metrics").insert(
        analysis.metrics.map((metric) => ({
          session_id: sessionId,
          athlete_id: athleteId,
          key: metric.key,
          category: metric.category,
          value: metric.value,
          unit: metric.unit,
          confidence: metric.confidence,
          details: metric.details,
        })),
      );
      if (insertError) return { error: t.errorGeneric };
    }
    await supabase.from("session_athletes").upsert(
      {
        session_id: sessionId,
        athlete_id: athleteId,
        present: true,
        analysis: {
          discipline,
          summary: analysis.summary,
          notes: analysis.notes,
          missing: analysis.missing,
        },
        analyzed_at: new Date().toISOString(),
      },
      { onConflict: "session_id,athlete_id" },
    );
    analyzed++;
  }

  if (skipped.length > 0) {
    await supabase.from("metrics").delete().eq("session_id", sessionId).in("athlete_id", skipped);
    await supabase.from("insights").delete().eq("session_id", sessionId).in("athlete_id", skipped);
    await supabase
      .from("session_athletes")
      .update({ analysis: null, analyzed_at: null })
      .eq("session_id", sessionId)
      .in("athlete_id", skipped);
  }
  // « Analysée » seulement s'il reste des résultats ; sinon retour à « Filmée ».
  if (analyzed > 0) {
    await supabase.from("sessions").update({ status: "analyzed" }).eq("id", sessionId);
  } else {
    await supabase
      .from("sessions")
      .update({ status: "captured" })
      .eq("id", sessionId)
      .eq("status", "analyzed");
  }

  revalidatePath("/", "layout");
  return { ok: t.done(analyzed, skipped.length) };
}
