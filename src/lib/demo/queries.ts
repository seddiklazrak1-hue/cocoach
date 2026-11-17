import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEMO_PREFIX } from "./generate";

/** La démo est-elle présente pour ce coach ? */
export async function isDemoLoaded(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id")
    .like("name", `${DEMO_PREFIX}%`)
    .limit(1);
  return !error && (data?.length ?? 0) > 0;
}
