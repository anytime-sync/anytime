"use client";

import { useEffect, useState } from "react";
import { Plus, UserPlus, Check, X, Settings, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

  // Fetch the member list for every owned group whenever the groups list refreshes.
  // Each call is cheap (RLS already restricts visibility to the same group).
  async function loadMembers(groupIds: string[]) {
    const results = await Promise.all(
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
    setMembersByGroup(Object.fromEntries(results));
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
      toast.error(j.error ?? "Rename failed");
      return;
    }
    toast.success("Renamed");
    setEditOpen(null);
    setEditName("");
    reload();
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`Delete the group "${name}"? Tasks shared into it stay, but the share link is broken. This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/share-groups/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Delete failed");
      return;
    }
    toast.success("Group deleted");
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
    if (groupIds.length) loadMembers(groupIds);
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
      toast.error(`${j.error ?? "Create failed"} (${res.status})`);
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
      toast.error(j.error ?? "Invite failed");
      return;
    }
    toast.success(`Invite created for ${inviteEmail.trim()} (awaiting your approval)`);
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
      toast.error(j.error ?? "Action failed");
      return;
    }
    toast.success(action === "accept" ? "Joined" : action === "approve" ? "Approved" : action === "decline" ? "Declined" : "Revoked");
    reload();
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl">
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight">Groups</h1>
        <p className="text-sm text-muted-fg mt-2 italic font-display">
          Share tasks with people you trust. Owners approve every invite before it goes out.
        </p>
      </header>

      {/* Create */}
      <form onSubmit={createGroup} className="surface border border-border rounded-lg p-4 flex gap-2 mb-8">
        <input
          className="input flex-1"
          placeholder="New group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn-primary h-9 px-3 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="size-4" />
          Create
        </button>
      </form>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
            Pending invites ({invites.length})
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
                      {inv.group?.name ?? "(unknown group)"}
                    </div>
                    <div className="text-xs text-muted-fg">
                      {inv.invitee_email} · {inv.status} ·{" "}
                      {format(new Date(inv.created_at), "MMM d")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isInvitee ? (
                      <>
                        <button
                          onClick={() => respond(inv.id, "accept")}
                          className="btn-primary h-8 px-2 text-xs inline-flex items-center gap-1"
                        >
                          <Check className="size-3" /> Accept
                        </button>
                        <button
                          onClick={() => respond(inv.id, "decline")}
                          className="btn-ghost h-8 px-2 text-xs inline-flex items-center gap-1 text-danger"
                        >
                          <X className="size-3" /> Decline
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => respond(inv.id, "approve")}
                          className="btn-primary h-8 px-2 text-xs inline-flex items-center gap-1"
                        >
                          <Check className="size-3" /> Approve
                        </button>
                        <button
                          onClick={() => respond(inv.id, "decline")}
                          className="btn-ghost h-8 px-2 text-xs inline-flex items-center gap-1 text-danger"
                        >
                          <X className="size-3" /> Decline
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
          Your groups
        </h2>
        {loading && <p className="text-muted-fg italic">Loading&hellip;</p>}
        {!loading && groups.length === 0 && (
          <p className="text-muted-fg italic">No groups yet &mdash; create one above.</p>
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
                  {g.role}
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
                      const display = m.profile?.full_name ?? m.profile?.email ?? "(unknown)";
                      return (
                        <li key={m.user_id} className="inline-flex items-center gap-1.5">
                          <span className="size-5 rounded-full bg-accent/20 text-accent text-[11px] font-medium grid place-items-center shrink-0">
                            {(display.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase()}
                          </span>
                          <span className="truncate text-fg">{display}</span>
                          {m.role === "owner" && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-fg">owner</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {g.role === "owner" && (
                <div className="mt-3 space-y-2">
                  {inviteOpen === g.group.id ? (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        autoFocus
                        className="input flex-1 h-8 text-sm"
                        placeholder="invitee@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                      <button
                        onClick={() => invite(g.group.id)}
                        disabled={busy || !inviteEmail.trim()}
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => {
                          setInviteOpen(null);
                          setInviteEmail("");
                        }}
                        className="btn-ghost h-8 px-2 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : editOpen === g.group.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        autoFocus
                        className="input flex-1 h-8 text-sm"
                        placeholder="Group name"
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
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditOpen(null);
                          setEditName("");
                        }}
                        className="btn-ghost h-8 px-2 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setInviteOpen(g.group.id)}
                        className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="size-3" /> Invite member
                      </button>
                      <button
                        onClick={() => {
                          setEditOpen(g.group.id);
                          setEditName(g.group.name);
                        }}
                        className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5"
                      >
                        <Settings className="size-3" /> Rename
                      </button>
                      <button
                        onClick={() => deleteGroup(g.group.id, g.group.name)}
                        disabled={busy}
                        className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="size-3" /> Delete
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
