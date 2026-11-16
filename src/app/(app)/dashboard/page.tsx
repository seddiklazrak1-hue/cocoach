import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: fr.nav.dashboard };

const t = fr.dashboard;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Compte les lignes visibles par le coach connecté (la RLS filtre côté base). */
async function countRows(
  supabase: Supabase,
  table: "groups" | "athletes" | "sessions",
  onlyBlocked = false,
) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (onlyBlocked) query = query.eq("analysis_allowed", false);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

export default async function DashboardPage() {
  const coach = await requireCoach();
  const supabase = await createClient();
  const [groups, athletes, sessions, blocked] = await Promise.all([
    countRows(supabase, "groups"),
    countRows(supabase, "athletes"),
    countRows(supabase, "sessions"),
    countRows(supabase, "athletes", true),
  ]);
  const dbUnreachable = [groups, athletes, sessions].some((n) => n === null);

  const tiles = [
    { label: t.groups, value: groups, href: "/groups" },
    { label: t.athletes, value: athletes, href: "/athletes" },
    { label: t.sessions, value: sessions, href: null },
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
        {tiles.map((tile) => {
          const content = (
            <>
              <span className="text-sm text-muted-foreground">{tile.label}</span>
              <span className="font-heading text-3xl font-semibold tabular-nums">
                {tile.value ?? "–"}
              </span>
            </>
          );
          return tile.href ? (
            <Link
              key={tile.label}
              href={tile.href}
              className="flex flex-col gap-1 rounded-xl border p-4 transition-colors hover:bg-muted/50"
            >
              {content}
            </Link>
          ) : (
            <div
              key={tile.label}
              className="flex flex-col gap-1 rounded-xl border p-4"
            >
              {content}
            </div>
          );
        })}
      </div>

      {blocked !== null && blocked > 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div>
            <p className="font-medium">{t.blockedTitle(blocked)}</p>
            <p className="mt-1 text-sm leading-relaxed">{t.blockedBody}</p>
          </div>
          <Link
            href="/athletes"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 bg-white px-5",
            })}
          >
            {t.blockedCta}
          </Link>
        </div>
      )}

      {groups === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
          <div>
            <p className="font-medium">{t.startTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.startBody}</p>
          </div>
          <Link
            href="/groups/new"
            className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
          >
            {fr.roster.groups.new}
          </Link>
        </div>
      )}
    </div>
  );
}
