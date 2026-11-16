import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { formatSlot, sortSlots } from "@/lib/roster/labels";
import { listGroups, listMemberships } from "@/lib/roster/queries";

const t = fr.roster.groups;

export const metadata: Metadata = { title: t.title };

export default async function GroupsPage() {
  const [groups, memberships] = await Promise.all([
    listGroups(),
    listMemberships(),
  ]);
  const memberCount = new Map<string, number>();
  for (const { group_id } of memberships) {
    memberCount.set(group_id, (memberCount.get(group_id) ?? 0) + 1);
  }

  const newButton = (
    <Link
      href="/groups/new"
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
        actions={groups.length > 0 ? newButton : undefined}
      />

      {groups.length === 0 ? (
        <EmptyState title={t.empty} hint={t.emptyHint} action={newButton} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex h-full flex-col gap-2 rounded-xl border p-4 transition-colors hover:bg-muted/50"
              >
                <span className="font-heading text-base font-semibold break-words">
                  {group.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {fr.roster.disciplines[group.discipline]} ·{" "}
                  {fr.roster.levels[group.level]} ·{" "}
                  {t.memberCount(memberCount.get(group.id) ?? 0)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {group.schedule.length === 0
                    ? t.scheduleEmpty
                    : sortSlots(group.schedule).map(formatSlot).join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
