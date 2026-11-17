import type { ReactNode } from "react";
import { fr } from "@/lib/i18n/fr";
import type { StoredInsight } from "@/lib/insights/schema";
import { confidenceLevel } from "@/lib/metrics/format";
import type { StoredMetric } from "@/lib/metrics/queries";
import type { MetricKey } from "@/lib/metrics/types";

const t = fr.insights;

/** Recommandations d'un athlète, avec les métriques citées pour chaque point. */
export function InsightReport({ insight, metrics }: { insight: StoredInsight; metrics: StoredMetric[] }) {
  const toConfirm = new Set(insight.to_confirm);
  const confidenceOf = new Map(metrics.map((m) => [m.key, m.confidence]));

  // Chaque conseil affiche les métriques qui le justifient (traçabilité), avec
  // la mention « à confirmer » quand leur fiabilité est moyenne.
  const Cited = ({ keys }: { keys: readonly MetricKey[] }) => (
    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span>{t.basedOn} :</span>
      {keys.map((key) => {
        const pending =
          toConfirm.has(key) || confidenceLevel(confidenceOf.get(key) ?? 0) !== "high";
        return (
          <span key={key} className="rounded-full border px-2 py-0.5">
            {fr.metrics.items[key].label}
            {pending && <span className="text-amber-800"> · {t.toConfirm}</span>}
          </span>
        );
      })}
    </p>
  );

  const source =
    insight.source === "claude"
      ? t.sourceClaude(insight.model ?? "Claude")
      : insight.source === "rules"
        ? t.sourceRules
        : t.sourceInsufficient;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
      <div>
        <h4 className="font-heading text-base font-semibold">{t.title}</h4>
        <p className="text-xs text-muted-foreground">
          {source}. {t.reviewHint}
        </p>
      </div>

      <Block title={t.summary}>
        <p className="text-sm leading-relaxed">{insight.summary}</p>
      </Block>

      {insight.strengths.length > 0 && (
        <Block title={t.strengths}>
          <ul className="flex flex-col gap-2">
            {insight.strengths.map((item) => (
              <li key={item.title} className="text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="leading-relaxed text-muted-foreground">{item.detail}</p>
                <Cited keys={item.metrics} />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {insight.improvements.length > 0 && (
        <Block title={t.improvements}>
          <ol className="flex flex-col gap-2">
            {[...insight.improvements]
              .sort((a, b) => a.priority - b.priority)
              .map((item) => (
                <li key={item.title} className="text-sm">
                  <p className="font-medium">
                    <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs">{t.priority(item.priority)}</span>
                    {item.title}
                  </p>
                  <p className="leading-relaxed text-muted-foreground">{item.detail}</p>
                  <Cited keys={item.metrics} />
                </li>
              ))}
          </ol>
        </Block>
      )}

      {insight.exercises.length > 0 && (
        <Block title={t.exercises}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {insight.exercises.map((exercise) => (
              <li key={exercise.name} className="rounded-lg border bg-background p-3 text-sm">
                <p className="text-xs text-muted-foreground">{t.exerciseKinds[exercise.kind]}</p>
                <p className="font-medium">{exercise.name}</p>
                <p className="leading-relaxed text-muted-foreground">{exercise.how}</p>
                <p className="mt-1 font-medium">{exercise.dose}</p>
                <Cited keys={exercise.metrics} />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {insight.alerts.length > 0 && (
        <Block title={t.alerts}>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">
            <ul className="flex flex-col gap-2">
              {insight.alerts.map((alert) => (
                <li key={alert.signal}>
                  <p>{alert.signal}</p>
                  <Cited keys={alert.metrics} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">{t.alertsHint}</p>
          </div>
        </Block>
      )}

      {insight.week_plan.length > 0 && (
        <Block title={t.weekPlan}>
          <ol className="flex flex-col gap-1.5 text-sm">
            {insight.week_plan.map((day) => (
              <li key={day.day}>
                <span className="font-medium">{day.day}</span> · {day.focus} : {day.content}
              </li>
            ))}
          </ol>
        </Block>
      )}

      <Block title={t.reliability}>
        <p className="text-sm leading-relaxed text-muted-foreground">{insight.reliability}</p>
      </Block>
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="text-sm font-medium text-muted-foreground">{title}</h5>
      {children}
    </div>
  );
}
