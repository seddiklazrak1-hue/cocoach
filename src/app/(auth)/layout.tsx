import { Brand, MedicalDisclaimer } from "@/components/brand";
import { isSupabaseConfigured } from "@/lib/env";
import { fr } from "@/lib/i18n/fr";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto w-full max-w-5xl px-4 py-4">
        <Brand />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-8">
        {!isSupabaseConfigured && (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          >
            <p className="font-medium">{fr.auth.notConfigured.title}</p>
            <p className="mt-1 leading-relaxed">{fr.auth.notConfigured.body}</p>
          </div>
        )}
        {children}
      </main>
      <footer>
        <MedicalDisclaimer />
      </footer>
    </>
  );
}
