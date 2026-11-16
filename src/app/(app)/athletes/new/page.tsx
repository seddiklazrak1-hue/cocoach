import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { AthleteForm } from "@/components/roster/athlete-form";
import { fr } from "@/lib/i18n/fr";
import { createAthlete } from "@/lib/roster/actions";
import { listGroups } from "@/lib/roster/queries";
import { EMPTY_ATHLETE } from "@/lib/roster/schemas";

const t = fr.roster.athletes;

export const metadata: Metadata = { title: t.createTitle };

export default async function NewAthletePage({
  searchParams,
}: PageProps<"/athletes/new">) {
  // `?groupe=<id>` : on arrive depuis la page d'un groupe, qu'on pré-coche.
  const { groupe } = await searchParams;
  const groups = await listGroups();
  const preselected = groups.some((group) => group.id === groupe)
    ? [groupe as string]
    : [];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t.createTitle}
        back={{ href: "/athletes", label: t.title }}
      />
      <AthleteForm
        action={createAthlete}
        initial={{ ...EMPTY_ATHLETE, groupIds: preselected }}
        groups={groups.map(({ id, name }) => ({ id, name }))}
        withConsent
        submitLabel={t.create}
      />
    </div>
  );
}
