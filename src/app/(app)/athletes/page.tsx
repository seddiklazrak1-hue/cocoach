import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ConsentBadge } from "@/components/roster/consent-badge";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import {
  listAthletes,
  listGroups,
  listMemberships,
} from "@/lib/roster/queries";

const t = fr.roster.athletes;

export const metadata: Metadata = { title: t.title };

export default async function AthletesPage({
  searchParams,
}: PageProps<"/athletes">) {
  const { efface } = await searchParams;
  const [athletes, groups, memberships] = await Promise.all([
    listAthletes(),
    listGroups(),
    listMemberships(),
  ]);

  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const groupsOf = (athleteId: string) =>
    memberships
      .filter((m) => m.athlete_id === athleteId)
      .map((m) => groupName.get(m.group_id))
      .filter(Boolean)
      .join(", ");

  const newButton = (
    <Link
      href="/athletes/new"
      className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
    >
      {t.new}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={athletes.length > 0 ? newButton : undefined}
      />

      {typeof efface === "string" && efface && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {t.deleted(efface)}
        </p>
      )}

      {athletes.length === 0 ? (
        <EmptyState title={t.empty} hint={t.emptyHint} action={newButton} />
      ) : (
        <ul className="divide-y rounded-xl border">
          {athletes.map((athlete) => (
            <li key={athlete.id}>
              <Link
                href={`/athletes/${athlete.id}`}
                className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block font-medium break-words">
                    {athlete.display_name}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {fr.roster.levels[athlete.level]} ·{" "}
                    {groupsOf(athlete.id) || t.noGroup}
                  </span>
                </span>
                <ConsentBadge allowed={athlete.analysis_allowed} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
