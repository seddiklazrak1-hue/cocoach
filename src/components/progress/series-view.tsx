import Link from "next/link";
import { fr } from "@/lib/i18n/fr";
import { formatValue, confidenceLevel } from "@/lib/metrics/format";
import type { MetricKey, MetricUnit } from "@/lib/metrics/types";
import { endpoints, shortDate } from "@/lib/progress/domain";
import { ProgressChart } from "./progress-chart";

const t = fr.progress;

export type ViewPoint = {
  sessionId: string;
  date: string;
  value: number;
  /** Fiabilité (athlète) ou nombre d'athlètes (groupe) : une seule des deux est renseignée. */
  confidence?: number;
  athletes?: number;
  watch?: boolean;
};

export type View = {
  key: MetricKey;
  unit: MetricUnit;
  points: ViewPoint[];
};

/**
 * Sélecteur de mesure (liens, sans JavaScript), courbe, bilan chiffré et
 * tableau texte. Utilisé pour la progression d'un athlète comme pour le groupe.
 */
export function SeriesView({
  views,
  selected,
  hrefFor,
  ariaName,
  mode,
}: {
  views: View[];
  selected: View | undefined;
  hrefFor: (key: MetricKey) => string;
  ariaName: string;
  mode: "athlete" | "group";
}) {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.pick} className="flex flex-wrap gap-2">
        {views.map((view) => {
          const active = selected?.key === view.key;
          return (
            <Link
              key={view.key}
              href={hrefFor(view.key)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors ${
                active ? "border-foreground bg-foreground text-background" : "hover:bg-muted/50"
              }`}
            >
              {fr.metrics.items[view.key].label}
            </Link>
          );
        })}
      </nav>

      {selected && <SelectedView view={selected} ariaName={ariaName} mode={mode} />}
    </div>
  );
}

function SelectedView({ view, ariaName, mode }: { view: View; ariaName: string; mode: "athlete" | "group" }) {
  const label = fr.metrics.items[view.key].label;
  const bilan = endpoints(view.points);
  const fmt = (value: number) => formatValue(view.key, view.unit, value);

  return (
    <div className="flex flex-col gap-4">
      <ProgressChart
        data={view.points.map((p) => ({ label: shortDate(p.date), value: p.value }))}
        metricKey={view.key}
        unit={view.unit}
        ariaLabel={t.chartLabel(`${label} (${ariaName})`)}
      />

      {bilan && bilan.count > 1 && (
        <dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">{t.first}</dt>
            <dd className="font-medium tabular-nums">≈ {fmt(bilan.first)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t.last}</dt>
            <dd className="font-medium tabular-nums">≈ {fmt(bilan.last)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t.change}</dt>
            <dd className="font-medium tabular-nums">≈ {fmt(bilan.delta)}</dd>
            <dd className="text-xs text-muted-foreground">{t.changeHint}</dd>
          </div>
        </dl>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t.columns.date}</th>
              <th scope="col" className="px-4 py-2 font-medium">
                {mode === "group" ? t.columns.mean : t.columns.value}
              </th>
              {mode === "athlete" ? (
                <>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.reliability}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.watch}</th>
                </>
              ) : (
                <th scope="col" className="px-4 py-2 font-medium">{t.columns.athletes}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...view.points].reverse().map((point) => (
              <tr key={point.sessionId}>
                <td className="px-4 py-2 tabular-nums">{shortDate(point.date)}</td>
                {mode === "athlete" ? (
                  <>
                    <td className="px-4 py-2 tabular-nums">≈ {fmt(point.value)}</td>
                    <td className="px-4 py-2">
                      {point.confidence !== undefined
                        ? fr.metrics.confidence[confidenceLevel(point.confidence)]
                        : "–"}
                    </td>
                    <td className="px-4 py-2">{point.watch ? t.watchYes : t.watchNo}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 tabular-nums">≈ {fmt(point.value)}</td>
                    <td className="px-4 py-2 tabular-nums">{t.analysedCount(point.athletes ?? 0)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
