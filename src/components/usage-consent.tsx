"use client";

import { useEffect, useState } from 'react';

export function UsageConsent() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try { setEnabled(localStorage.getItem('fl.analyticsEnabled') === '1'); } catch {}
  }, []);
  return <label className="flex items-start gap-2 text-xs text-muted-fg">
    <input type="checkbox" checked={enabled} onChange={event => {
      const next = event.target.checked;
      try { localStorage.setItem('fl.analyticsEnabled', next ? '1' : '0'); setEnabled(next); } catch {}
    }} />
    <span>Help improve First Light with basic usage counts. Optional; no task contents. Change this choice on the <a href="/privacy" className="underline">privacy page</a>.</span>
  </label>;
}
