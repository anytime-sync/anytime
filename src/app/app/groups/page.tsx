"use client";

import { useEffect, useState } from "react";
import { Plus, UserPlus, Check, X, Settings, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLanguage } from "@/lib/use-language";
import { t as tr, getLanguage } from "@/lib/i18n";

type GroupRow = {
  role: "owner" | "member";
  joined_at: string;
  group: {
    id: string;
    name: string;
    description: string | null;
    created_by: string;
    created_at: string;
  };
};

type Invite = {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_user_id: string | null;
  status: string;
  created_at: string;
  group: { id: string; name: string } | null;
};

export default function GroupsPage() {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [membersByGroup, setMembersByGroup] = useState<
    Record<string, Array<{ user_id: string; role: "owner" | "member"; profile: { full_name: string | null; email: string } | null }>>
  >({});
  const [invitesByGroup, setInvitesByGroup] = useState<
    Record<string, Array<{ id: string; invitee_email: string; status: string; created_at: string }>>
  >({});

  // Fetch member + invite lists for every owned group whenever the groups
  // list refreshes. Both are cheap (RLS-gated) and rendering them inline
  // makes the approve / accept loop visible without a notification round-trip.
  async function loadGroupSidebars(groupIds: string[]) {
    const memberResults = await Promise.all(
      groupIds.map(async (id) => {
        try {
          const r = await fetch(`/api/share-groups/${id}/members`);
          if (!r.ok) return [id, []] as const;
          const j = await r.json();
          return [id, j.rows ?? []] as const;
        } catch {
          return [id, []] as const;
        }
      })
    );
    setMembersByGroup(Object.fromEntries(memberResults));

    const inviteResults = await Promise.all(
      groupIds.map(async (id) => {
        try {
          const r = await fetch(`/api/share-groups/${id}/invites`);
          if (!r.ok) return [id, []] as const;
          const j = await r.json();
          // Show only invites that still need action (approval or acceptance).
          const open = ((j.rows ?? []) as Array<{ status: string }>).filter(
            (i) => i.status === "pending_approval" || i.status === "pending_acceptance"
          );
          return [id, open] as const;
        } catch {
          return [id, []] as const;
        }
      })
    );
    setInvitesByGroup(Object.fromEntries(inviteResults));
  }

  async function respondToInvite(inviteId: string, action: "approve" | "revoke" | "decline" | "accept") {
    const res = await fetch(`/api/share-groups/invites/${inviteId}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? tr(lang, "view.groups.toast.couldntInvite").replace("{action}", action));
      return;
    }
    if (action === "approve") toast.success(tr(lang, "view.groups.toast.approved"));
    if (action === "revoke") toast.message(tr(lang, "view.groups.toast.revoked"));
    if (action === "decline") toast.message(tr(lang, "view.groups.toast.declined"));
    if (action === "accept") toast.success(tr(lang, "view.groups.toast.joined"));
    reload();
  }

  async function rename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await fetch(`/api/share-groups/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? tr(lang, "view.groups.toast.renameFailed"));
      return;
    }
    toast.success(tr(lang, "view.groups.toast.renamed"));
    setEditOpen(null);
    setEditName("");
    reload();
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(tr(lang, "view.groups.deleteConfirm").replace("{name}", name))) return;
    setBusy(true);
    const res = await fetch(`/api/share-groups/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? tr(lang, "view.groups.toast.deleteFailed"));
      return;
    }
    toast.success(tr(lang, "view.groups.toast.deleted"));
    reload();
  }

  async function reload() {
    setLoading(true);
    const [g, i] = await Promise.all([
      fetch("/api/share-groups").then((r) => r.json()),
      fetch("/api/share-groups/invites/mine").then((r) => r.json()),
    ]);
    setGroups((g.rows ?? []) as GroupRow[]);
    setInvites((i.rows ?? []) as Invite[]);
    // Pre-fetch members for every visible group so the UI can render
    // a roster line per group card without a per-card N+1 fetch later.
    const groupIds = ((g.rows ?? []) as GroupRow[]).map((r) => r.group.id);
    if (groupIds.length) loadGroupSidebars(groupIds);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/share-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      // Surface the actual server message + status so we can debug
      // future failures from the user-side toast itself.
      toast.error(`${j.error ?? tr(lang, "view.groups.toast.createFailed")} (${res.status})`);
      console.error("[groups] create failed", res.status, j);
      return;
    }
    setName("");
    reload();
  }

  async function invite(groupId: string) {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/share-groups/${groupId}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invitee_email: inviteEmail.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? tr(lang, "view.groups.toast.inviteFailed"));
      return;
    }
    toast.success(tr(lang, "view.groups.toast.inviteCreated").replace("{email}", inviteEmail.trim()));
    setInviteEmail("");
    setInviteOpen(null);
    reload();
  }

  async function respond(inviteId: string, action: "approve" | "decline" | "accept" | "revoke") {
    const res = await fetch(`/api/share-groups/invites/${inviteId}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? tr(lang, "view.groups.toast.actionFailed"));
      return;
    }
    toast.success(
      action === "accept"
        ? tr(lang, "view.groups.toast.acceptShort")
        : action === "approve"
        ? tr(lang, "view.groups.toast.approveShort")
        : action === "decline"
        ? tr(lang, "view.groups.toast.declineShort")
        : tr(lang, "view.groups.toast.revokeShort")
    );
    reload();
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl">
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight">{tr(lang, "view.groups.heading")}</h1>
        <p className="text-sm text-muted-fg mt-2 italic font-display">
          {tr(lang, "view.groups.subtitle")}
        </p>
      </header>

      {/* Create */}
      <form onSubmit={createGroup} className="surface border border-border rounded-lg p-4 flex gap-2 mb-8">
        <input
          className="input flex-1"
          placeholder={tr(lang, "view.groups.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn-primary h-9 px-3 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="size-4" />
          {tr(lang, "view.groups.create")}
        </button>
      </form>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
            {tr(lang, "view.groups.pendingInvites").replace("{n}", String(invites.length))}
          </h2>
          <ul className="space-y-2">
            {invites.map((inv) => {
              const isInvitee = inv.status === "pending_acceptance";
              return (
                <li
                  key={inv.id}
                  className="surface border border-border rounded-md p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display">
                      {inv.group?.name ?? tr(lang, "view.groups.unknownGroup")}
                    </div>
                    <div className="text-xs text-muted-fg">
                      {inv.invitee_email} · {inv.status} ·{" "}
                      {format(new Date(inv.created_at), "MMM d", { locale: dfLocale })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isInvitee ? (
                      <>
                        <button
                          onClick={() => respond(inv.id, "accept")}
                          className="btn-primary h-8 px-2 text-xs inline-flex items-center gap-1"
                        >
                          <Check className="size-3" /> {tr(lang, "view.groups.accept")}
                        </button>
                        <button
                          onClick={() => respond(inv.id, "decline")}
                          className="btn-ghost h-8 px-2 text-xs inline-flex items-center gap-1 text-danger"
                        >
                          <X className="size-3" /> {tr(lang, "view.groups.decline")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => respond(inv.id, "approve")}
                          className="btn-primary h-8 px-2 text-xs inline-flex items-center gap-1"
                        >
                          <Check className="size-3" /> {tr(lang, "view.groups.approveSend")}
                        </button>
                        <button
                          onClick={() => respond(inv.id, "decline")}
                          className="btn-ghost h-8 px-2 text-xs inline-flex items-center gap-1 text-danger"
                        >
                          <X className="size-3" /> {tr(lang, "view.groups.decline")}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Groups */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
          {tr(lang, "view.groups.yourGroups")}
        </h2>
        {loading && <p className="text-muted-fg italic">{tr(lang, "view.groups.loading")}</p>}
        {!loading && groups.length === 0 && (
          <p className="text-muted-fg italic">{tr(lang, "view.groups.noGroups")}</p>
        )}
        <ul className="space-y-2">
          {groups.map((g) => (
            <li
              key={g.group.id}
              className="surface border border-border rounded-md p-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg">{g.group.name}</span>
                <span className="editorial-number text-[10px] text-muted-fg">
                  {g.role === "owner" ? tr(lang, "view.groups.roleOwner") : tr(lang, "view.groups.roleMember")}
                </span>
              </div>
              {g.group.description && (
                <p className="text-sm text-muted-fg mt-1">{g.group.description}</p>
              )}
              {membersByGroup[g.group.id] && membersByGroup[g.group.id].length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-fg">
                  <Users className="size-3.5 shrink-0" />
                  <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                    {membersByGroup[g.group.id].map((m) => {
                      const display = m.profile?.full_name ?? m.profile?.email ?? tr(lang, "view.groups.unknownMember");
                      return (
                        <li key={m.user_id} className="inline-flex items-center gap-1.5">
                          <span className="size-5 rounded-full bg-accent/20 text-accent text-[11px] font-medium grid place-items-center shrink-0">
                            {(display.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase()}
                          </span>
                          <span className="truncate text-fg">{display}</span>
                          {m.role === "owner" && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-fg">{tr(lang, "view.groups.roleOwner")}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {/* Inline pending invites — owner sees both their own
                  unapproved invites (need their click) and already-
                  approved ones still waiting on the invitee. */}
              {invitesByGroup[g.group.id] && invitesByGroup[g.group.id].length > 0 && g.role === "owner" && (
                <ul className="mt-3 space-y-1.5">
                  {invitesByGroup[g.group.id].map((inv) => {
                    const isPendingApproval = inv.status === "pending_approval";
                    return (
                      <li
                        key={inv.id}
                        className={cn(
                          "border rounded-md px-3 py-2 flex items-center gap-2 text-sm",
                          isPendingApproval
                            ? "border-warning/60 bg-warning/5 text-warning"
                            : "border-border text-muted-fg"
                        )}
                      >
                        <span className="flex-1 min-w-0 truncate">
                          {isPendingApproval ? tr(lang, "view.groups.needsApproval") : tr(lang, "view.groups.awaiting")}
                          <span className="text-fg">{inv.invitee_email}</span>
                        </span>
                        {isPendingApproval && (
                          <button
                            onClick={() => respondToInvite(inv.id, "approve")}
                            className="btn-primary h-7 px-2.5 text-xs"
                          >
                            {tr(lang, "view.groups.approveSend")}
                          </button>
                        )}
                        <button
                          onClick={() => respondToInvite(inv.id, "revoke")}
                          className="btn-ghost h-7 px-2.5 text-xs text-muted-fg hover:text-warning"
                        >
                          {tr(lang, "view.groups.revoke")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {g.role === "owner" && (
                <div className="mt-3 space-y-2">
                  {inviteOpen === g.group.id ? (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        autoFocus
                        className="input flex-1 h-8 text-sm"
                        placeholder={tr(lang, "view.groups.invitePlaceholder")}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <button
                        onClick={() => invite(g.group.id)}
                        disabled={busy || !inviteEmail.trim()}
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        {tr(lang, "view.groups.send")}
                      </button>
                      <button
                        onClick={() => {
                          setInviteOpen(null);
                          setInviteEmail("");
                        }}
                        className="btn-ghost h-8 px-2 text-xs"
                      >
                        {tr(lang, "view.groups.cancel")}
                      </button>
                    </div>
                  ) : editOpen === g.group.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        className="input flex-1 h-8 text-sm"
                        placeholder={tr(lang, "view.groups.groupPlaceholder")}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") rename(g.group.id);
                          if (e.key === "Escape") {
                            setEditOpen(null);
                            setEditName("");
                          }
                        }}
                      />
                      <button
                        onClick={() => rename(g.group.id)}
                        disabled={busy || !editName.trim()}
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        {tr(lang, "view.groups.save")}
                      </button>
                      <button
                        onClick={() => {
                          setEditOpen(null);
                          setEditName("");
                        }}
                        className="btn-ghost h-8 px-2 text-xs"
                      >
                        {tr(lang, "view.groups.cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setInviteOpen(g.group.id)}
                        className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="size-3" /> {tr(lang, "view.groups.inviteMember")}
                      </button>
                      <button
                        onClick={() => {
                          setEditOpen(g.group.id);
                          setEditName(g.group.name);
                        }}
                        className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5"
                      >
                        <Settings className="size-3" /> {tr(lang, "view.groups.rename")}
                      </button>
                      <button
                        onClick={() => deleteGroup(g.group.id, g.group.name)}
                        disabled={busy}
                        className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="size-3" /> {tr(lang, "view.groups.delete")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
