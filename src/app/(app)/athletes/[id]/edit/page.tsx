import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AthleteForm } from "@/components/roster/athlete-form";
import { fr } from "@/lib/i18n/fr";
import { updateAthlete } from "@/lib/roster/actions";
import {
  getAthlete,
  listGroups,
  listMemberships,
} from "@/lib/roster/queries";
import { athleteToRaw } from "@/lib/roster/schemas";

const t = fr.roster.athletes;

export const metadata: Metadata = { title: t.editTitle };

export default async function EditAthletePage({
  params,
}: PageProps<"/athletes/[id]/edit">) {
  const { id } = await params;
  const athlete = await getAthlete(id);
  if (!athlete) notFound();

  const [groups, memberships] = await Promise.all([
    listGroups(),
    listMemberships(),
  ]);
  const groupIds = memberships
    .filter((m) => m.athlete_id === athlete.id)
    .map((m) => m.group_id);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t.editTitle}
        back={{ href: `/athletes/${athlete.id}`, label: athlete.display_name }}
      />
      <AthleteForm
        action={updateAthlete.bind(null, athlete.id)}
        initial={athleteToRaw(athlete, groupIds)}
        groups={groups.map(({ id, name }) => ({ id, name }))}
        submitLabel={t.save}
      />
    </div>
  );
}
