// Predicate body copied unchanged from eae82d4:src/lib/calendar-write.ts.
export function validCalendarBlock(t: { start_at: string; due_at: string; is_all_day: boolean }): boolean {
  const duration = Date.parse(t.due_at) - Date.parse(t.start_at);
  return !t.is_all_day && Number.isFinite(duration) && duration > 0 && duration < 86400000;
}
