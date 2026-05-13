import { redirect } from "next/navigation";

/**
 * /app/admin/* — moved to /admin/*.
 *
 * Everything that used to live under /app/admin (Feature flags, Members,
 * Design CMS) now lives under the standalone /admin shell. This layout
 * exists only to redirect old in-app bookmarks; it does not render a UI.
 */
export default function AppAdminLayout(): never {
  redirect("/admin");
}
