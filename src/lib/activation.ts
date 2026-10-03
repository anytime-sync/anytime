/** Capture today's intent without inventing a timed booking or a past deadline. */
export function todayIntent(now = new Date()) {
  const due = new Date(now);
  due.setHours(23, 59, 59, 999);
  return { due_at: due.toISOString(), is_all_day: true, start_at: null };
}
export const TUTORIAL_TITLES = new Set([
  'Welcome to First Light — try the quick add (press q)',
  'Toggle a list to Kanban view', 'Build a habit',
]);
