import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { SessionStatusBadge } from "@/components/sessions/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { formatDate } from "@/lib/roster/labels";
import { listGroups } from "@/lib/roster/queries";
import { listSessions } from "@/lib/sessions/queries";

const t = fr.sessions;

export const metadata: Metadata = { title: t.title };

export default async function SessionsPage() {
  const [sessions, groups] = await Promise.all([listSessions(), listGroups()]);
  const groupName = new Map(groups.map((group) => [group.id, group.name]));

  const newButton = (
    <Link href="/sessions/new" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
      {t.new}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        actions={sessions.length > 0 ? newButton : undefined}
      />
      {sessions.length === 0 ? (
        <EmptyState
          title={t.empty}
          hint={groups.length === 0 ? t.noGroup : t.emptyHint}
          action={
            groups.length === 0 ? (
              <Link
                href="/groups/new"
                className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
              >
                {fr.roster.groups.new}
              </Link>
            ) : (
              newButton
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/sessions/${session.id}`}
                className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{formatDate(session.session_date)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {groupName.get(session.group_id) ?? "–"} · {t.kinds[session.kind]}
                    {session.duration_min !== null && ` · ${t.minutes(session.duration_min)}`}
                  </span>
                </span>
                <SessionStatusBadge status={session.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
