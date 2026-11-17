// Modules par discipline : quelles métriques calculer, et quels seuils de
// vigilance appliquer. C'est le seul fichier à modifier pour ajuster un sport.
//
// Les métriques génériques sont calculées pour tout le monde ; chaque module
// ajoute les siennes. Les seuils de vigilance ne déclenchent qu'un signal
// « à vérifier », jamais un diagnostic.

import type { Discipline } from "@/lib/roster/domain";
import type { AnalysisNote, MetricKey, Thresholds } from "./types";

export const GENERIC_METRICS: readonly MetricKey[] = [
  "stance_width",
  "guard_height",
  "knee_flexion",
  "hip_flexion",
  "trunk_lean",
  "balance_offset",
  "intensity",
  "explosiveness",
  "rhythm_variability",
  "intensity_drop",
  "guard_drop_over_time",
  "knee_range",
  "hip_range",
  "shoulder_range",
  "knee_valgus",
  "trunk_flexion",
  "elbow_lockout",
  "asymmetry",
];

export const DEFAULT_THRESHOLDS: Thresholds = {
  /** Genou rentré de plus de 8 % de la longueur de jambe, en flexion. */
  kneeValgus: 0.08,
  /** Tronc penché de plus de 55° (90e centile). */
  trunkFlexion: 55,
  /** Plus de 30 % des frappes rapides finissent coude verrouillé. */
  elbowLockout: 30,
  /** Plus de 25 % d'écart d'amplitude entre gauche et droite. */
  asymmetry: 25,
  /** Intensité en baisse de plus de 30 % entre le début et la fin. */
  intensityDrop: 30,
};

type DisciplineModule = {
  extra: readonly MetricKey[];
  thresholds?: Partial<Thresholds>;
  notes?: readonly AnalysisNote[];
};

const STRIKING: readonly MetricKey[] = ["guard_drops", "guard_recovery", "strike_rate", "trunk_rotation"];
const GRAPPLING: readonly MetricKey[] = ["stance_level", "level_changes", "ground_share"];

export const DISCIPLINE_MODULES: Record<Discipline, DisciplineModule> = {
  // Lutte : garde basse et changements de niveau ; tronc très penché sur les
  // entrées de jambes, c'est normal, d'où un seuil plus haut.
  wrestling: { extra: GRAPPLING, thresholds: { trunkFlexion: 75 } },
  judo: { extra: GRAPPLING, thresholds: { trunkFlexion: 70 } },
  boxing: { extra: STRIKING },
  kickboxing: { extra: STRIKING },
  mma: { extra: [...STRIKING, ...GRAPPLING], thresholds: { trunkFlexion: 70 } },
  // JJB : le travail au sol est mal vu par une seule caméra en 2D. On se limite
  // aux métriques robustes et on le dit clairement.
  bjj: { extra: ["ground_share"], notes: ["bjj_limited"] },
  other: { extra: [] },
};

export function metricsFor(discipline: Discipline): MetricKey[] {
  return [...GENERIC_METRICS, ...DISCIPLINE_MODULES[discipline].extra];
}

export function thresholdsFor(discipline: Discipline): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...DISCIPLINE_MODULES[discipline].thresholds };
}
