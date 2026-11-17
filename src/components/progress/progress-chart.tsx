"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatValue } from "@/lib/metrics/format";
import type { MetricKey, MetricUnit } from "@/lib/metrics/types";

export type ChartPoint = { label: string; value: number };

/**
 * Courbe d'évolution d'une mesure. Les valeurs sont des estimations : elles
 * sont affichées avec leur unité, jamais sans contexte. Un tableau texte
 * équivalent est rendu à côté par la page (lecteurs d'écran, impression).
 */
export function ProgressChart({
  data,
  metricKey,
  unit,
  ariaLabel,
}: {
  data: ChartPoint[];
  metricKey: MetricKey;
  unit: MetricUnit;
  ariaLabel: string;
}) {
  const format = (value: number) => formatValue(metricKey, unit, value);
  return (
    <div role="img" aria-label={ariaLabel} className="h-64 w-full text-primary">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            domain={["auto", "auto"]}
            width={48}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
          />
          <Tooltip
            formatter={(value) => format(Number(value))}
            labelFormatter={(label) => `Séance du ${label}`}
            contentStyle={{
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2}
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
