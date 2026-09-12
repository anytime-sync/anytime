"use client";

import { useEffect, useState } from "react";
import PromotionSchedule from "./promotion-schedule";

type Setup = { account: string; configured: boolean; missing: string[]; brands: { name: string; url: string }[] };
type Result = { state: string; message?: string; checkedAt?: string; account?: { username: string } };

export default function XConnectionPage() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/x-connection", { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { if (active) setSetup(data); })
      .catch(() => { if (active) setError("Connection settings could not be loaded."); });
    return () => { active = false; };
  }, []);
  async function verify() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/x-connection", { method: "POST" });
      if (!response.ok) throw new Error();
      setResult(await response.json());
    } catch { setError("The connection check could not finish. No success is assumed."); }
    finally { setBusy(false); }
  }
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl">X promotion connection</h1>
        <p className="text-muted-fg mt-2">One shared account for OQUA, First Sight and First Light.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-400/30 p-4">{error}</p>}
      {!setup && !error && <p role="status">Loading connection settings…</p>}
      {setup && <>
        <section className="rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-xl">@{setup.account}</h2>
          <p>{setup.configured ? "Saved credentials are available. Verify the live connection below." : "The saved connection is incomplete."}</p>
          {!setup.configured && <p className="text-sm text-muted-fg">Missing: {setup.missing.join(", ")}</p>}
          <button onClick={verify} disabled={busy || !setup.configured} className="btn-primary disabled:opacity-50">
            {busy ? "Checking X…" : "Verify X connection"}
          </button>
          <p className="text-sm text-muted-fg">Checks the account identity without publishing. X API usage may consume credits.</p>
          {result && <div role="status" className="rounded-lg border border-border p-4 space-y-2">
            <p className="font-medium">{result.state === "connected" ? "Account authenticated" : result.state.replaceAll("_", " ")}</p>
            <p>{result.message}</p>
            {result.checkedAt && <p className="text-sm text-muted-fg">Checked {new Date(result.checkedAt).toLocaleString()}</p>}
          </div>}
          <a href="https://console.x.com/" target="_blank" rel="noopener noreferrer" className="underline">X Developer Console · credits and app permissions</a>
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {setup.brands.map((brand) => <a key={brand.name} href={brand.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border p-4">
            <h2 className="font-medium">{brand.name}</h2><p className="text-sm text-muted-fg break-all mt-2">{brand.url}</p>
          </a>)}
        </section>
        <PromotionSchedule />
      </>}
    </div>
  );
}
