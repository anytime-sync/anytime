import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task } from './db.types';
import { nextTaskRecurrence } from './task-recurrence';

/** Exact revision identifies the completion across double clicks, concurrent
 * clients and lost responses. Never fall back to two independent writes. */
export async function completeTaskOccurrence(
  supabase: SupabaseClient,
  task: Task,
  zone: string,
  expectedRevision = task.updated_at,
) {
  const recurrence = nextTaskRecurrence(task, zone);
  const { data, error } = await supabase.rpc('complete_task_occurrence', {
    p_user_id: task.user_id,
    p_task_id: task.id,
    p_expected_updated_at: expectedRevision,
    p_next: recurrence?.patch ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { data: Task; recurring: boolean };
}
