import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChoiceRow } from "@/components/form/fields";
import { PageHeader } from "@/components/page-header";
import { ConsentBadge } from "@/components/roster/consent-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { addGroupMembers, removeGroupMember } from "@/lib/roster/actions";
import { formatSlot, sortSlots } from "@/lib/roster/labels";
import {
  getGroup,
  listAthletes,
  listMemberships,
} from "@/lib/roster/queries";

const t = fr.roster.groups;

export const metadata: Metadata = { title: t.title };

export default async function GroupPage({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const [athletes, memberships] = await Promise.all([
    listAthletes(),
    listMemberships(),
  ]);
  const memberIds = new Set(
    memberships.filter((m) => m.group_id === group.id).map((m) => m.athlete_id),
  );
  const members = athletes.filter((athlete) => memberIds.has(athlete.id));
  const others = athletes.filter((athlete) => !memberIds.has(athlete.id));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={group.name}
        back={{ href: "/groups", label: t.title }}
        subtitle={
          <>
            <p>
              {fr.roster.disciplines[group.discipline]} ·{" "}
              {fr.roster.levels[group.level]}
            </p>
            <p className="text-sm">
              {group.schedule.length === 0
                ? t.scheduleEmpty
                : sortSlots(group.schedule).map(formatSlot).join(", ")}
            </p>
          </>
        }
        actions={
          <Link
            href={`/groups/${group.id}/edit`}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "h-11 px-5",
            })}
          >
            {t.edit}
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {t.members}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({t.memberCount(members.length)})
          </span>
        </h2>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.membersEmpty}</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {members.map((athlete) => (
              <li
                key={athlete.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
              >
                <Link
                  href={`/athletes/${athlete.id}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 font-medium underline-offset-4 hover:underline"
                >
                  <span className="break-words">{athlete.display_name}</span>
                  <ConsentBadge allowed={athlete.analysis_allowed} />
                </Link>
                <form
                  action={removeGroupMember.bind(null, group.id, athlete.id)}
                >
                  <Button type="submit" variant="ghost" size="lg" className="h-11">
                    {t.removeMember}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/athletes/new?groupe=${group.id}`}
          className={buttonVariants({
            size: "lg",
            className: "h-11 self-start px-5",
          })}
        >
          {t.newAthleteHere}
        </Link>
      </section>

      {athletes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">{t.addMembers}</h2>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.addMembersNone}</p>
          ) : (
            <form
              action={addGroupMembers.bind(null, group.id)}
              className="flex flex-col gap-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {others.map((athlete) => (
                  <ChoiceRow
                    key={athlete.id}
                    type="checkbox"
                    name="athleteIds"
                    value={athlete.id}
                  >
                    {athlete.display_name}
                  </ChoiceRow>
                ))}
              </div>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="h-11 self-start px-5"
              >
                {t.addMembersSubmit}
              </Button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
