"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Plan } from "@/lib/plans";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { Plus, X, Trash2, ShieldOff, ShieldCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  language: string;
  created_at: string;
  last_active: string | null;
  task_count: number;
  completed_count: number;
  pomodoro_count: number;
  banned_until: string | null;
  /** Hydrated client-side from /api/admin/users; absent for free users with no override. */
  plan?: Plan;
  override_plan_raw?: string | null;
  plan_status?: string | null;
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [inviting, setInviting] = useState(false);

  async function reload() {
    setLoading(true);
    const supabase = createClient();
    const { data, error: e } = await supabase.rpc("admin_members_list");
    if (e) setError(e.message);
    else setMembers((data ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  // Effective-plan + ownership for each member, hydrated from /api/admin/users.
  // Separate from the SQL RPC because the plan resolver wants the same
  // (manual override > Stripe > free) logic the rest of the app uses, which
  // already lives in /api/admin/users.
  const plansQ = useQuery({
    queryKey: ["admin", "members-plans"],
    queryFn: async () => {
      const r = await fetch("/api/admin/users?limit=500");
      if (!r.ok) return { users: [] as { id: string; plan: Plan; override_plan_raw: string | null; plan_status: string | null }[], viewer_is_owner: false };
      return (await r.json()) as { users: { id: string; plan: Plan; override_plan_raw: string | null; plan_status: string | null }[]; viewer_is_owner: boolean };
    },
  });
  const planByUserId = new Map<string, { plan: Plan; raw: string | null; planStatus: string | null }>(
    (plansQ.data?.users ?? []).map((u) => [u.id, { plan: u.plan, raw: u.override_plan_raw, planStatus: u.plan_status ?? null }])
  );
  const viewerIsOwner = plansQ.data?.viewer_is_owner ?? false;

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · Issue No. 02
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Members<em className="font-display">, by name.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          {members.length}{" "}
          {members.length === 1 ? "soul on the roster" : "souls on the roster"}{" "}
          · newest first
        </p>
        <div className="mt-8 flex items-center justify-between">
          <div className="h-px bg-accent/40 w-24" />
          <button
            onClick={() => setInviting(true)}
            className="btn-primary inline-flex items-center gap-1.5 px-3 h-9 text-sm"
          >
            <Plus className="size-4" />
            Invite member
          </button>
        </div>
      </header>

      {error && <p className="text-sm text-danger mb-6">{error}</p>}

      <div className="surface border border-border rounded-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left">
              <Th>Email</Th>
              <Th>Lang</Th>
              <Th>Joined</Th>
              <Th>Last active</Th>
              <Th>Plan</Th>
              <Th align="right">Tasks</Th>
              <Th align="right">Done</Th>
              <Th align="right">Pomodoros</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-muted-fg italic font-display"
                >
                  Reading the roster…
                </td>
              </tr>
            )}
            {!loading && members.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-muted-fg italic font-display"
                >
                  No members yet — the readership awaits.
                </td>
              </tr>
            )}
            {members.map((m) => {
              const disabled =
                m.banned_until && new Date(m.banned_until) > new Date();
              return (
                <tr
                  key={m.id}
                  onClick={() => setEditing(m)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-display text-base leading-tight flex items-center gap-2">
                      {m.full_name ?? m.email.split("@")[0]}
                      {disabled && (
                        <span className="editorial-number text-[9px] text-danger">
                          · disabled
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-fg">{m.email}</div>
                  </td>
                  <td className="px-4 py-3 editorial-number text-[10px]">
                    {m.language}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-fg tabular-nums">
                    {format(new Date(m.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-fg tabular-nums">
                    {m.last_active
                      ? format(new Date(m.last_active), "MMM d, h:mm a")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge
                      plan={planByUserId.get(m.id)?.plan ?? "free"}
                      raw={planByUserId.get(m.id)?.raw ?? null}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-display">
                    {m.task_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-fg">
                    {m.completed_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-fg">
                    {m.pomodoro_count.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditDialog
          member={{ ...editing, plan: planByUserId.get(editing.id)?.plan ?? "free", override_plan_raw: planByUserId.get(editing.id)?.raw ?? null, plan_status: planByUserId.get(editing.id)?.planStatus ?? null }}
          viewerIsOwner={viewerIsOwner}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            reload();
            plansQ.refetch();
          }}
        />
      )}
      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onInvited={() => {
            setInviting(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PlanBadge({ plan, raw }: { plan: "free" | "plus" | "pro" | "vip" | "team"; raw: string | null }) {
  // Pill colour communicates tier rank: muted for free, gold for pro/vip, blue for team.
  // The "raw" hint surfaces VIP comp distinctly so the admin can tell a comp from a real Pro.
  const label = raw === "vip" ? "VIP" : plan.toUpperCase();
  const tone =
    raw === "vip"
      ? "bg-accent/15 text-accent border-accent/30"
      : plan === "pro"
        ? "bg-accent/10 text-accent border-accent/20"
        : plan === "team"
          ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400"
          : "bg-muted/40 text-muted-fg border-border";
  return (
    <span
      className={`inline-flex items-center px-2 h-5 rounded-full border editorial-number text-[9px] tracking-wider ${tone}`}
      title={raw ? `manual override: ${raw}` : "plan resolved from Stripe / default"}
    >
      {label}
    </span>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={
        "px-4 py-3 editorial-number text-[10px] font-normal " +
        (align === "right" ? "text-right" : "")
      }
    >
      {children}
    </th>
  );
}

/* ---------------- Edit dialog ---------------- */

function EditDialog({
  member,
  viewerIsOwner,
  onClose,
  onChanged,
}: {
  member: Member;
  viewerIsOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(member.full_name ?? "");
  const [lang, setLang] = useState<LanguageCode>(
    (member.language as LanguageCode) ?? "en"
  );
  type PlanChoice = "free" | "plus" | "pro" | "vip" | "default";
  const initialPlan: PlanChoice = (member.override_plan_raw as PlanChoice | null) ?? "default";
  const [plan, setPlan] = useState<PlanChoice>(initialPlan);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const disabled =
    member.banned_until && new Date(member.banned_until) > new Date();
  const isPaidSubscriber = member.plan_status === "active" || member.plan_status === "trialing";

  async function viewAs() {
    setBusy(true);
    const res = await fetch("/api/admin/impersonate/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: member.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Impersonate failed");
      return;
    }
    const j = await res.json();
    if (j.ok && j.target_email) {
      // Cookie swap is done server-side — just navigate to the app and
      // we'll be authenticated as the target user.
      toast.success(`Signed in as ${j.target_email}. Opening their app…`);
      window.location.href = j.redirect ?? "/app";
      return;
    }
    // Legacy magic-link fallback (in case start route still returns a URL).
    if (j.url) {
      window.open(j.url, "_blank", "noopener,noreferrer");
      toast.success(`Signing in as ${j.target_email} in a new tab`);
    }
  }

  async function save() {
    setBusy(true);
    const [profileRes, planRes] = await Promise.all([
      fetch(`/api/admin/members/${member.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: name || null, language: lang }),
      }),
      plan !== initialPlan
        ? fetch(`/api/admin/users/${member.id}/plan`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ plan: plan === "default" ? null : plan }),
          })
        : Promise.resolve(null),
    ]);
    setBusy(false);
    if (!profileRes.ok) {
      const j = await profileRes.json().catch(() => ({}));
      toast.error(j.error ?? "Profile save failed");
      return;
    }
    if (planRes && !planRes.ok) {
      const j = await planRes.json().catch(() => ({}));
      toast.error(j.error ?? "Plan save failed");
      return;
    }
    toast.success("Saved");
    onChanged();
  }

  async function toggleDisable() {
    setBusy(true);
    const res = await fetch(`/api/admin/members/${member.id}/disable`, {
      method: disabled ? "DELETE" : "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed");
      return;
    }
    toast.success(disabled ? "Re-enabled" : "Disabled");
    onChanged();
  }

  async function hardDelete() {
    setBusy(true);
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Delete failed");
      return;
    }
    toast.success("Member deleted");
    onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card surface-strong w-full max-w-md p-7 space-y-5 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 grid place-items-center rounded-full hover:bg-muted text-muted-fg hover:text-fg transition"
        >
          <X className="size-4" />
        </button>

        <div>
          <p className="editorial-number text-[10px] mb-1">Member</p>
          <h2 className="font-display text-2xl tracking-tight">
            <em>{member.email}</em>
          </h2>
          {disabled && (
            <p className="text-[11px] text-danger editorial-number mt-2">
              · currently disabled
            </p>
          )}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="editorial-number text-[10px] mb-1.5 block">
              Full name
            </span>
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={member.email.split("@")[0]}
            />
          </label>

          <label className="block">
            <span className="editorial-number text-[10px] mb-1.5 block">
              Preferred language
            </span>
            <select
              className="input w-full"
              value={lang}
              onChange={(e) => setLang(e.target.value as LanguageCode)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="editorial-number text-[10px] mb-1.5 block">
              Plan
            </span>
            <select
              className="input w-full"
              value={plan}
              onChange={(e) => setPlan(e.target.value as typeof plan)}
              disabled={isPaidSubscriber}
            >
              <option value="default">Default (Stripe-resolved)</option>
              <option value="free">Free (override)</option>
              <option value="plus">Plus (manual comp)</option>
              <option value="pro">Pro (manual comp)</option>
              {viewerIsOwner ? <option value="vip">VIP (free Pro)</option> : null}
            </select>
            {isPaidSubscriber && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-display italic">
                Managed by Lemon Squeezy — admin overrides are disabled for paid subscribers.
              </p>
            )}
            <span className="block mt-1 text-[11px] text-muted-fg italic font-display">
              Effective now: <em>{member.plan ?? "free"}</em>
              {member.override_plan_raw ? ` (override: ${member.override_plan_raw})` : ""}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            onClick={save}
            disabled={busy}
            className="btn-primary px-4 h-9 text-sm"
          >
            Save changes
          </button>
          <button
            onClick={viewAs}
            disabled={busy}
            className="btn-ghost px-3 h-9 text-sm inline-flex items-center gap-1.5 text-accent"
            title="Open the member\u2019s app in a new tab as them"
          >
            <ExternalLink className="size-4" />
            View as
          </button>
          <button
            onClick={toggleDisable}
            disabled={busy}
            className={cn(
              "btn-ghost px-3 h-9 text-sm inline-flex items-center gap-1.5",
              disabled ? "text-fg" : "text-muted-fg"
            )}
          >
            {disabled ? (
              <>
                <ShieldCheck className="size-4" />
                Re-enable
              </>
            ) : (
              <>
                <ShieldOff className="size-4" />
                Disable
              </>
            )}
          </button>
          <div className="flex-1" />
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="btn-ghost px-3 h-9 text-sm inline-flex items-center gap-1.5 text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs italic font-display text-muted-fg">
                Sure?
              </span>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="btn-ghost px-2 h-8 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={hardDelete}
                disabled={busy}
                className="px-3 h-8 text-xs rounded-md bg-danger text-white"
              >
                Confirm delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Invite dialog ---------------- */

function InviteDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Invite failed");
      return;
    }
    toast.success(`Invite sent to ${email}`);
    onInvited();
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/30 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="card surface-strong w-full max-w-md p-7 space-y-5 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 grid place-items-center rounded-full hover:bg-muted text-muted-fg hover:text-fg transition"
        >
          <X className="size-4" />
        </button>

        <div>
          <p className="editorial-number text-[10px] mb-1">Invite</p>
          <h2 className="font-display text-2xl tracking-tight">
            <em>A new soul.</em>
          </h2>
          <p className="text-xs text-muted-fg mt-1.5 italic font-display">
            They'll get a magic-link email to claim their account.
          </p>
        </div>

        <label className="block">
          <span className="editorial-number text-[10px] mb-1.5 block">
            Email
          </span>
          <input
            type="email"
            required
            className="input w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@example.com"
            autoFocus
          />
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn-ghost px-3 h-9 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !email}
            className="btn-primary px-4 h-9 text-sm"
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
