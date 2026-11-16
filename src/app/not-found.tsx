import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { HOME_PATH } from "@/lib/routes";

const t = fr.roster.notFound;

/** Page 404 en français (par défaut Next.js l'affiche en anglais). */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
      <Brand />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {t.title}
      </h1>
      <p className="text-muted-foreground">{t.body}</p>
      <Link
        href={HOME_PATH}
        className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
      >
        {t.back}
      </Link>
    </main>
  );
}
