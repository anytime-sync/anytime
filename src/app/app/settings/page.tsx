"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserPrefs, useUpdatePrefs, type UserPrefs } from "@/hooks/use-ai";
import { LanguagePicker } from "@/components/app/language-picker";
import { BillingSection } from "@/components/app/billing-section";
import { Calendar, Check, ChevronDown, ChevronRight, Copy, Download, LogOut, Mail, RefreshCw, Trash2, Upload, User, CreditCard, Bell, Sparkles, Database, Plug } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { pushSupported, getCurrentSubscription, subscribePush, unsubscribePush } from "@/lib/push";
import { useLanguage } from "@/lib/use-language";
import { t as tr, getLanguage } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { useInboxAlias, useRotateInboxAlias } from "@/hooks/use-inbox-alias";
import {
  useCalendarConnection,
  useDisconnectCalendar,
  useSyncCalendarNow,
} from "@/hooks/use-calendar";

export default function SettingsPage() {
  const lang = useLanguage();
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
          toast.error(tr(lang, "view.settings.toast.pushBlocked"));
        } else if (r.reason === "unsupported") {
          toast.error(tr(lang, "view.settings.toast.pushUnsupported"));
        } else {
          toast.error(tr(lang, "view.settings.toast.pushFailed"));
        }
        return;
      }
      setPushDenied(false);
      setPushSubscribed(true);
      setPref("push_reminders", true);
      toast.success(tr(lang, "view.settings.toast.pushOn"));
    } else {
      await unsubscribePush();
      setPushSubscribed(false);
      setPref("push_reminders", false);
      toast.success(tr(lang, "view.settings.toast.pushOff"));
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
      { onError: (e: any) => toast.error(e?.message ?? tr(lang, "view.settings.toast.couldntSave")) }
    );
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user?.name) return;
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } });
    if (error) toast.error(error.message);
    else toast.success(tr(lang, "view.settings.toast.nameUpdated"));
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
        toast.error(j.detail ?? j.error ?? tr(lang, "view.settings.toast.importFailed"));
      } else {
        toast.success((j.imported === 1 ? tr(lang, "view.settings.toast.importedOne") : tr(lang, "view.settings.toast.importedMany")).replace("{n}", String(j.imported)));
      }
    } catch (e: any) {
      toast.error(e?.message ?? tr(lang, "view.settings.toast.importFailed"));
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
      toast.success(tr(lang, "view.settings.toast.exportDownloaded"));
    } catch (e: any) {
      toast.error(e?.message ?? tr(lang, "view.settings.toast.couldntExport"));
    }
  }

  async function deleteAccount() {
    if (!user) return;
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      toast.error(tr(lang, "view.settings.toast.typeEmail"));
      return;
    }
    const r = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm_email: confirmEmail.trim() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.detail ?? j.error ?? tr(lang, "view.settings.toast.couldntDelete"));
      return;
    }
    toast.success(tr(lang, "view.settings.toast.accountDeleted"));
    router.replace("/");
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">{tr(lang, "view.settings.heading")}</h1>
        <p className="text-sm text-muted-fg mt-1">{tr(lang, "view.settings.subheader")}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-2xl space-y-10">
            {/* -------- Jump menu -------- */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
              <a href="#settings-account" className="surface border border-border rounded-lg p-3 hover:border-accent/60 transition-colors flex items-center gap-3 group">
                <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <User className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">Account</p>
                  <p className="text-[11px] text-muted-fg leading-tight">Profile, language, capacity</p>
                </div>
              </a>
              <a href="#settings-billing" className="surface border border-border rounded-lg p-3 hover:border-accent/60 transition-colors flex items-center gap-3 group">
                <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <CreditCard className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">Billing</p>
                  <p className="text-[11px] text-muted-fg leading-tight">Plan, invoices</p>
                </div>
              </a>
              <a href="#settings-notifications" className="surface border border-border rounded-lg p-3 hover:border-accent/60 transition-colors flex items-center gap-3 group">
                <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">Notifications</p>
                  <p className="text-[11px] text-muted-fg leading-tight">Email, push, digest</p>
                </div>
              </a>
              <a href="#settings-aiFeatures" className="surface border border-border rounded-lg p-3 hover:border-accent/60 transition-colors flex items-center gap-3 group">
                <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">AI</p>
                  <p className="text-[11px] text-muted-fg leading-tight">Behaviour, limits</p>
                </div>
              </a>
              <a href="#settings-yourData" className="surface border border-border rounded-lg p-3 hover:border-accent/60 transition-colors flex items-center gap-3 group">
                <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <Database className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">Your data</p>
                  <p className="text-[11px] text-muted-fg leading-tight">Export, import</p>
                </div>
              </a>
              <a href="#settings-calendarSync" className="surface border border-border rounded-lg p-3 hover:border-accent/60 transition-colors flex items-center gap-3 group">
                <span className="size-9 rounded-md bg-accent/15 text-accent grid place-items-center shrink-0 group-hover:bg-accent/25 transition-colors">
                  <Plug className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">Integrations</p>
                  <p className="text-[11px] text-muted-fg leading-tight">Calendar, email</p>
                </div>
              </a>
            </div>

          {/* ---------- Billing ---------- */}
          <div id="settings-billing" className="scroll-mt-6">
            <BillingSection />
          </div>

          {/* ---------- Account ---------- */}
          <Section id="settings-account" kicker={tr(lang, "view.settings.section.account")}>
            <Row label={tr(lang, "view.settings.row.name")}>
              <input
                className="input flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder={tr(lang, "view.settings.placeholder.yourName")}
              />
            </Row>
            <Row label={tr(lang, "view.settings.row.email")}>
              <span className="text-sm text-muted-fg">{user?.email ?? "—"}</span>
            </Row>
            <Row label={tr(lang, "view.settings.row.session")}>
              <button onClick={signOut} className="btn-ghost h-9 px-3 text-sm gap-2">
                <LogOut className="size-3.5" />
                {tr(lang, "view.settings.row.signOut")}
              </button>
            </Row>
          </Section>

          {/* ---------- Language ---------- */}
          <Section id="settings-language" kicker={tr(lang, "view.settings.section.language")}>
            <Row label={tr(lang, "view.settings.row.displayLanguage")}>
              <LanguagePicker />
            </Row>
            <p className="text-xs text-muted-fg pt-1">
              {tr(lang, "view.settings.langHelp")}
            </p>
          </Section>

          {/* ---------- Capacity & energy ---------- */}
          <Section id="settings-dayCapacity" kicker={tr(lang, "view.settings.section.dayCapacity")}>
            <Row label={tr(lang, "view.settings.row.dailyCapacity")}>
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
                <span className="text-sm text-muted-fg">{tr(lang, "view.settings.row.minutesPerDay")}</span>
              </div>
            </Row>
            <Row label={tr(lang, "view.settings.row.energyPeak")}>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={(prefs?.energy_peak_start ?? "09:00").slice(0, 5)}
                  onChange={(e) => setPref("energy_peak_start", e.target.value as any)}
                  className="input w-28"
                />
                <span className="text-sm text-muted-fg">{tr(lang, "view.settings.row.to")}</span>
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
          <Section id="settings-aiFeatures" kicker={tr(lang, "view.settings.section.aiFeatures")}>
            <Toggle
              label={tr(lang, "view.settings.toggle.aiEnabled")}
              hint={tr(lang, "view.settings.toggle.aiEnabledHint")}
              checked={prefs?.ai_enabled ?? true}
              onChange={(v) => setPref("ai_enabled", v)}
            />
            <Toggle
              label={tr(lang, "view.settings.toggle.dailyEdition")}
              hint={tr(lang, "view.settings.toggle.dailyEditionHint")}
              checked={prefs?.ai_daily_edition ?? true}
              onChange={(v) => setPref("ai_daily_edition", v)}
              disabled={!(prefs?.ai_enabled ?? true)}
            />
            <Toggle
              label={tr(lang, "view.settings.toggle.smartEisenhower")}
              hint={tr(lang, "view.settings.toggle.smartEisenhowerHint")}
              checked={prefs?.ai_auto_quadrant ?? false}
              onChange={(v) => setPref("ai_auto_quadrant", v)}
              disabled={!(prefs?.ai_enabled ?? true)}
            />
            <Toggle
              label={tr(lang, "view.settings.toggle.voiceCapture")}
              hint={tr(lang, "view.settings.toggle.voiceCaptureHint")}
              checked={prefs?.ai_voice_enabled ?? true}
              onChange={(v) => setPref("ai_voice_enabled", v)}
              disabled={!(prefs?.ai_enabled ?? true)}
            />
          </Section>

          {/* ---------- Notifications ---------- */}
          <Section id="settings-notifications" kicker={tr(lang, "view.settings.section.notifications")}>
            <Toggle
              label={tr(lang, "view.settings.toggle.emailReminders")}
              hint={tr(lang, "view.settings.toggle.emailRemindersHint")}
              checked={prefs?.email_reminders ?? true}
              onChange={(v) => setPref("email_reminders", v)}
            />
            <Toggle
              label={tr(lang, "view.settings.toggle.dailyDigest")}
              hint={tr(lang, "view.settings.toggle.dailyDigestHint")}
              checked={prefs?.email_daily_digest ?? true}
              onChange={(v) => setPref("email_daily_digest", v)}
            />
            <Toggle
              label={tr(lang, "view.settings.toggle.pushNotifications")}
              hint={pushReady
                ? tr(lang, "view.settings.toggle.pushHint")
                : tr(lang, "view.settings.toggle.pushUnsupported")}
              checked={pushSubscribed && (prefs?.push_reminders ?? true)}
              onChange={(v) => togglePush(v)}
              disabled={!pushReady}
            />
            {pushDenied && (
              <div className="text-xs text-muted-fg leading-relaxed border-l-2 border-warning pl-3 py-1">
                <p className="text-fg mb-1">{tr(lang, "view.settings.cal.notifBlocked.title")}</p>
                <p>{tr(lang, "view.settings.cal.notifBlocked.body")}</p>
              </div>
            )}
          </Section>

          {/* ---------- Email to task ---------- */}
          <InboxAliasSection lang={lang} />

          {/* ---------- Calendar sync ---------- */}
          <CalendarFeedSection lang={lang} />

          {/* ---------- Google Calendar (Round F) ---------- */}
          <GoogleCalendarSection lang={lang} />

          {/* ---------- Import ---------- */}
          <Section id="settings-import" kicker={tr(lang, "view.settings.section.import")}>
            <Row label={tr(lang, "view.settings.row.from")}>
              <select
                className="input flex-1"
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as any)}
              >
                <option value="ticktick">{tr(lang, "view.settings.import.format.ticktick")}</option>
                <option value="todoist">{tr(lang, "view.settings.import.format.todoist")}</option>
                <option value="ics">{tr(lang, "view.settings.import.format.ics")}</option>
                <option value="generic">{tr(lang, "view.settings.import.format.generic")}</option>
              </select>
            </Row>
            <Row label={tr(lang, "view.settings.row.file")}>
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
              {importing ? tr(lang, "view.settings.import.importing") : tr(lang, "view.settings.import.help")}
            </p>
          </Section>

          {/* ---------- Data ---------- */}
          <Section id="settings-yourData" kicker={tr(lang, "view.settings.section.yourData")}>
            <Row label={tr(lang, "view.settings.row.export")}>
              <button onClick={exportData} className="btn-ghost h-9 px-3 text-sm gap-2">
                <Download className="size-3.5" />
                {tr(lang, "view.settings.exportButton")}
              </button>
            </Row>
            <p className="text-xs text-muted-fg">
              {tr(lang, "view.settings.exportHelp")}
            </p>
          </Section>

          {/* ---------- Danger ---------- */}
          <Section id="settings-danger" kicker={tr(lang, "view.settings.section.danger")} tone="danger">
            <Row label={tr(lang, "view.settings.row.deleteAccount")}>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="btn h-9 px-3 text-sm gap-2 bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30"
                >
                  <Trash2 className="size-3.5" />
                  {tr(lang, "view.settings.delete.button")}
                </button>
              ) : (
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-danger leading-relaxed">
                    {tr(lang, "view.settings.delete.warning")}
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
                      {tr(lang, "view.settings.delete.confirmCancel")}
                    </button>
                    <button
                      onClick={deleteAccount}
                      className="btn h-9 px-3 text-sm bg-danger text-white hover:opacity-90"
                    >
                      {tr(lang, "view.settings.delete.confirmAction")}
                    </button>
                  </div>
                </div>
              )}
            </Row>
          </Section>

          {/* ---------- Legal ---------- */}
          <Section id="settings-legal" kicker={tr(lang, "view.settings.section.legal")}>
            <Row label={tr(lang, "view.settings.row.documents")}>
              <div className="flex gap-3 text-sm">
                <Link href="/privacy" className="text-accent hover:underline">{tr(lang, "view.settings.privacyPolicy")}</Link>
                <Link href="/terms" className="text-accent hover:underline">{tr(lang, "view.settings.termsOfService")}</Link>
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
function CalendarFeedSection({ lang }: { lang: string }) {
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
      toast.success(tr(lang, "view.settings.toast.calEnabled"));
    } catch (e: any) {
      toast.error(e?.message ?? tr(lang, "view.settings.toast.calEnableErr"));
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
      toast.success(tr(lang, "view.settings.toast.calRotated"));
    } catch (e: any) {
      toast.error(e?.message ?? tr(lang, "view.settings.toast.calRotateErr"));
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
      toast.success(tr(lang, "view.settings.toast.calDisabled"));
    } catch (e: any) {
      toast.error(e?.message ?? tr(lang, "view.settings.toast.calDisableErr"));
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
      toast.error(tr(lang, "view.settings.toast.calCopied"));
    }
  }

  return (
    <Section id="settings-calendarSync" kicker={tr(lang, "view.settings.section.calendarSync")}>
      <Row label={tr(lang, "view.settings.row.subscribe")}>
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-sm text-muted-fg">{tr(lang, "view.settings.cal.loading")}</div>
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
                  aria-label={tr(lang, "view.settings.cal.copyAria")}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? tr(lang, "view.settings.cal.copied") : tr(lang, "view.settings.cal.copy")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={rotate}
                  disabled={busy !== null}
                  className="btn-ghost h-8 px-3 text-xs gap-1.5"
                >
                  <RefreshCw className={`size-3 ${busy === "rotate" ? "animate-spin" : ""}`} />
                  {tr(lang, "view.settings.cal.rotate")}
                </button>
                <button
                  onClick={disable}
                  disabled={busy !== null}
                  className="btn-ghost h-8 px-3 text-xs gap-1.5 text-danger"
                >
                  <Trash2 className="size-3" />
                  {tr(lang, "view.settings.cal.disable")}
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
              {busy === "enable" ? tr(lang, "view.settings.cal.generating") : tr(lang, "view.settings.cal.enable")}
            </button>
          )}
        </div>
      </Row>

      <p className="text-xs text-muted-fg leading-relaxed">
        {tr(lang, "view.settings.cal.body")}
      </p>

      {feedUrl && (
        <div>
          <button
            onClick={() => setShowHow((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-fg hover:text-accent"
          >
            {showHow ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {tr(lang, "view.settings.cal.howSubscribe")}
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
                {tr(lang, "view.settings.cal.androidNote")}
              </p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}


// ---------------------------------------------------------------------
// Email to task — per-user inbound-email alias.
//
// Each user gets a private address `<alias_local>@firstlight.to` that
// turns forwarded emails into Inbox tasks. The local-part is opaque
// and rotatable; rotating invalidates the previous address. Inbound
// is wired via Cloudflare Email Routing → /api/inbox/inbound (see
// scripts/email-to-task-setup.md for the alternative providers).
// ---------------------------------------------------------------------
function InboxAliasSection({ lang }: { lang: string }) {
  const { data: alias, isLoading } = useInboxAlias();
  const rotate = useRotateInboxAlias();
  const [copied, setCopied] = useState(false);
  const dfLocale = getLanguage(lang).dateFnsLocale;

  const fullAddress = alias?.alias_local
    ? `${alias.alias_local}@firstlight.to`
    : "";

  async function copyAddress() {
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(tr(lang, "view.settings.inbox.toast.copyFailed"));
    }
  }

  async function generate() {
    try {
      await rotate.mutateAsync();
      toast.success(tr(lang, "view.settings.inbox.toast.generated"));
    } catch {
      /* mutation hook surfaces toast.error already */
    }
  }

  async function doRotate() {
    if (!confirm(tr(lang, "view.settings.inbox.rotateConfirm"))) return;
    try {
      await rotate.mutateAsync();
      toast.success(tr(lang, "view.settings.inbox.toast.rotated"));
    } catch {
      /* mutation hook surfaces toast.error already */
    }
  }

  return (
    <Section id="settings-inbox" kicker={tr(lang, "view.settings.section.inbox")}>
      <p className="text-xs text-muted-fg leading-relaxed">
        {tr(lang, "view.settings.inbox.description")}
      </p>
      <Row label={tr(lang, "view.settings.inbox.address")}>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="text-sm text-muted-fg">
              {tr(lang, "view.settings.cal.loading")}
            </div>
          ) : alias ? (
            <div className="space-y-2">
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={fullAddress}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input flex-1 font-mono text-[12px]"
                />
                <button
                  onClick={copyAddress}
                  className="btn-ghost h-9 px-3 text-sm gap-2 shrink-0"
                  aria-label={tr(lang, "view.settings.inbox.copyAria")}
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied
                    ? tr(lang, "view.settings.inbox.copied")
                    : tr(lang, "view.settings.inbox.copy")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={doRotate}
                  disabled={rotate.isPending}
                  className="btn-ghost h-8 px-3 text-xs gap-1.5"
                >
                  <RefreshCw
                    className={`size-3 ${rotate.isPending ? "animate-spin" : ""}`}
                  />
                  {tr(lang, "view.settings.inbox.rotate")}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={generate}
              disabled={rotate.isPending}
              className="btn-primary gap-2"
            >
              <Mail className="size-4" />
              {rotate.isPending
                ? tr(lang, "view.settings.inbox.generating")
                : tr(lang, "view.settings.inbox.generate")}
            </button>
          )}
        </div>
      </Row>
      {alias && (
        <p className="text-xs text-muted-fg leading-relaxed">
          {alias.last_received_at
            ? tr(lang, "view.settings.inbox.lastReceived").replace(
                "{time}",
                formatDistanceToNow(new Date(alias.last_received_at), {
                  addSuffix: true,
                  locale: dfLocale,
                })
              )
            : tr(lang, "view.settings.inbox.noEmails")}
        </p>
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


// ---------------------------------------------------------------------
// Google Calendar — read-only sync (Round F).
//
// On first connect we kick a sync-now so the user sees their events
// immediately rather than having to wait for the next 5-min cron tick.
// The CalendarConnection query is the source of truth for the
// connected/disconnected switch; the URL ?cal_connected=1 query param
// is just used to fire a toast on return from the OAuth flow.
// ---------------------------------------------------------------------
function GoogleCalendarSection({ lang }: { lang: string }) {
  const { data: conn, refetch } = useCalendarConnection();
  const sync = useSyncCalendarNow();
  const disconnect = useDisconnectCalendar();
  const [busyDisconnect, setBusyDisconnect] = useState(false);

  // On return from OAuth we get ?cal_connected=1 / ?cal_err=... — fire
  // a toast and clear the param so a refresh doesn't re-fire it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const ok = u.searchParams.get("cal_connected");
    const err = u.searchParams.get("cal_err");
    if (ok) {
      toast.success(tr(lang, "view.settings.gcal.toast.connected"));
      u.searchParams.delete("cal_connected");
      window.history.replaceState({}, "", u.toString());
      // Pull fresh status, then kick an immediate sync so chips render
      // on Today/Calendar without waiting for the cron.
      refetch().then(() => sync.mutate());
    } else if (err) {
      toast.error(`${tr(lang, "view.settings.gcal.connectErrPrefix")} ${err}`);
      u.searchParams.delete("cal_err");
      window.history.replaceState({}, "", u.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onConnect() {
    window.location.href = "/api/calendar/google/connect";
  }

  function onSyncNow() {
    sync.mutate(undefined, {
      onSuccess: () => {
        toast.success(tr(lang, "view.settings.gcal.toast.synced"));
      },
      onError: (e: Error) => {
        toast.error(`${tr(lang, "view.settings.gcal.toast.syncErr")}: ${e.message}`);
      },
    });
  }

  function onDisconnect() {
    if (!confirm(tr(lang, "view.settings.gcal.disconnectConfirm"))) return;
    setBusyDisconnect(true);
    disconnect.mutate(undefined, {
      onSuccess: () => {
        toast.success(tr(lang, "view.settings.gcal.toast.disconnected"));
        setBusyDisconnect(false);
      },
      onError: (e: Error) => {
        toast.error(`${tr(lang, "view.settings.gcal.toast.disconnectErr")}: ${e.message}`);
        setBusyDisconnect(false);
      },
    });
  }

  const lastSyncLabel = conn?.last_sync_at
    ? formatDistanceToNow(new Date(conn.last_sync_at), { addSuffix: true })
    : tr(lang, "view.settings.gcal.never");

  return (
    <Section id="settings-gcal" kicker={tr(lang, "view.settings.section.gcal")}>
      <p className="text-sm text-muted-fg leading-relaxed max-w-prose">
        {tr(lang, "view.settings.gcal.description")}
      </p>
      {!conn?.connected ? (
        <div>
          <button
            type="button"
            onClick={onConnect}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Calendar className="size-4" />
            {tr(lang, "view.settings.gcal.connect")}
          </button>
        </div>
      ) : (
        <>
          <Row label={tr(lang, "view.settings.gcal.connectedAs")}>
            <span className="text-sm text-fg truncate">
              {conn.account_email ?? ""}
            </span>
          </Row>
          <Row label={tr(lang, "view.settings.gcal.lastSync")}>
            <span className="text-sm text-muted-fg">{lastSyncLabel}</span>
          </Row>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onSyncNow}
              disabled={sync.isPending}
              className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`size-4 ${sync.isPending ? "animate-spin" : ""}`}
              />
              {sync.isPending
                ? tr(lang, "view.settings.gcal.syncing")
                : tr(lang, "view.settings.gcal.syncNow")}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busyDisconnect}
              className="btn-ghost inline-flex items-center gap-2 text-danger disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              {tr(lang, "view.settings.gcal.disconnect")}
            </button>
          </div>
        </>
      )}
    </Section>
  );
}

function Section({
  kicker, children, tone, id,
}: {
  kicker: string;
  children: React.ReactNode;
  tone?: "danger";
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
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
