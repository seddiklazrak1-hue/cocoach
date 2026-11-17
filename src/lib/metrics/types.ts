// Types partagés du pipeline de métriques.

export const METRIC_CATEGORIES = [
  "technique",
  "physical",
  "injury_prevention",
  "discipline",
] as const;
export type MetricCategory = (typeof METRIC_CATEGORIES)[number];

/** Unités d'affichage (les libellés français sont dans `fr.metrics.units`). */
export type MetricUnit =
  | "deg" // degrés
  | "shoulders" // multiple de la largeur d'épaules
  | "torso" // multiple de la longueur du tronc
  | "leg" // fraction de la longueur de jambe
  | "m_s" // mètres par seconde (vitesse des membres par rapport aux hanches)
  | "percent"
  | "per_min"
  | "s";

export const METRIC_KEYS = [
  // Technique
  "stance_width",
  "guard_height",
  "knee_flexion",
  "hip_flexion",
  "trunk_lean",
  "balance_offset",
  // Physique
  "intensity",
  "explosiveness",
  "rhythm_variability",
  "intensity_drop",
  "guard_drop_over_time",
  "knee_range",
  "hip_range",
  "shoulder_range",
  // Prévention
  "knee_valgus",
  "trunk_flexion",
  "elbow_lockout",
  "asymmetry",
  // Modules par discipline
  "stance_level",
  "level_changes",
  "guard_drops",
  "guard_recovery",
  "strike_rate",
  "trunk_rotation",
  "ground_share",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export type MetricDetails = {
  /** Images utilisées pour cette métrique. */
  usedFrames: number;
  /** Images où l'athlète est présent. */
  presentFrames: number;
  /** Fiabilité moyenne des points utilisés (0 à 1). */
  quality: number;
  /** Valeurs par côté quand c'est pertinent. */
  left?: number;
  right?: number;
  /** Dispersion (10e et 90e centiles) pour les métriques agrégées. */
  p10?: number;
  p90?: number;
  /** Nombre d'événements (frappes, changements de niveau…) pour les fréquences. */
  events?: number;
  /** Signal à vérifier (jamais un diagnostic) : la valeur dépasse le seuil de vigilance. */
  flag?: "watch";
  /** Seuil de vigilance utilisé, pour la traçabilité. */
  threshold?: number;
};

export type MetricResult = {
  key: MetricKey;
  category: MetricCategory;
  value: number;
  unit: MetricUnit;
  /** 0 à 1. En dessous de 0,4 : à ne pas utiliser pour des recommandations. */
  confidence: number;
  details: MetricDetails;
};

/** Remarques générales sur la fiabilité de l'analyse (libellés dans `fr.metrics.notes`). */
export type AnalysisNote =
  | "short_presence"
  | "low_quality"
  | "ground_heavy"
  | "bjj_limited"
  | "depth_estimated";

export type AthleteAnalysis = {
  metrics: MetricResult[];
  /** Métriques prévues pour la discipline mais impossibles à calculer (pas assez d'images fiables). */
  missing: MetricKey[];
  notes: AnalysisNote[];
  summary: {
    presentFrames: number;
    usableFrames: number;
    /** Secondes où l'athlète est présent et suffisamment visible. */
    usableSeconds: number;
    /** Part du temps détecté au sol (0 à 1). */
    groundShare: number;
    meanQuality: number;
  };
};

/** Une séquence d'un athlète : une case par image, `null` si absent. */
export type ClipSeries = {
  frames: ReadonlyArray<import("@/lib/pose/landmarks").PoseSample | null>;
  sampleRateHz: number;
  aspect: number;
};

/** Seuils au-delà desquels une métrique est signalée « à surveiller ». */
export type Thresholds = {
  kneeValgus: number;
  trunkFlexion: number;
  elbowLockout: number;
  asymmetry: number;
  intensityDrop: number;
};
