import { rrulestr } from 'rrule';
import { resolveTaskDates, type TaskDates } from './task-schedule';

/** COUNT is the remaining occurrence count for the advancing task row. The
 * completed one-off clone has no RRULE; never restart COUNT on every completion. */
export function nextTaskRecurrence(task: TaskDates & { rrule?: string | null }) {
  if (!task.rrule || !task.due_at) return null;
  const ruleText = task.rrule.trim().replace(/^RRULE:/i, '');
  if (/[\r\n]/.test(ruleText)) return null;
  const count = /(?:^|;)COUNT=(\d+)(?:;|$)/i.exec(ruleText);
  if (count && Number(count[1]) <= 1) return null;
  try {
    const from = new Date(task.due_at);
    const rule = rrulestr(`DTSTART:${from.toISOString().replace(/[-:]|\.\d{3}/g, '')}\nRRULE:${ruleText}`);
    const next = rule.after(from, false);
    if (!next) return null;
    const rrule = count ? ruleText.replace(/COUNT=\d+/i, `COUNT=${Number(count[1]) - 1}`) : ruleText;
    return { next, patch: { ...resolveTaskDates(task, { due_at: next.toISOString() }), rrule } };
  } catch { return null; }
}
