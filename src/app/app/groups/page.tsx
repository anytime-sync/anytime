"use client";

import { useEffect, useState } from "react";
import { Plus, UserPlus, Check, X } from "lucide-react";
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

  async function reload() {
    setLoading(true);
    const [g, i] = await Promise.all([
      fetch("/api/share-groups").then((r) => r.json()),
      fetch("/api/share-groups/invites/mine").then((r) => r.json()),
    ]);
    setGroups((g.rows ?? []) as GroupRow[]);
    setInvites((i.rows ?? []) as Invite[]);
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
      toast.error(j.error ?? "Create failed");
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
              {g.role === "owner" && (
                <div className="mt-3">
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
                  ) : (
                    <button
                      onClick={() => setInviteOpen(g.group.id)}
                      className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="size-3" /> Invite member
                    </button>
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
