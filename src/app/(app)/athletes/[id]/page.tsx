import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ConsentBadge } from "@/components/roster/consent-badge";
import { ConsentForm } from "@/components/roster/consent-form";
import { DangerZone } from "@/components/roster/danger-zone";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { deleteAthlete, recordConsent } from "@/lib/roster/actions";
import { ageOn, isMinor } from "@/lib/roster/domain";
import { formatDate, formatDateTime } from "@/lib/roster/labels";
import {
  getAthlete,
  listConsents,
  listGroups,
  listMemberships,
} from "@/lib/roster/queries";

const t = fr.roster.athletes;
const tc = fr.roster.consent;

export const metadata: Metadata = { title: t.profile };

export default async function AthletePage({
  params,
}: PageProps<"/athletes/[id]">) {
  const { id } = await params;
  const athlete = await getAthlete(id);
  if (!athlete) notFound();

  const [consents, groups, memberships] = await Promise.all([
    listConsents(athlete.id),
    listGroups(),
    listMemberships(),
  ]);
  const groupIds = new Set(
    memberships
      .filter((m) => m.athlete_id === athlete.id)
      .map((m) => m.group_id),
  );
  const athleteGroups = groups.filter((group) => groupIds.has(group.id));
  const minor = isMinor(athlete.birth_date);
  // Garde-fou d'installation : si la migration du journal n'a pas été exécutée,
  // une entrée est ajoutée sans que le statut suive. On le signale clairement.
  const outOfSync =
    consents.length > 0 && consents[0].status !== athlete.consent_status;

  const facts: Array<[label: string, value: string]> = [
    [
      t.discipline,
      athlete.discipline
        ? fr.roster.disciplines[athlete.discipline]
        : t.disciplineNone,
    ],
    [t.level, fr.roster.levels[athlete.level]],
  ];
  if (athlete.weight_kg !== null) {
    facts.push([t.weightShort, t.weightValue(athlete.weight_kg)]);
  }
  if (athlete.height_cm !== null) {
    facts.push([t.heightShort, t.heightValue(athlete.height_cm)]);
  }
  if (athlete.birth_date !== null) {
    facts.push([
      t.birthDate,
      `${formatDate(athlete.birth_date)} (${t.age(ageOn(athlete.birth_date))})`,
    ]);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title={athlete.display_name}
        back={{ href: "/athletes", label: t.title }}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            <ConsentBadge allowed={athlete.analysis_allowed} />
            {minor && (
              <span className="inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium">
                {t.minor}
              </span>
            )}
          </div>
        }
        actions={
          <Link
            href={`/athletes/${athlete.id}/edit`}
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
        <h2 className="font-heading text-lg font-semibold">{t.profile}</h2>
        <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">{t.groups}</dt>
            <dd className="font-medium">
              {athleteGroups.length === 0
                ? t.noGroup
                : athleteGroups.map((group, index) => (
                    <span key={group.id}>
                      {index > 0 && ", "}
                      <Link
                        href={`/groups/${group.id}`}
                        className="underline underline-offset-4"
                      >
                        {group.name}
                      </Link>
                    </span>
                  ))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">{tc.title}</h2>
          <p className="mt-1 font-medium">{tc.statuses[athlete.consent_status]}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {tc.explain}
          </p>
        </div>

        {outOfSync && (
          <p
            role="alert"
            className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            {tc.outOfSync}
          </p>
        )}

        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer font-medium">{tc.change}</summary>
          <div className="mt-4">
            <ConsentForm
              // `key` : le formulaire repart de zéro après chaque enregistrement.
              key={consents[0]?.id ?? "initial"}
              action={recordConsent.bind(null, athlete.id)}
              current={athlete.consent_status}
              minor={minor}
            />
          </div>
        </details>

        <div>
          <h3 className="font-medium">{tc.journal}</h3>
          <p className="text-sm text-muted-foreground">{tc.journalHint}</p>
          {consents.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {tc.journalEmpty}
            </p>
          ) : (
            <ol className="mt-2 divide-y rounded-xl border">
              {consents.map((entry) => (
                <li key={entry.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{tc.statuses[entry.status]}</p>
                  <p className="text-muted-foreground">
                    <time dateTime={entry.recorded_at}>
                      {formatDateTime(entry.recorded_at)}
                    </time>
                    {entry.note && ` · ${entry.note}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <DangerZone
        action={deleteAthlete.bind(null, athlete.id)}
        title={t.dangerTitle}
        body={t.dangerBody}
        confirmName={athlete.display_name}
        submitLabel={t.deleteSubmit}
      />
    </div>
  );
}
