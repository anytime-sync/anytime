"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserPrefs, useUpdatePrefs, type UserPrefs } from "@/hooks/use-ai";
import { LanguagePicker } from "@/components/app/language-picker";
import { Download, Trash2, LogOut, Bell } from "lucide-react";
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

  useEffect(() => {
    (async () => {
      if (!(await pushSupported())) { setPushReady(false); return; }
      setPushReady(true);
      const cur = await getCurrentSubscription();
      setPushSubscribed(!!cur);
    })();
  }, []);

  async function togglePush(next: boolean) {
    if (next) {
      const r = await subscribePush();
      if (!r.ok) {
        toast.error(
          r.reason === "denied" ? "Notification permission denied" :
          r.reason === "unsupported" ? "Push isn't supported on this device" :
          "Couldn't subscribe to push"
        );
        return;
      }
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
        {hint && <p className="text-xs text-muted-fg mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 rounded-full transition-colors shrink-0 ${
          checked ? "bg-accent" : "bg-muted border border-border"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
