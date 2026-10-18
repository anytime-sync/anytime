import type { SupabaseClient } from '@supabase/supabase-js';

export type TaskUpdateActivity = { days: number; count: number | null };
const WINDOWS = [1, 3, 7, 14, 30];

/** Snapshot of task rows visible to this client under RLS, including automation.
 * A browser client sees owned/project/group-shared tasks, not global activity.
 * This is neither distinct people nor edit events nor cohort retention.
 * Errors stay unavailable instead of silently becoming zero activity.
 */
export async function loadTaskUpdateActivity(
  client: SupabaseClient,
  now = new Date(),
): Promise<TaskUpdateActivity[]> {
  const end = now.toISOString();
  return Promise.all(WINDOWS.map(async days => {
    try {
      const { count, error } = await client.from('tasks')
        .select('id', { count: 'exact', head: true })
        .gte('updated_at', new Date(now.getTime() - days * 86400000).toISOString())
        .lte('updated_at', end);
      return { days, count: error ? null : count };
    } catch {
      return { days, count: null };
    }
  }));
}
