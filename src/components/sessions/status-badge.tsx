import { fr } from "@/lib/i18n/fr";
import type { SessionStatus } from "@/lib/sessions/domain";

const STYLES: Record<SessionStatus, string> = {
  draft: "border bg-background text-muted-foreground",
  captured: "bg-sky-50 text-sky-900",
  analyzed: "bg-emerald-50 text-emerald-800",
};

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium ${STYLES[status]}`}
    >
      {fr.sessions.statuses[status]}
    </span>
  );
}
