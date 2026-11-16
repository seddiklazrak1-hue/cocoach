"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/lib/i18n/fr";
import { HOME_PATH } from "@/lib/routes";

const LINKS = [
  { href: HOME_PATH, label: fr.nav.dashboard },
  { href: "/groups", label: fr.nav.groups },
  { href: "/athletes", label: fr.nav.athletes },
] as const;

/** Navigation principale du coach, avec la section courante mise en avant. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="border-b">
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex h-11 items-center border-b-2 border-primary px-3 text-sm font-medium whitespace-nowrap"
                    : "flex h-11 items-center border-b-2 border-transparent px-3 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
