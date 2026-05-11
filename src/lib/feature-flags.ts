/**
 * Round Z2: feature-flag resolver.
 *
 * The static FEATURES array in `src/lib/plans.ts` is the default tier for
 * every feature. The `public.feature_flags` table can override that default
 * at runtime (managed via /admin), so you can flip "Plan-my-day" from Pro to
 * Free without redeploying.
 *
 * Use:
 *   - getEffectiveFeatures() — server-side, returns FEATURES merged with overrides.
 *   - canUseFeature(userPlan, featureId) — server-side gate for AI routes.
 *   - isAdmin(email) — env-driven admin allowlist (ADMIN_EMAILS, comma-separated).
 */

import { createClient } from "@supabase/supabase-js";
import {
  FEATURES,
  getFeature as getStaticFeature,
  planSatisfies,
  isOwner,
  type FeatureSpec,
  type Plan,
} from "@/lib/plans";

export type FeatureFlagRow = {
  feature_id: string;
  override_plan: Plan | null;
  disabled: boolean;
  note: string | null;
  updated_at: string;
  updated_by: string | null;
};

let cached: { rows: FeatureFlagRow[]; at: number } | null = null;
const CACHE_MS = 30_000; // 30s — short, since admin edits should propagate fast

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_misconfigured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadFlags(force = false): Promise<FeatureFlagRow[]> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.rows;
  try {
    const sb = service();
    const { data, error } = await sb
      .from("feature_flags")
      .select("feature_id,override_plan,disabled,note,updated_at,updated_by");
    if (error) throw error;
    const rows = (data ?? []) as FeatureFlagRow[];
    cached = { rows, at: Date.now() };
    return rows;
  } catch (e) {
    // If the table doesn't exist yet (migration not applied), behave as if no
    // overrides exist. The /admin page will surface a setup hint.
    console.warn("[feature-flags] could not load — falling back to code matrix:", e);
    cached = { rows: [], at: Date.now() };
    return [];
  }
}

/** Drop the in-memory cache. Called from the admin route after a write. */
export function invalidateFlagCache() {
  cached = null;
}

/**
 * Resolve a single feature's *effective* spec by merging code default + DB override.
 * Returns null if the feature was disabled by an override.
 */
export async function getEffectiveFeature(
  id: string
): Promise<FeatureSpec | null> {
  const base = getStaticFeature(id);
  if (!base) return null;
  const flags = await loadFlags();
  const f = flags.find((r) => r.feature_id === id);
  if (!f) return base;
  if (f.disabled) return null;
  if (f.override_plan && f.override_plan !== base.minPlan) {
    return { ...base, minPlan: f.override_plan };
  }
  return base;
}

/** Same as FEATURES but with overrides applied. Disabled features are filtered out. */
export async function getEffectiveFeatures(): Promise<FeatureSpec[]> {
  const flags = await loadFlags();
  const byId = new Map(flags.map((r) => [r.feature_id, r] as const));
  const out: FeatureSpec[] = [];
  for (const f of FEATURES) {
    const flag = byId.get(f.id);
    if (flag?.disabled) continue;
    if (flag?.override_plan && flag.override_plan !== f.minPlan) {
      out.push({ ...f, minPlan: flag.override_plan });
    } else {
      out.push(f);
    }
  }
  return out;
}

/**
 * Server-side gate: can this user use this feature?
 * Returns false if the feature is unknown, disabled, or above the user's plan.
 */
export async function canUseFeature(
  userPlan: Plan,
  featureId: string
): Promise<boolean> {
  const f = await getEffectiveFeature(featureId);
  if (!f) return false;
  return planSatisfies(userPlan, f.minPlan);
}

/**
 * Admin allowlist driven by env. Set ADMIN_EMAILS to a comma-separated list of
 * emails on Vercel (e.g. ADMIN_EMAILS="anytime.sync@gmail.com,you@yours.com").
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  // The canonical owner is always an admin, regardless of the env allowlist.
  if (isOwner(email)) return true;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
