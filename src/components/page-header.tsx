import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Lien de retour vers la liste parente. */
  back?: { href: string; label: string };
  /** Boutons d'action, alignés à droite sur grand écran. */
  actions?: ReactNode;
};

/** En-tête commun à toutes les pages de l'espace coach. */
export function PageHeader({ title, subtitle, back, actions }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight break-words">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1 text-muted-foreground">{subtitle}</div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Bloc affiché quand une liste est vide. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {action}
    </div>
  );
}
