import { expect, it } from 'vitest';
import { todayIntent } from './activation';
it('new tasks stay on today without a past 09:00 booking', () => {
  for (const hour of [8, 14, 23]) {
    const now = new Date(2026, 9, 3, hour, 30);
    const task = todayIntent(now);
    expect(Date.parse(task.due_at)).toBeGreaterThan(+now);
    expect(new Date(task.due_at).getDate()).toBe(now.getDate());
    expect(task.start_at).toBeNull(); expect(task.is_all_day).toBe(true);
  }
});
