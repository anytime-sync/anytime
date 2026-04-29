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
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {error && (
        <p className="text-sm text-danger mb-6">{error.message}</p>
      )}

      <div className="surface border border-border rounded-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-accent/60" />
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr className="text-left">
              <Th>Email</Th>
              <Th>Lang</Th>
              <Th>Joined</Th>
              <Th>Last active</Th>
              <Th align="right">Tasks</Th>
              <Th align="right">Done</Th>
              <Th align="right">Pomodoros</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-muted-fg italic font-display"
                >
                  No members yet — the readership awaits.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-display text-base leading-tight">
                    {m.full_name ?? m.email.split("@")[0]}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
