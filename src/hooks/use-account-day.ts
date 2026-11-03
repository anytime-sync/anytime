"use client";

import { useEffect, useState } from 'react';
import { useUserPrefs } from './use-ai';
import { calendarDate, dayWindow, validTimezone } from '@/lib/day-window';

/** Membership follows the account calendar, not the travelling device.
 * Missing/invalid zones use the digest's UTC fallback until initialization. */
export function useAccountDay() {
  const prefs = useUserPrefs();
  const [, refresh] = useState(0);
  const timeZone = validTimezone(prefs.data?.timezone || 'UTC');
  const date = calendarDate(new Date(), timeZone);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    const timer = setTimeout(update, Math.max(1, +dayWindow(date, timeZone).nextStart - Date.now()));
    if (typeof window !== 'undefined') window.addEventListener('focus', update);
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') window.removeEventListener('focus', update);
    };
  }, [date, timeZone]);
  return { date, timeZone, isPending: prefs.isPending, error: prefs.error };
}
