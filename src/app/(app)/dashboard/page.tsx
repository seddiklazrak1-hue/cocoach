import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tableau de bord" };

const t = fr.dashboard;

/** Compte les lignes visibles par le coach connecté (la RLS filtre côté base). */
async function countRows(table: "groups" | "athletes" | "sessions") {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  return error ? null : (count ?? 0);
}

export default async function DashboardPage() {
  const coach = await requireCoach();
  const [groups, athletes, sessions] = await Promise.all([
    countRows("groups"),
    countRows("athletes"),
    countRows("sessions"),
  ]);
  const dbUnreachable = [groups, athletes, sessions].some((n) => n === null);

  const tiles = [
    { label: t.groups, value: groups },
    { label: t.athletes, value: athletes },
    { label: t.sessions, value: sessions },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t.greeting(coach.displayName)}
        </h1>
        <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
      </div>

      {dbUnreachable && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          {t.dbError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {tile.value ?? "–"}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="text-sm text-muted-foreground">
          {t.emptyHint}
        </CardContent>
      </Card>
    </div>
  );
}
