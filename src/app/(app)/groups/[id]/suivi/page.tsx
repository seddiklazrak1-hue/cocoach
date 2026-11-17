import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SeriesView, type View } from "@/components/progress/series-view";
import { fr } from "@/lib/i18n/fr";
import { buildGroupSeries } from "@/lib/progress/domain";
import { getGroupProgress } from "@/lib/progress/queries";
import { formatDate } from "@/lib/roster/labels";
import { getGroup } from "@/lib/roster/queries";

const t = fr.progress;

export const metadata: Metadata = { title: t.groupTitle };

export default async function GroupProgressPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]/suivi">) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const [progress, query] = await Promise.all([getGroupProgress(group.id), searchParams]);
  const { series, sessions } = buildGroupSeries(progress.sessions, progress.rows);
  const views: View[] = series.map((s) => ({
    key: s.key,
    unit: s.unit,
    points: s.points.map((p) => ({
      sessionId: p.sessionId,
      date: p.date,
      value: p.mean,
      athletes: p.athletes,
    })),
  }));
  const requested = typeof query.m === "string" ? views.find((view) => view.key === query.m) : undefined;
  const selected = requested ?? views[0];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        title={t.groupTitle}
        back={{ href: `/groups/${group.id}`, label: group.name }}
        subtitle={<p>{t.groupSubtitle}</p>}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{t.sessionsTitle}</h2>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {t.sessionsEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.date}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.athletes}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t.columns.watch}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...sessions].reverse().map((session) => (
                  <tr key={session.sessionId}>
                    <td className="px-4 py-2">{formatDate(session.date)}</td>
                    <td className="px-4 py-2">
                      {session.analysedAthletes === 0 ? t.notAnalysed : t.analysedCount(session.analysedAthletes)}
                    </td>
                    <td className="px-4 py-2">
                      {session.analysedAthletes === 0 ? "–" : t.watchCount(session.watchAthletes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">{fr.progress.athleteTitle}</h2>
        {views.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {t.groupNoData}
          </p>
        ) : (
          <SeriesView
            views={views}
            selected={selected}
            hrefFor={(key) => `/groups/${group.id}/suivi?m=${key}`}
            ariaName={group.name}
            mode="group"
          />
        )}
      </section>
    </div>
  );
}
