// Vocabulaire des séances. Valeurs alignées sur les contraintes CHECK du SQL.

export const SESSION_KINDS = ["technique", "sparring", "cardio", "drill"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const SESSION_STATUSES = ["draft", "captured", "analyzed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type Session = {
  id: string;
  group_id: string;
  session_date: string;
  kind: SessionKind;
  duration_min: number | null;
  status: SessionStatus;
  created_at: string;
};

/** Une ligne de `pose_series` : le fichier d'un athlète pour une séquence. */
export type PoseSeriesRow = {
  clip_id: string;
  athlete_id: string;
  started_at: string;
  duration_s: number;
  frame_count: number;
  mean_confidence: number | null;
  storage_path: string;
};

/** Une séquence filmée, avec un fichier par athlète. */
export type Clip = {
  clipId: string;
  startedAt: string;
  durationS: number;
  series: PoseSeriesRow[];
};

/** Regroupe les fichiers par séquence, dans l'ordre chronologique. */
export function groupClips(rows: PoseSeriesRow[]): Clip[] {
  const byClip = new Map<string, Clip>();
  for (const row of rows) {
    let clip = byClip.get(row.clip_id);
    if (!clip) {
      clip = { clipId: row.clip_id, startedAt: row.started_at, durationS: 0, series: [] };
      byClip.set(row.clip_id, clip);
    }
    clip.series.push(row);
    clip.durationS = Math.max(clip.durationS, row.duration_s);
  }
  return [...byClip.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** « 4 min 05 s », « 48 s ». */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${String(rest).padStart(2, "0")} s`;
}

/** « 1:05 » pour une position dans une séquence. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Chemin du fichier de pose dans le bucket. Le 1er dossier DOIT être l'id du coach (règle de stockage). */
export function poseStoragePath(
  coachId: string,
  sessionId: string,
  clipId: string,
  athleteId: string,
): string {
  return `${coachId}/${sessionId}/${clipId}/${athleteId}.bin`;
}

export const POSE_BUCKET = "pose-series";
