import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session-proxy";

// Next.js 16 : `proxy.ts` remplace l'ancien `middleware.ts`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Tout sauf les fichiers statiques et les images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
