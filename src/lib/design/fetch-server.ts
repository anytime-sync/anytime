import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DesignMap } from "./types";

/**
 * Server-side helper used by the root layout to seed <DesignProvider>
 * with the full site_design map. Public-read so anonymous landing
 * visitors get the overrides too.
 *
 * On any error we just return an empty map — design overrides should
 * never block the page from rendering.
 */
export async function fetchDesignMap(): Promise<DesignMap> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_design")
      .select("element_id, overrides");
    if (error || !data) return {};
    const out: DesignMap = {};
    for (const row of data as Array<{ element_id: string; overrides: unknown }>) {
      if (row.overrides && typeof row.overrides === "object") {
        out[row.element_id] = row.overrides as DesignMap[string];
      }
    }
    return out;
  } catch {
    return {};
  }
}
