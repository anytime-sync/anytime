"use client";
import { useEffect, useState } from "react";
type Schedule = { control: { enabled: boolean; pause_reason: string | null }; queue: { id: string; brand: string; body: string; scheduled_at: string; status: string; result_url: string | null; error: string | null }[] };
export default function PromotionSchedule() {
  const [data, setData] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const res = await fetch("/api/admin/x-promotion", { cache: "no-store" });
    if (!res.ok) throw new Error();
    setData(await res.json());
  }
  useEffect(() => { refresh().catch(() => setMessage("Schedule could not load.")); }, []);
  async function act(action: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/x-promotion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await res.json();
      setMessage(res.ok ? (result.state ?? "Updated").replaceAll("_", " ") : "The action failed.");
      await refresh();
    } catch { setMessage("Result unknown. Refresh and inspect the post receipts before retrying."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-border p-5 space-y-4">
    <h2 className="text-xl">Daily promotion</h2>
    <p className="text-sm text-muted-fg">Three posts per brand, every day · Asia/Taipei</p>
    <p className="text-sm">OQUA 08:00 · 13:00 · 18:00<br />First Sight 10:00 · 15:00 · 20:00<br />First Light 12:00 · 17:00 · 22:00</p>
    {data && <><p>{data.control.enabled ? "Schedule active" : "Schedule paused"}{data.control.pause_reason ? ` · ${data.control.pause_reason.replaceAll("_", " ")}` : ""}</p>
      <div className="flex flex-wrap gap-3"><button disabled={busy} className="btn-primary disabled:opacity-50" onClick={() => act(data.control.enabled ? "pause" : "resume")}>{data.control.enabled ? "Pause publishing" : "Enable publishing"}</button>
      <button disabled={busy || !data.control.enabled} className="rounded-lg border border-border px-4 py-2 disabled:opacity-50" onClick={() => act("dispatch")}>Publish next due post now</button></div>
    </>}
    {message && <p role="status">{message}</p>}
    <p className="text-sm text-muted-fg">Only prepared, due posts are sent. Missed windows are skipped. Uncertain results pause publishing for review. No automatic credit purchases.</p>
    <div className="max-h-[32rem] overflow-y-auto space-y-3">{data?.queue.map(row => <article key={row.id} className="rounded-lg border border-border p-4 space-y-2">
      <p className="text-sm text-muted-fg">{row.brand} · {new Date(row.scheduled_at).toLocaleString("en-GB", { timeZone: "Asia/Taipei" })} Taipei · {row.status}</p>
      <p className="whitespace-pre-wrap break-words">{row.body}</p>
      {row.result_url && <a className="underline" href={row.result_url} target="_blank" rel="noopener noreferrer">View published post</a>}
      {row.error && <p className="text-sm">{row.error.replaceAll("_", " ")}</p>}
    </article>)}</div>
  </section>;
}
