// Affichage des métriques en français. Toujours précédé de « ≈ » : ce sont des
// estimations, jamais des certitudes.

import type { MetricKey, MetricUnit } from "./types";

const number = (value: number, digits: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);

/** Valeur seule, sans « ≈ » (utile pour les détails gauche/droite). */
export function formatValue(key: MetricKey, unit: MetricUnit, value: number): string {
  switch (unit) {
    case "deg":
      return `${number(value, 0)}°`;
    case "shoulders":
      return `${number(value, 1)} × largeur d'épaules`;
    case "torso": {
      const sign = value > 0 ? "+" : "";
      return `${sign}${number(value, 2)} longueur de tronc`;
    }
    case "leg":
      // Le valgus se lit mieux en pourcentage de la jambe.
      return key === "knee_valgus"
        ? `${number(value * 100, 1)} % de la jambe`
        : `${number(value, 2)} × longueur de jambe`;
    case "m_s":
      return `${number(value, 2)} m/s`;
    case "percent":
      return `${number(value, 0)} %`;
    case "per_min":
      return `${number(value, 1)} / min`;
    case "s":
      return `${number(value, 1)} s`;
  }
}

export function formatMetric(key: MetricKey, unit: MetricUnit, value: number): string {
  return `≈ ${formatValue(key, unit, value)}`;
}

export type ConfidenceLevel = "high" | "medium" | "low";

/** Fiable à partir de 0,7 ; à confirmer de 0,4 à 0,7 ; peu fiable en dessous. */
export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}
