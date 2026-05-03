"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserPrefs, useUpdatePrefs, type UserPrefs } from "@/hooks/use-ai";
import { LanguagePicker } from "@/components/app/language-picker";
import { Calendar, Check, ChevronDown, ChevronRight, Copy, Download, LogOut, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { pushSupported, getCurrentSubscription, subscribePush, unsubscribePush } from "@/lib/push";

export default function SettingsPage() {
  const { data: prefs } = useUserPrefs();
  const update = useUpdatePrefs();
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string | null } | null>(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pushReady, setPushReady] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushDenied, setPushDenied] = useState(false);

  useEffect(() => {
    (async () => {
      if (!(await pushSupported())) { setPushReady(false); return; }
      setPushReady(true);
      const cur = await getCurrentSubscription();
      setPushSubscribed(!!cur);
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        setPushDenied(true);
      }
    })();
  }, []);

  async function togglePush(next: boolean) {
    if (next) {
      const r = await subscribePush();
      if (!r.ok) {
        if (r.reason === "denied") {
          setPushDenied(true);
          toast.error("Browser blocked notifications. See the hint below.");
        } else if (r.reason === "unsupported") {
          toast.error("Push isn't supported on this device");
        } else {
          toast.error("Couldn't subscribe to push");
        }
        return;
      }
      setPushDenied(false);
      setPushSubscribed(true);
      setPref("push_reminders", true);
      toast.success("Push notifications on");
    } else {
      await unsubscribePush();
      setPushSubscribed(false);
      setPref("push_reminders", false);
      toast.success("Push notifications off");
    }
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const fullName = (u.user.user_metadata?.full_name as string | undefined) ?? null;
      setUser({ email: u.user.email ?? "", name: fullName });
      if (fullName) setName(fullName);
    })();
  }, []);

  function setPref<K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) {
    update.mutate(
      { [key]: value } as Partial<UserPrefs>,
      { onError: (e: any) => toast.error(e?.message ?? "Couldn't save") }
    );
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user?.name) return;
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    if (error) toast.error(error.message);
    else toast.success("Name updated");
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  const [importFormat, setImportFormat] = useState<"ticktick" | "todoist" | "ics" | "generic">("ticktick");
  const [importing, setImporting] = useState(false);
  const fileRef = useState<HTMLInputElement | null>(null);

  async function importFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const r = await fetch("/api/account/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: importFormat, content: text }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.detail ?? j.error ?? "Import failed");
      } else {
        toast.success(`Imported ${j.imported} task${j.imported === 1 ? "" : "s"}`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function exportData() {
    try {
      const r = await fetch("/api/account/export");
      if (!r.ok) throw new Error(`export_failed_${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `firstlight-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't export");
    }
  }

  async function deleteAccount() {
    if (!user) return;
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error("Type your email to confirm");
      return;
    }
    const r = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm_email: confirmEmail.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.detail ?? j.error ?? "Couldn't delete");
      return;
    }
    toast.success("Account deleted");
    router.replace("/");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">Settings</h1>
        <p className="text-sm text-muted-fg mt-1">Account, preferences, and data.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-2xl space-y-10">

          {/* ---------- Account ---------- */}
          <Section kicker="Account">
            <Row label="Name">
              <input
                className="input flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="Your name"
              />
            </Row>
            <Row label="Email">
              <span className="text-sm text-muted-fg">{user?.email ?? "—"}</span>
            </Row>
            <Row label="Session">
              <button onClick={signOut} className="btn-ghost h-9 px-3 text-sm gap-2">
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </Row>
          </Section>

          {/* ---------- Language ---------- */}
          <Section kicker="Language">
            <Row label="Display language">
              <LanguagePicker />
            </Row>
            <p className="text-xs text-muted-fg pt-1">
              UI labels, AI-generated briefings, and date formats follow this language.
            </p>
          </Section>

          {/* ---------- Capacity & energy ---------- */}
          <Section kicker="Day capacity">
            <Row label="Daily capacity">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="number"
                  min={30}
                  max={720}
                  step={15}
                  value={prefs?.daily_capacity_minutes ?? 240}
                  onChange={(e) => setPref("daily_capacity_minutes", parseInt(e.target.value, 10) || 240)}
                  className="input w-28"
                />
                <span className="text-sm text-muted-fg">minutes / day</span>
              </div>
            </Row>
            <Row label="Energy peak">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={(prefs?.energy_peak_start ?? "09:00").slice(0, 5)}
                  onChange={(e) => setPref("energy_peak_start", e.target.value as any)}
                  className="input w-28"
                />
                <span className="text-sm text-muted-fg">to</span>
                <input
                  type="time"
                  value={(prefs?.energy_peak_end ?? "12:00").slice(0, 5)}
                  onChange={(e) => setPref("energy_peak_end", e.target.value as any)}
                  className="input w-28"
                />
              </div>
            </Row>
          </Section>

          {/* ---------- AI ---------- */}
          <Section kicker="AI features">
            <Toggle
              label="AI enabled"
              hint="Master switch — turn off to disable everything below."
              checked={prefs?.ai_enabled ?? true}
              onChange={(v) => setPref("ai_enabled", v)}
            />
            <Toggle
              label="Daily Edition briefing"
              hint="Editorial morning brief on the Today page."
              checked={prefs?.ai_daily_edition ?? true}
              onChange={(v) => setPref("ai_daily_edition", v)}
              disabled={!(prefs?.ai_enabled ?? true)}
            />
            <Toggle
              label="Smart Eisenhower auto-suggest"
              hint="AI · suggest button on the matrix proposes moves."
              checked={prefs?.ai_auto_quadrant ?? false}
              onChange={(v) => setPref("ai_auto_quadrant", v)}
              disabled={!(prefs?.ai_enabled ?? true)}
            />
            <Toggle
              label="Voice capture"
              hint="Microphone button on every Add Task input."
              checked={prefs?.ai_voice_enabled ?? true}
              onChange={(v) => setPref("ai_voice_enabled", v)}
              disabled={!(prefs?.ai_enabled ?? true)}
            />
          </Section>

          {/* ---------- Notifications ---------- */}
          <Section kicker="Notifications">
            <Toggle
              label="Email reminders"
              hint="When a task's reminder time is reached, send an email to your inbox."
              checked={prefs?.email_reminders ?? true}
              onChange={(v) => setPref("email_reminders", v)}
            />
            <Toggle
              label="Push notifications"
              hint={pushReady
                ? "Browser-native notifications even when the tab is closed. (PWA recommended on iOS.)"
                : "Not supported on this device or browser."}
              checked={pushSubscribed && (prefs?.push_reminders ?? true)}
              onChange={(v) => togglePush(v)}
              disabled={!pushReady}
            />
            {pushDenied && (
              <div className="text-xs text-muted-fg leading-relaxed border-l-2 border-warning pl-3 py-1">
                <p className="text-fg mb-1">Notifications are blocked for this site.</p>
                <p>
                  Click the{" "}
                  <span className="inline-block px-1.5 py-0.5 border border-border rounded text-[10px]">🔒</span>
                  {" "}icon left of the URL → <strong>Site settings</strong> → set
                  <strong> Notifications</strong> to <strong>Allow</strong>, then reload the page and toggle this on again.
                </p>
              </div>
            )}
          </Section>

          {/* ---------- Calendar sync ---------- */}
          <CalendarFeedSection />

          {/* ---------- Import ---------- */}
          <Section kicker="Import">
            <Row label="From">
              <select
                className="input flex-1"
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as any)}
              >
                <option value="ticktick">TickTick CSV</option>
                <option value="todoist">Todoist CSV</option>
                <option value="ics">Apple Reminders / Calendar (.ics)</option>
                <option value="generic">Generic CSV (title, due, list, completed)</option>
              </select>
            </Row>
            <Row label="File">
              <input
                type="file"
                accept=".csv,.ics,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFile(f);
                  e.target.value = "";
                }}
                disabled={importing}
                className="text-sm flex-1"
              />
            </Row>
            <p className="text-xs text-muted-fg">
              {importing ? "Importing…" : "Up to 1,000 rows per upload. Existing tasks aren't touched; imports are added on top."}
            </p>
          </Section>

          {/* ---------- Data ---------- */}
          <Section kicker="Your data">
            <Row label="Export">
              <button onClick={exportData} className="btn-ghost h-9 px-3 text-sm gap-2">
                <Download className="size-3.5" />
                Download as JSON
              </button>
            </Row>
            <p className="text-xs text-muted-fg">
              A complete copy of your tasks, lists, tags, habits, Pomodoro sessions, attachments,
              and AI editions/retros. Used for portability and GDPR access requests.
            </p>
          </Section>

          {/* ---------- Danger ---------- */}
          <Section kicker="Danger zone" tone="danger">
            <Row label="Delete account">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn h-9 px-3 text-sm gap-2 bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30"
                >
                  <Trash2 className="size-3.5" />
                  Delete my account
                </button>
              ) : (
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-danger leading-relaxed">
                    This permanently removes your account, every task, every list,
                    every attachment, every AI edition. It can&apos;t be undone.
                    Type your email to confirm.
                  </p>
                  <input
                    className="input"
                    placeholder={user?.email}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setConfirmDelete(false); setConfirmEmail(""); }}
                      className="btn-ghost h-9 px-3 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteAccount}
                      className="btn h-9 px-3 text-sm bg-danger text-white hover:opacity-90"
                    >
                      Delete forever
                    </button>
                  </div>
                </div>
              )}
            </Row>
          </Section>

          {/* ---------- Legal ---------- */}
          <Section kicker="Legal">
            <Row label="Documents">
              <div className="flex gap-3 text-sm">
                <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>
                <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link>
              </div>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Calendar sync — read-only iCalendar (.ics) subscription
//
// We expose a single per-user URL that any standards-compliant calendar
// app (Apple Calendar, Google Calendar, Outlook, Fantastical, …) can
// subscribe to. The URL embeds an opaque 32-byte token; rotating or
// clearing the token invalidates every existing subscription on the
// next refresh, so it doubles as the kill switch.
// ---------------------------------------------------------------------
function CalendarFeedSection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"enable" | "rotate" | "disable" | null>(null);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account/calendar-feed");
        if (!r.ok) throw new Error("load_failed");
        const j = (await r.json()) as { enabled: boolean; url: string | null };
        setFeedUrl(j.url);
      } catch {
        // Non-fatal — section will show the "Enable" CTA.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function enable() {
    setBusy("enable");
    try {
      const r = await fetch("/api/account/calendar-feed", { method: "POST" });
      if (!r.ok) throw new Error("enable_failed");
      const j = (await r.json()) as { url: string };
      setFeedUrl(j.url);
      toast.success("Calendar subscription enabled");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't enable subscription");
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    if (!confirm("Rotate the URL? Every device that's currently subscribed will stop syncing on its next refresh, and you'll need to re-add the new URL.")) {
      return;
    }
    setBusy("rotate");
    try {
      const r = await fetch("/api/account/calendar-feed", { method: "POST" });
      if (!r.ok) throw new Error("rotate_failed");
      const j = (await r.json()) as { url: string };
      setFeedUrl(j.url);
      toast.success("New URL minted");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't rotate URL");
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    if (!confirm("Disable the subscription? Every subscribed calendar will stop syncing.")) {
      return;
    }
    setBusy("disable");
    try {
      const r = await fetch("/api/account/calendar-feed", { method: "DELETE" });
      if (!r.ok) throw new Error("disable_failed");
      setFeedUrl(null);
      toast.success("Subscription disabled");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't disable subscription");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — please copy manually");
    }
  }

  return (
    <Section kicker="Calendar sync">
      <Row label="Subscribe">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-sm text-muted-fg">Loading…</div>
          ) : feedUrl ? (
            <div className="space-y-2">
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={feedUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input flex-1 font-mono text-[12px]"
                />
                <button
                  onClick={copy}
                  className="btn-ghost h-9 px-3 text-sm gap-2 shrink-0"
                  aria-label="Copy URL"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={rotate}
                  disabled={busy !== null}
                  className="btn-ghost h-8 px-3 text-xs gap-1.5"
                >
                  <RefreshCw className={`size-3 ${busy === "rotate" ? "animate-spin" : ""}`} />
                  Rotate URL
                </button>
                <button
                  onClick={disable}
                  disabled={busy !== null}
                  className="btn-ghost h-8 px-3 text-xs gap-1.5 text-danger"
                >
                  <Trash2 className="size-3" />
                  Disable
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={enable}
              disabled={busy !== null}
              className="btn-primary gap-2"
            >
              <Calendar className="size-4" />
              {busy === "enable" ? "Generating…" : "Enable calendar subscription"}
            </button>
          )}
        </div>
      </Row>

      <p className="text-xs text-muted-fg leading-relaxed">
        Read-only feed. Apple Calendar, Google Calendar, Outlook, and any other
        ICS-compatible app can subscribe — your tasks and meetings will appear
        alongside your other calendars and refresh automatically (typically
        every 15 minutes to a few hours, depending on the app). Edits made in
        those calendars don&apos;t flow back to First Light. Two-way Google
        Calendar sync is on the roadmap.
      </p>

      {feedUrl && (
        <div>
          <button
            onClick={() => setShowHow((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-fg hover:text-accent"
          >
            {showHow ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            How to subscribe
          </button>
          {showHow && (
            <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-fg border-l-2 border-border pl-4">
              <HowTo
                platform="iPhone / iPad"
                steps={[
                  "Settings → Calendar → Accounts → Add Account",
                  'Tap "Other" → "Add Subscribed Calendar"',
                  "Paste the URL above into Server, then Next → Save",
                ]}
              />
              <HowTo
                platform="macOS Calendar"
                steps={[
                  "Open Calendar → File → New Calendar Subscription",
                  "Paste the URL above → Subscribe",
                  'Choose how often to refresh (e.g. "Every 15 minutes")',
                ]}
              />
              <HowTo
                platform="Google Calendar (web)"
                steps={[
                  "Open calendar.google.com",
                  'In the left sidebar, click "+" next to "Other calendars" → "From URL"',
                  "Paste the URL above → Add calendar",
                ]}
              />
              <HowTo
                platform="Outlook (web)"
                steps={[
                  "Open Outlook calendar → Add calendar → Subscribe from web",
                  "Paste the URL above, give the calendar a name, pick a color → Import",
                ]}
              />
              <p className="pt-1 text-[11px]">
                On Android, subscribe in Google Calendar (web) — your phone&apos;s
                calendar will pick it up automatically through your Google account.
              </p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function HowTo({ platform, steps }: { platform: string; steps: string[] }) {
  return (
    <div>
      <p className="text-fg mb-1">{platform}</p>
      <ol className="list-decimal pl-5 space-y-0.5">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

function Section({
  kicker, children, tone,
}: {
  kicker: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className="space-y-3">
      <h2 className={`editorial-number text-[11px] ${tone === "danger" ? "text-danger" : ""}`}>{kicker}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-start sm:items-center gap-2 sm:gap-4">
      <div className="text-sm text-muted-fg">{label}</div>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  );
}

function Toggle({
  label, hint, checked, onChange, disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`grid grid-cols-[1fr_auto] items-start gap-4 ${disabled ? "opacity-50" : ""}`}>
      <div>
        <div className="text-sm text-fg">{label}</div>
        {hint && <p className="text-xs text-muted-fg mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-[20px] w-[34px] rounded-full transition-all duration-200 shrink-0 border focus:outline-none focus:ring-2 focus:ring-accent/30 ${
          checked
            ? "bg-accent/90 border-accent"
            : "bg-transparent border-border hover:border-fg/40"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-[2px] size-[14px] rounded-full transition-all duration-200 ${
            checked
              ? "left-[16px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
              : "left-[2px] bg-muted-fg/60"
          }`}
        />
      </button>
    </div>
  );
}
