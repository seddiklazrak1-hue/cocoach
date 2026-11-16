import Link from "next/link";
import { fr } from "@/lib/i18n/fr";

/** Logo texte de l'app, cliquable. */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 font-heading text-base font-semibold tracking-tight"
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        C
      </span>
      {fr.common.appName}
    </Link>
  );
}

/** Mention obligatoire « pas un dispositif médical », affichée en pied de page. */
export function MedicalDisclaimer() {
  return (
    <p className="mx-auto max-w-3xl px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
      {fr.common.notMedical}
    </p>
  );
}
