import { AppNav } from "@/components/app-nav";
import { Brand, MedicalDisclaimer } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { requireCoach } from "@/lib/auth/current-coach";
import { fr } from "@/lib/i18n/fr";
import { HOME_PATH } from "@/lib/routes";

// Ces pages dépendent de la session : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

/** Coquille des pages réservées au coach connecté. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const coach = await requireCoach();

  return (
    <>
      <header>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Brand href={HOME_PATH} />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {coach.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="lg">
                {fr.auth.signOut}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <AppNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t">
        <MedicalDisclaimer />
      </footer>
    </>
  );
}
