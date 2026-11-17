import { fr } from "@/lib/i18n/fr";
import { confidenceLevel, formatMetric, formatValue } from "@/lib/metrics/format";
import type { StoredAnalysis, StoredMetric } from "@/lib/metrics/queries";
import { METRIC_CATEGORIES, METRIC_KEYS } from "@/lib/metrics/types";
import { formatDuration } from "@/lib/sessions/domain";

const t = fr.metrics;

const CONFIDENCE_STYLES = {
  high: "bg-emerald-50 text-emerald-800",
  medium: "bg-amber-50 text-amber-900",
  low: "bg-muted text-muted-foreground",
} as const;

/** Rapport de métriques d'un athlète pour une séance. */
export function MetricsReport({
  name,
  analysis,
  metrics,
}: {
  name: string;
  analysis: StoredAnalysis;
  metrics: StoredMetric[];
}) {
  const { summary, notes, missing } = analysis.analysis;
  const order = (key: string) => METRIC_KEYS.indexOf(key as (typeof METRIC_KEYS)[number]);

  return (
    <article className="flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <h3 className="font-heading text-lg font-semibold">{name}</h3>
        <p className="text-sm text-muted-foreground">
          {t.presence(formatDuration(summary.usableSeconds), Math.round(summary.meanQuality * 100))}
        </p>
      </div>

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3 text-sm">
          {notes.map((note) => (
            <li key={note}>{t.notes[note]}</li>
          ))}
        </ul>
      )}

      {METRIC_CATEGORIES.map((category) => {
        const rows = metrics
          .filter((metric) => metric.category === category)
          .sort((a, b) => order(a.key) - order(b.key));
        if (rows.length === 0) return null;
        return (
          <section key={category} className="flex flex-col gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">{t.categories[category]}</h4>
            <ul className="divide-y rounded-lg border">
              {rows.map((metric) => {
                const level = confidenceLevel(metric.confidence);
                const item = t.items[metric.key];
                const { left, right } = metric.details;
                return (
                  <li key={metric.key} className="px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="font-medium">{item.label}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span
                          className={`tabular-nums ${level === "low" ? "text-muted-foreground" : ""}`}
                        >
                          {formatMetric(metric.key, metric.unit, metric.value)}
                        </span>
                        <span
                          className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ${CONFIDENCE_STYLES[level]}`}
                          title={t.confidenceHint}
                        >
                          {t.confidence[level]} · {Math.round(metric.confidence * 100)} %
                        </span>
                        {metric.details.flag === "watch" && (
                          <span
                            className="inline-flex h-6 items-center rounded-full bg-orange-100 px-2 text-xs font-medium text-orange-900"
                            title={t.watchHint}
                          >
                            {t.watch}
                          </span>
                        )}
                      </span>
                    </div>
                    {left !== undefined && right !== undefined && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.sides(
                          formatValue(metric.key, metric.unit, left),
                          formatValue(metric.key, metric.unit, right),
                        )}
                      </p>
                    )}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        {t.howMeasured}
                      </summary>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                        {metric.details.flag === "watch" && ` ${t.watchHint}`}
                      </p>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {missing.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t.missing(missing.map((key) => t.items[key].label.toLowerCase()).join(", "))}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t.confidenceHint}</p>
    </article>
  );
}
