"use client";

import { useEffect, useState } from "react";
import { useProjectMembers, useAddMember, useRemoveMember } from "@/hooks/use-members";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { X, UserPlus, Crown, User2 } from "lucide-react";
import { toast } from "sonner";

export function MembersDialog({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const { data: members = [] } = useProjectMembers(projectId);
  const add = useAddMember();
  const remove = useRemoveMember();
  const [email, setEmail] = useState("");

  // Detect whether current user is the owner of this project (only owners can manage members).
  const { data: me } = useQuery({
    queryKey: ["me-uid"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
  const myRole = members.find((m) => m.user_id === me)?.role;
  const canManage = myRole === "owner";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await add.mutateAsync({ projectId, email });
      toast.success("Added");
      setEmail("");
    } catch {
      // toast handled in hook
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div className="card w-[90vw] max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Share &ldquo;{projectName}&rdquo;</h3>
            <p className="text-xs text-muted-fg">Invite by email. They&apos;ll see the list and its tasks in real time.</p>
          </div>
          <button className="btn-ghost size-8 p-0 grid place-items-center" onClick={onClose} aria-label="close">
            <X className="size-4" />
          </button>
        </div>

        {canManage && (
          <form onSubmit={invite} className="flex gap-2">
            <input
              type="email"
              placeholder="someone@example.com"
              className="input flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-primary gap-1" disabled={!email.trim() || add.isPending}>
              <UserPlus className="size-4" />
              {add.isPending ? "…" : "Invite"}
            </button>
          </form>
        )}

        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-fg px-1">Members</div>
          {members.length === 0 && <p className="text-sm text-muted-fg p-2">No members yet.</p>}
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60">
              <div className="size-7 rounded-full bg-muted grid place-items-center overflow-hidden shrink-0">
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User2 className="size-4 text-muted-fg" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{m.full_name || m.email || m.user_id.slice(0, 8)}</div>
                <div className="text-[11px] text-muted-fg truncate">{m.email}</div>
              </div>
              <span className="chip">
                {m.role === "owner" && <Crown className="size-3" />}
                {m.role}
              </span>
              {canManage && m.role !== "owner" && (
                <button
                  className="text-xs text-danger hover:underline"
                  onClick={() => remove.mutate({ projectId, userId: m.user_id })}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {!canManage && (
          <p className="text-xs text-muted-fg">Only the list owner can invite or remove members.</p>
        )}
      </div>
    </div>
  );
}
