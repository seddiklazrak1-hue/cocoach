import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DangerZone } from "@/components/roster/danger-zone";
import { GroupForm } from "@/components/roster/group-form";
import { fr } from "@/lib/i18n/fr";
import { deleteGroup, updateGroup } from "@/lib/roster/actions";
import { getGroup } from "@/lib/roster/queries";
import { groupToRaw } from "@/lib/roster/schemas";

const t = fr.roster.groups;

export const metadata: Metadata = { title: t.editTitle };

export default async function EditGroupPage({
  params,
}: PageProps<"/groups/[id]/edit">) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <PageHeader
        title={t.editTitle}
        back={{ href: `/groups/${group.id}`, label: group.name }}
      />
      <GroupForm
        action={updateGroup.bind(null, group.id)}
        initial={groupToRaw(group)}
        submitLabel={t.save}
      />
      <DangerZone
        action={deleteGroup.bind(null, group.id)}
        title={t.dangerTitle}
        body={t.dangerBody}
        confirmName={group.name}
        submitLabel={t.deleteSubmit}
      />
    </div>
  );
}
