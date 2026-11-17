// Progression d'un athlète et suivi d'un groupe, au fil des séances. Fonctions
// pures : pas d'accès base ici (voir queries.ts), donc testables sans Supabase.
//
// Règles : une valeur n'entre dans une courbe que si sa fiabilité atteint le
// seuil. Pour un groupe, la moyenne ne porte que sur les mesures fiables, pour
// ne pas mélanger de l'estimation bruitée avec du solide.

import { METRIC_KEYS, type MetricKey, type MetricUnit } from "@/lib/metrics/types";

/** Même seuil que les recommandations : en dessous, la valeur n'est pas affichée. */
export const PROGRESS_MIN_CONFIDENCE = 0.4;
/** Pour une moyenne de groupe : seules les mesures fiables comptent. */
export const GROUP_MIN_CONFIDENCE = 0.7;

export type SessionRef = { id: string; date: string };

/** Une mesure telle que lue en base, avec la date de sa séance ajoutée. */
export type MetricRow = {
  sessionId: string;
  athleteId: string;
  key: MetricKey;
  value: number;
  unit: MetricUnit;
  confidence: number;
  /** Signal « à surveiller » posé par le pipeline (jamais un diagnostic). */
  watch: boolean;
};

export type AthletePoint = {
  sessionId: string;
  date: string;
  value: number;
  confidence: number;
  watch: boolean;
};

export type AthleteSeries = {
  key: MetricKey;
  unit: MetricUnit;
  points: AthletePoint[];
};

export type GroupPoint = {
  sessionId: string;
  date: string;
  /** Moyenne des athlètes dont la mesure est fiable. */
  mean: number;
  /** Nombre d'athlètes entrant dans la moyenne. */
  athletes: number;
};

export type GroupSeries = {
  key: MetricKey;
  unit: MetricUnit;
  points: GroupPoint[];
};

export type GroupSessionSummary = {
  sessionId: string;
  date: string;
  analysedAthletes: number;
  watchAthletes: number;
};

const keyOrder = new Map(METRIC_KEYS.map((key, index) => [key, index]));

function byDate(a: { date: string; sessionId: string }, b: { date: string; sessionId: string }) {
  return a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId);
}

function dateOf(sessions: readonly SessionRef[]) {
  return new Map(sessions.map((s) => [s.id, s.date]));
}

/** Courbes d'un athlète : une par mesure, points triés par date. */
export function buildAthleteSeries(sessions: readonly SessionRef[], rows: readonly MetricRow[]): AthleteSeries[] {
  const dates = dateOf(sessions);
  const byKey = new Map<MetricKey, AthleteSeries>();
  for (const row of rows) {
    const date = dates.get(row.sessionId);
    if (date === undefined || row.confidence < PROGRESS_MIN_CONFIDENCE) continue;
    let series = byKey.get(row.key);
    if (!series) {
      series = { key: row.key, unit: row.unit, points: [] };
      byKey.set(row.key, series);
    }
    series.points.push({
      sessionId: row.sessionId,
      date,
      value: row.value,
      confidence: row.confidence,
      watch: row.watch,
    });
  }
  return [...byKey.values()]
    .map((series) => ({ ...series, points: series.points.sort(byDate) }))
    .sort((a, b) => (keyOrder.get(a.key) ?? 0) - (keyOrder.get(b.key) ?? 0));
}

/** Moyenne par séance sur les athlètes du groupe, pour chaque mesure fiable. */
export function buildGroupSeries(
  sessions: readonly SessionRef[],
  rows: readonly MetricRow[],
): { series: GroupSeries[]; sessions: GroupSessionSummary[] } {
  const dates = dateOf(sessions);
  const cells = new Map<string, { sum: number; count: number; key: MetricKey; unit: MetricUnit; sessionId: string; date: string }>();
  const analysed = new Map<string, Set<string>>();
  const watching = new Map<string, Set<string>>();

  for (const row of rows) {
    const date = dates.get(row.sessionId);
    if (date === undefined) continue;
    if (row.confidence >= PROGRESS_MIN_CONFIDENCE) {
      addTo(analysed, row.sessionId, row.athleteId);
    }
    if (row.watch && row.confidence >= PROGRESS_MIN_CONFIDENCE) {
      addTo(watching, row.sessionId, row.athleteId);
    }
    if (row.confidence < GROUP_MIN_CONFIDENCE) continue;
    const id = `${row.key}|${row.sessionId}`;
    const cell = cells.get(id) ?? { sum: 0, count: 0, key: row.key, unit: row.unit, sessionId: row.sessionId, date };
    cell.sum += row.value;
    cell.count += 1;
    cells.set(id, cell);
  }

  const byKey = new Map<MetricKey, GroupSeries>();
  for (const cell of cells.values()) {
    let series = byKey.get(cell.key);
    if (!series) {
      series = { key: cell.key, unit: cell.unit, points: [] };
      byKey.set(cell.key, series);
    }
    series.points.push({
      sessionId: cell.sessionId,
      date: cell.date,
      mean: cell.sum / cell.count,
      athletes: cell.count,
    });
  }

  const summaries: GroupSessionSummary[] = sessions
    .map((session) => ({
      sessionId: session.id,
      date: session.date,
      analysedAthletes: analysed.get(session.id)?.size ?? 0,
      watchAthletes: watching.get(session.id)?.size ?? 0,
    }))
    .sort(byDate);

  return {
    series: [...byKey.values()]
      .map((series) => ({ ...series, points: series.points.sort(byDate) }))
      .sort((a, b) => (keyOrder.get(a.key) ?? 0) - (keyOrder.get(b.key) ?? 0)),
    sessions: summaries,
  };
}

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
}

/**
 * Première et dernière mesure d'une courbe. Volontairement neutre : selon la
 * mesure, « plus haut » peut être mieux ou moins bien, on ne juge pas le sens.
 */
export function endpoints<P extends { value?: number; mean?: number }>(points: readonly P[]) {
  if (points.length === 0) return null;
  const value = (p: P) => p.value ?? p.mean ?? 0;
  const first = points[0];
  const last = points[points.length - 1];
  return { first: value(first), last: value(last), delta: value(last) - value(first), count: points.length };
}

/** Date courte pour un axe : « 17/11 ». */
export function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}
