/**
 * First Light — feature-by-tier source of truth.
 *
 * One file lists every gateable feature, which tier it belongs to, and what
 * it does. Consumed by:
 *   - /pricing (public marketing page)
 *   - /app/features (in-app upgrade page)
 *   - /admin (live overrides via feature_flags table)
 *   - AI route handlers (isProFeature gates)
 *
 * To change what's gated, edit this file. To temporarily flip a gate without
 * a deploy, override via /admin (writes to public.feature_flags, which wins
 * over the static matrix at runtime — see src/lib/feature-flags.ts).
 *
 * Plan tiers:
 *   - free: default, no payment
 *   - pro:  paid via Stripe
 *   - vip:  admin-comped Pro access (free for the user, only the owner can grant)
 *   - team: reserved for future team plan
 */

export type Plan = "free" | "plus" | "pro" | "vip" | "team";
export type FeatureCategory =
  | "tasks"
  | "ai"
  | "calendar"
  | "review"
  | "data"
  | "platform";

export interface FeatureSpec {
  /** Stable id used by gates and feature_flags overrides. Snake_case, never rename. */
  id: string;
  /** Short human label shown on /pricing and /app/features. */
  label: string;
  /** One-sentence description shown under the label. */
  description: string;
  category: FeatureCategory;
  /** Lowest tier required to use this feature. */
  minPlan: Plan;
  /**
   * Optional free-tier soft limit (e.g. "1 / day"). When set, the feature
   * is *available* on free but capped — the cap is enforced by the route
   * (src/lib/ai-rate-limit.ts) or surfaced in the UI as a nudge.
   */
  freeLimit?: string;
  /** Order within its category for display. Lower = higher up. */
  order: number;
}

export const FEATURES: FeatureSpec[] = [
  // ─── Tasks (the core experience) ─────────────────────────────────────────
  { id: "tasks_today",         label: "Today",            description: "Your task list for the day, with AI-aware sorting.", category: "tasks", minPlan: "free", order: 10 },
  { id: "tasks_tomorrow",      label: "Tomorrow",         description: "Pre-stage tomorrow's work without losing today's focus.", category: "tasks", minPlan: "free", order: 20 },
  { id: "tasks_next7",         label: "Next 7 days",      description: "Week-ahead view that interleaves tasks and calendar events.", category: "tasks", minPlan: "free", order: 30 },
  { id: "tasks_next90",        label: "Next 90 days",     description: "Quarter-ahead horizon for projects and goals.", category: "tasks", minPlan: "free", order: 40 },
  { id: "tasks_inbox",         label: "Inbox",            description: "Capture-first surface for anything undated.", category: "tasks", minPlan: "free", order: 50 },
  { id: "tasks_lists",         label: "Lists",            description: "Group tasks into projects with their own filters.", category: "tasks", minPlan: "free", order: 60 },
  { id: "tasks_tags",          label: "Tags",             description: "Cross-cutting labels to slice work any way you want.", category: "tasks", minPlan: "free", order: 70 },
  { id: "tasks_groups",        label: "Groups",           description: "Bundle lists and tags into shared workspaces.", category: "tasks", minPlan: "free", order: 80 },
  { id: "tasks_matrix",        label: "The Sift matrix", description: "Urgent/important quadrants for triage decisions.", category: "tasks", minPlan: "free", order: 90 },
  { id: "tasks_pomodoro",      label: "Focus",            description: "Pomodoro-style timer wired to your active task.", category: "tasks", minPlan: "free", order: 100 },
  { id: "tasks_habits",        label: "Habits",           description: "Light-touch streak tracking for daily routines.", category: "tasks", minPlan: "free", order: 110 },
  { id: "tasks_notes",         label: "Notes",            description: "Free-form notes attached to tasks or standalone.", category: "tasks", minPlan: "free", order: 120 },
  { id: "tasks_notes_to_task", label: "Notes → Task",     description: "One click turns any note into a linked task and vice versa.", category: "tasks", minPlan: "free", order: 125 },
  { id: "tasks_completed",     label: "Completed log",    description: "Searchable history of everything you've finished.", category: "tasks", minPlan: "free", order: 130 },

  // ─── Calendar ──────────────────────────────────────────────────────────
  { id: "cal_view",            label: "Calendar view",    description: "Month / week / day grid with tasks and events together.", category: "calendar", minPlan: "free", order: 10 },
  { id: "cal_gcal_read",       label: "Google Calendar (read)", description: "See your Google events alongside tasks across all views.", category: "calendar", minPlan: "free", order: 20 },
  { id: "cal_drag",            label: "Drag-to-reschedule",description: "Drag tasks and events to new dates from any view.", category: "calendar", minPlan: "free", order: 30 },
  { id: "cal_gcal_write",      label: "Google Calendar (two-way sync)", description: "Quick-add creates GCal events; edits propagate back.", category: "calendar", minPlan: "plus", order: 40 },

  // ─── AI co-pilot ───────────────────────────────────────────────────────
  // Goals live here — designing a tracker for a project is intellectual work
  // and the AI is the thing that makes goals worth tracking.
  { id: "ai_daily_edition",    label: "Daily Edition",    description: "Personal morning briefing that pulls from tasks, calendar, and goals.", category: "ai", minPlan: "free", freeLimit: "1 / day", order: 10 },
  { id: "ai_plan_my_day",      label: "Plan my day",      description: "AI sequences your day around energy peaks and capacity.", category: "ai", minPlan: "pro", order: 20 },
  { id: "ai_plan_my_week",     label: "Plan my week",     description: "Weekly plan that respects deadlines, capacity, and goals.", category: "ai", minPlan: "pro", order: 30 },
  { id: "ai_morning_copilot",  label: "Morning Co-pilot", description: "Conversational briefing that answers follow-up questions.", category: "ai", minPlan: "pro", order: 40 },
  { id: "ai_voice_capture",    label: "Voice → Task",     description: "Speak tasks; we transcribe and structure them automatically.", category: "ai", minPlan: "pro", order: 50 },
  { id: "ai_snapshot_capture", label: "Snapshot → Task",  description: "Photo a sticky note, whiteboard, or napkin; we extract the tasks.", category: "ai", minPlan: "pro", order: 55 }, { id: "ai_paste_capture", label: "Paste → Task", description: "⌘V a screenshot of any whiteboard, doc, or meeting notes; we extract every task.", category: "ai", minPlan: "pro", order: 57 },
  { id: "ai_smart_eisenhower", label: "Smart triage",     description: "AI assigns Eisenhower quadrants based on context.", category: "ai", minPlan: "pro", order: 60 },
  { id: "ai_goal_tracker",     label: "Goal tracker",     description: "Outcome-shaped goals with AI-designed sub-trackers and weekly check-ins.", category: "ai", minPlan: "pro", order: 70 },
  { id: "ai_parse_task",       label: "Smart task parsing",   description: "NLP understands natural language and structures your tasks automatically.", category: "ai", minPlan: "free", order: 5 },
  { id: "ai_estimate_task",    label: "Time estimates",       description: "AI predicts how long each task will take based on context.", category: "ai", minPlan: "free", order: 6 },
  { id: "ai_translate_task",   label: "Task translation",     description: "Auto-translate tasks across languages for multilingual workflows.", category: "ai", minPlan: "free", order: 7 },
  { id: "ai_reschedule_task",  label: "Smart reschedule",     description: "AI finds the best new slot when you need to push tasks.", category: "ai", minPlan: "plus", order: 62 },
  { id: "ai_find_time",        label: "Find time",            description: "AI scans your calendar and suggests open slots for any task.", category: "ai", minPlan: "plus", order: 63 },
  { id: "ai_prep_meeting",     label: "Meeting prep",         description: "Auto-generate agendas and context briefs before meetings.", category: "ai", minPlan: "pro", order: 65 },
  { id: "ai_procrastination",  label: "Procrastination cleanup", description: "Weekly AI pass finds stuck tasks and suggests next moves.", category: "ai", minPlan: "pro", order: 68 },

  // ─── Review ───────────────────────────────────────────────────────────
  { id: "review_reflect",      label: "Reflection",       description: "End-of-day reflection with AI-assisted prompts.", category: "review", minPlan: "plus", order: 10 },
  { id: "review_weekly_retro", label: "Weekly review",    description: "Friday-style retro that surfaces patterns across the week.", category: "review", minPlan: "pro", order: 20 },

  // ─── Data ────────────────────────────────────────────────────────────
  { id: "data_export",         label: "Export your data", description: "Download everything as JSON whenever you want.", category: "data", minPlan: "free", order: 10 },
  { id: "data_import",         label: "Import",           description: "Move in from TickTick, Todoist, ICS, and CSV.", category: "data", minPlan: "free", order: 20 },
  { id: "data_inbox_email",    label: "Email-to-inbox",   description: "Forward to your private alias to capture into Inbox.", category: "data", minPlan: "free", order: 30 },
  { id: "data_semantic_search",label: "Semantic search",  description: "Find anything across tasks, notes, and comments by meaning.", category: "data", minPlan: "pro", order: 40 },

  // ─── Platform ─────────────────────────────────────────────────────────
  { id: "plat_push",           label: "Push notifications", description: "Browser and PWA push for reminders.", category: "platform", minPlan: "free", order: 10 },
  { id: "plat_email_digest",   label: "Email digest",     description: "Daily digest of what's on deck, by email.", category: "platform", minPlan: "free", order: 20 },
  { id: "plat_email_reminders",label: "Email reminders",  description: "Per-task email reminders for things you can't miss.", category: "platform", minPlan: "free", order: 30 },
  { id: "plat_priority_support", label: "Priority support", description: "We respond to Pro requests within one business day.", category: "platform", minPlan: "pro", order: 40 },
  { id: "plat_api_access",       label: "Public API + MCP",   description: "Issue access tokens and let Claude / OpenClaw / any MCP client read and edit your First Light.", category: "platform", minPlan: "pro", order: 50 },
];

export const PLANS: { plan: Plan; label: string; tagline: string }[] = [
  { plan: "free", label: "Free",  tagline: "The full task system, forever." },
  { plan: "plus", label: "Plus",  tagline: "Two-way calendar sync, unlimited Daily Editions, smart reschedule, find time, and end-of-day reflection." },
  { plan: "pro",  label: "Pro",   tagline: "Add the AI co-pilot — Plan my day, Voice → Task, and the full review suite." },
];

/**
 * Plan rank — higher number means a strictly better tier.
 * VIP and Pro share rank 1: VIP is just a payment-bypass for Pro access.
 */
// Rank by capability tier:
//   free=0, plus=1 (calendar + light AI), pro=2 (full AI co-pilot), team=3.
// VIP shares rank with pro — it's a payment-bypass for Pro access, not a tier.
const RANK: Record<Plan, number> = { free: 0, plus: 1, pro: 2, vip: 2, team: 3 };

/** Does `userPlan` satisfy `minPlan`? */
export function planSatisfies(userPlan: Plan, minPlan: Plan): boolean {
  return RANK[userPlan] >= RANK[minPlan];
}

/** Lookup a feature by id. Returns undefined if unknown. */
export function getFeature(id: string): FeatureSpec | undefined {
  return FEATURES.find((f) => f.id === id);
}

/** All features grouped by category, each list sorted by `order`. */
export function featuresByCategory(): Record<FeatureCategory, FeatureSpec[]> {
  const out = { tasks: [], ai: [], calendar: [], review: [], data: [], platform: [] } as Record<FeatureCategory, FeatureSpec[]>;
  for (const f of FEATURES) out[f.category].push(f);
  for (const k of Object.keys(out) as FeatureCategory[]) out[k].sort((a, b) => a.order - b.order);
  return out;
}

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  tasks: "Tasks",
  calendar: "Calendar",
  ai: "AI co-pilot",
  review: "Review",
  data: "Your data",
  platform: "Platform",
};

/**
 * Owner check — only this email can grant VIP and edit landing-page content.
 * Reads ADMIN_OWNER_EMAIL env var, falls back to the canonical owner.
 */
export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const owner = (process.env.ADMIN_OWNER_EMAIL ?? "anytime.sync@gmail.com")
    .trim()
    .toLowerCase();
  return email.toLowerCase() === owner;
}
