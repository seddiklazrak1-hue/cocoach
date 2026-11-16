import Link from "next/link";
import { Brand, MedicalDisclaimer } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { fr } from "@/lib/i18n/fr";
import { LOGIN_PATH, SIGNUP_PATH } from "@/lib/routes";

export default function LandingPage() {
  const t = fr.landing;

  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Brand />
        <Link
          href={LOGIN_PATH}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          {t.ctaLogin}
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">
        <section className="flex flex-col items-start gap-6 py-12 sm:py-20">
          <p className="text-sm font-medium text-primary">
            {fr.common.tagline}
          </p>
          <h1 className="max-w-3xl font-heading text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            {t.title}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {t.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={SIGNUP_PATH}
              className={buttonVariants({ size: "lg", className: "h-11 px-5" })}
            >
              {t.ctaSignup}
            </Link>
            <Link
              href={LOGIN_PATH}
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "h-11 px-5",
              })}
            >
              {t.ctaLogin}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-12 sm:grid-cols-3">
          {t.features.map((feature) => (
            <div key={feature.title} className="rounded-xl border p-5">
              <h2 className="font-heading text-base font-semibold">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <MedicalDisclaimer />
      </footer>
    </>
  );
}
