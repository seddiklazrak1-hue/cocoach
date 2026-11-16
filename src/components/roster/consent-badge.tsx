import { fr } from "@/lib/i18n/fr";

/** Indique d'un coup d'œil si l'athlète peut être analysé (texte + couleur, jamais la couleur seule). */
export function ConsentBadge({ allowed }: { allowed: boolean }) {
  return (
    <span
      className={
        allowed
          ? "inline-flex h-6 shrink-0 items-center rounded-full bg-emerald-50 px-2.5 text-xs font-medium text-emerald-800"
          : "inline-flex h-6 shrink-0 items-center rounded-full bg-amber-50 px-2.5 text-xs font-medium text-amber-900"
      }
    >
      {allowed ? fr.roster.consent.allowed : fr.roster.consent.blocked}
    </span>
  );
}
