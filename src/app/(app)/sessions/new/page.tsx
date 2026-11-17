import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/page-header";
import { SessionForm } from "@/components/sessions/session-form";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { toIsoDate } from "@/lib/roster/domain";
import { listGroups } from "@/lib/roster/queries";

const t = fr.sessions;

export const metadata: Metadata = { title: t.createTitle };

export default async function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  // `?groupe=<id>` : on arrive depuis la page d'un groupe.
  const { groupe } = await searchParams;
  const groups = await listGroups();
  const preselected = groups.find((group) => group.id === groupe) ?? groups[0];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t.createTitle} back={{ href: "/sessions", label: t.title }} />
      {groups.length === 0 ? (
        <EmptyState
          title={t.empty}
          hint={t.noGroup}
          action={
            <Link
              href="/groups/new"
              className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
            >
              {fr.roster.groups.new}
            </Link>
          }
        />
      ) : (
        <SessionForm
          groups={groups.map(({ id, name }) => ({ id, name }))}
          initial={{
            groupId: preselected.id,
            date: toIsoDate(new Date()),
            kind: "technique",
            durationMin: "",
          }}
        />
      )}
    </div>
  );
}
