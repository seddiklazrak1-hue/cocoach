import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaptureStudio } from "@/components/capture/capture-studio";
import { PageHeader } from "@/components/page-header";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { formatDate } from "@/lib/roster/labels";
import { getGroup, listAthletes, listMemberships } from "@/lib/roster/queries";
import { getSession } from "@/lib/sessions/queries";

export const metadata: Metadata = { title: fr.capture.title };

export default async function CapturePage({ params }: PageProps<"/sessions/[id]/capture">) {
  const { id } = await params;
  const [coach, session] = await Promise.all([requireCoach(), getSession(id)]);
  if (!session) notFound();

  const [group, athletes, memberships] = await Promise.all([
    getGroup(session.group_id),
    listAthletes(),
    listMemberships(),
  ]);
  const memberIds = new Set(
    memberships.filter((m) => m.group_id === session.group_id).map((m) => m.athlete_id),
  );
  const members = athletes
    .filter((athlete) => memberIds.has(athlete.id))
    .map((athlete) => ({
      id: athlete.id,
      name: athlete.display_name,
      allowed: athlete.analysis_allowed,
    }));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={fr.capture.title}
        subtitle={group ? `${group.name} · ${formatDate(session.session_date)}` : undefined}
        back={{ href: `/sessions/${session.id}`, label: formatDate(session.session_date) }}
      />
      <CaptureStudio sessionId={session.id} coachId={coach.id} athletes={members} />
    </div>
  );
}
