import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

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
};

export default async function MembersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_members_list");
  const members = (data ?? []) as Member[];

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6">
        <p className="editorial-number text-xs mb-1">Admin</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          Members
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          {members.length} {members.length === 1 ? "member" : "members"} ·
          newest first
        </p>
      </header>

      {error && (
        <p className="text-sm text-danger mb-4">{error.message}</p>
      )}

      <div className="surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left editorial-number text-[10px]">
              <th className="px-3 py-2 font-normal">Email</th>
              <th className="px-3 py-2 font-normal">Lang</th>
              <th className="px-3 py-2 font-normal">Joined</th>
              <th className="px-3 py-2 font-normal">Last active</th>
              <th className="px-3 py-2 font-normal text-right">Tasks</th>
              <th className="px-3 py-2 font-normal text-right">Done</th>
              <th className="px-3 py-2 font-normal text-right">Pomodoros</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-fg">
                  No members yet.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{m.email}</div>
                  {m.full_name && (
                    <div className="text-xs text-muted-fg">{m.full_name}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs uppercase tracking-wider text-muted-fg">
                  {m.language}
                </td>
                <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">
                  {format(new Date(m.created_at), "MMM d, yyyy")}
                </td>
                <td className="px-3 py-2 text-xs text-muted-fg tabular-nums">
                  {m.last_active
                    ? format(new Date(m.last_active), "MMM d, h:mm a")
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.task_count}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-fg">
                  {m.completed_count}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-fg">
                  {m.pomodoro_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
