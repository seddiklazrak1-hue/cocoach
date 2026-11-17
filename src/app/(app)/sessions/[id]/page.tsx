import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipViewer } from "@/components/capture/clip-viewer";
import { PageHeader } from "@/components/page-header";
import { ConsentBadge } from "@/components/roster/consent-badge";
import { DangerZone } from "@/components/roster/danger-zone";
import { SessionStatusBadge } from "@/components/sessions/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { formatDate, formatDateTime } from "@/lib/roster/labels";
import { getGroup, listAthletes, listMemberships } from "@/lib/roster/queries";
import { deleteClip, deleteSession } from "@/lib/sessions/actions";
import { formatDuration } from "@/lib/sessions/domain";
import { getSession, listClips } from "@/lib/sessions/queries";

const t = fr.sessions;

export const metadata: Metadata = { title: t.title };

export default async function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const [group, athletes, memberships, clips] = await Promise.all([
    getGroup(session.group_id),
    listAthletes(),
    listMemberships(),
    listClips(session.id),
  ]);
  const memberIds = new Set(
    memberships.filter((m) => m.group_id === session.group_id).map((m) => m.athlete_id),
  );
  const members = athletes.filter((athlete) => memberIds.has(athlete.id));
  const blocked = members.filter((athlete) => !athlete.analysis_allowed).length;
  // Les noms de tous les athlètes : une séquence peut citer quelqu'un qui a changé de groupe depuis.
  const named = athletes.map(({ id, display_name }) => ({ id, name: display_name }));
  const nameOf = new Map(named.map((athlete) => [athlete.id, athlete.name]));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title={formatDate(session.session_date)}
        back={{ href: "/sessions", label: t.title }}
        subtitle={
          <div className="flex flex-wrap items-center gap-2">
            {group && (
              <Link href={`/groups/${group.id}`} className="underline underline-offset-4">
                {group.name}
              </Link>
            )}
            <span>· {t.kinds[session.kind]}</span>
            {session.duration_min !== null && <span>· {t.minutes(session.duration_min)}</span>}
            <SessionStatusBadge status={session.status} />
          </div>
        }
        actions={
          <Link
            href={`/sessions/${session.id}/capture`}
            className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
          >
            {t.capture}
          </Link>
        }
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.athletesTitle}</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.athletesEmpty}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {members.map((athlete) => (
                <li key={athlete.id}>
                  <Link
                    href={`/athletes/${athlete.id}`}
                    className="flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm hover:bg-muted/50"
                  >
                    {athlete.display_name}
                    <ConsentBadge allowed={athlete.analysis_allowed} />
                  </Link>
                </li>
              ))}
            </ul>
            {blocked > 0 && <p className="text-sm text-amber-800">{t.blockedWarning(blocked)}</p>}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.clipsTitle}</h2>
        {clips.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.clipsEmpty}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {clips.map((clip, index) => (
              <li key={clip.clipId} className="flex flex-col gap-3 rounded-xl border p-4">
                <div>
                  <p className="font-medium">
                    {t.clipLabel(index + 1)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      · {formatDateTime(clip.startedAt)}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.clipMeta(formatDuration(clip.durationS), clip.series.length)}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {clip.series.map((row) => (
                    <li key={row.athlete_id}>
                      <span className="font-medium">{nameOf.get(row.athlete_id) ?? "?"}</span>
                      {row.mean_confidence !== null && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({t.confidence(Math.round(row.mean_confidence * 100))})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <ClipViewer
                  series={clip.series.map((row) => ({
                    athleteId: row.athlete_id,
                    storagePath: row.storage_path,
                  }))}
                  athletes={named}
                />
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">{t.deleteClip}</summary>
                  <form action={deleteClip.bind(null, session.id, clip.clipId)} className="mt-2">
                    <Button type="submit" variant="destructive" size="lg" className="h-11">
                      {t.deleteClipConfirm}
                    </Button>
                  </form>
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>

      <DangerZone
        action={deleteSession.bind(null, session.id)}
        title={t.dangerTitle}
        body={t.dangerBody}
        confirmName={t.confirmWord}
        submitLabel={t.deleteSubmit}
      />
    </div>
  );
}
