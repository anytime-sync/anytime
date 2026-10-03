"use client";
import { createClient } from '@/lib/supabase/client';
type Props = Record<string, string | number | boolean>;
const EVENTS = new Set(['activation.opened','activation.skipped','activation.saved','activation.started','app.active','task.created','task.completed','brief.requested','brief.succeeded','brief.failed']);
/** First-party, authenticated usage only. Never transmit task or calendar content. */
export function track(event: string, props: Props = {}): void {
  if (!EVENTS.has(event) || typeof window === 'undefined') return;
  try {
    if (navigator.doNotTrack === '1' || localStorage.getItem('fl.analyticsEnabled') !== '1') return;
  } catch { return; }
  const properties: Props = {};
  for (const key of ['count','source'] as const) {
    if (key === 'count' && typeof props.count === 'number' && Number.isFinite(props.count)) properties.count = props.count;
    if (key === 'source' && ['onboarding','task_ui','today'].includes(String(props.source))) properties.source = props.source;
  }
  void (async () => {
    try {
      const sb = createClient();
      const { data } = await sb.auth.getUser();
      if (!data.user) return;
      if (event === 'app.active') {
        const key = `fl.active.${data.user.id}.${new Date().toISOString().slice(0,10)}`;
        if (sessionStorage.getItem(key)) return;
        const { error } = await sb.from('analytics_events').insert({user_id:data.user.id,event_name:event,properties});
        if (!error) sessionStorage.setItem(key,'1');
      } else await sb.from('analytics_events').insert({user_id:data.user.id,event_name:event,properties});
    } catch { /* Analytics must never block product use. */ }
  })();
}
export function trackPageview(url: string): void {
  try { if (new URL(url, window.location.origin).pathname.startsWith('/app')) track('app.active'); } catch {}
}
