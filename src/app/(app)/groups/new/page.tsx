import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { GroupForm } from "@/components/roster/group-form";
import { fr } from "@/lib/i18n/fr";
import { createGroup } from "@/lib/roster/actions";

const t = fr.roster.groups;

export const metadata: Metadata = { title: t.createTitle };

export default function NewGroupPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t.createTitle}
        back={{ href: "/groups", label: t.title }}
      />
      <GroupForm action={createGroup} submitLabel={t.create} />
    </div>
  );
}
