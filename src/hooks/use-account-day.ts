'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useUserPrefs } from './use-ai';
import { calendarDate, dayWindow, validTimezone } from '@/lib/day-window';

// One timer/focus listener per active zone, shared by Calendar and task chips.
// This store contains calendar keys only, never preferences or user data.
const clocks = new Map<
  string,
  { listeners: Set<() => void>; stop: () => void }
>();
function subscribeDay(zone: string, listener: () => void) {
  let clock = clocks.get(zone);
  if (!clock) {
    const listeners = new Set<() => void>();
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      for (const update of listeners) update();
      timer = setTimeout(
        tick,
        Math.max(
          1,
          +dayWindow(calendarDate(new Date(), zone), zone).nextStart -
            Date.now(),
        ),
      );
    };
    clock = {
      listeners,
      stop: () => {
        clearTimeout(timer);
        if (typeof window !== 'undefined')
          window.removeEventListener('focus', tick);
      },
    };
    clocks.set(zone, clock);
    if (typeof window !== 'undefined') window.addEventListener('focus', tick);
    tick();
  }
  clock.listeners.add(listener);
  return () => {
    clock!.listeners.delete(listener);
    if (!clock!.listeners.size) {
      clock!.stop();
      clocks.delete(zone);
    }
  };
}

/** Account civil days are independent of device location. Missing/invalid
 * stored zones use the digest's UTC fallback until conditional initialization. */
export function useAccountDay() {
  const prefs = useUserPrefs();
  const timeZone = validTimezone(prefs.data?.timezone || 'UTC');
  const subscribe = useCallback(
    (listener: () => void) => subscribeDay(timeZone, listener),
    [timeZone],
  );
  const snapshot = useCallback(
    () => calendarDate(new Date(), timeZone),
    [timeZone],
  );
  const date = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { date, timeZone, isPending: prefs.isPending, error: prefs.error };
}
