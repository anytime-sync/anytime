import type { SupabaseClient } from '@supabase/supabase-js';
import { syncUserCalendar, type SyncResult } from './calendar-sync';
import {
  drainCalendarDeletions,
  pushPendingTasksForUser,
} from './calendar-write';
import { getValidAccessToken } from './calendar-token';

/** The UI reports each direction and remaining durable work independently. */
export async function syncCalendarNow(
  supabase: SupabaseClient,
  userId: string,
) {
  let inbound: SyncResult;
  try {
    inbound = await syncUserCalendar({ supabase, userId });
  } catch (error) {
    inbound = {
      user_id: userId,
      status: 'error',
      count: 0,
      error: error instanceof Error ? error.message : 'inbound_failed',
    };
  }
  let outbound = { created: 0, patched: 0, failed: 0, conflicts: 0, error: '' };
  let deletions = { deleted: 0, failed: 0, error: '' };
  try {
    const { data: connection, error } = await supabase
      .from('user_calendar_connections')
      .select('primary_calendar_id')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle();
    if (error) throw error;
    if (!connection?.primary_calendar_id) throw new Error('not_connected');
    const token = await getValidAccessToken({ supabase, userId });
    if (!token) throw new Error('no_access_token');
    outbound = {
      ...(await pushPendingTasksForUser({
        supabase,
        userId,
        primaryCalendarId: connection.primary_calendar_id,
        accessToken: token,
      })),
      error: '',
    };
  } catch (error) {
    outbound.error = error instanceof Error ? error.message : 'outbound_failed';
  }
  try {
    deletions = {
      ...(await drainCalendarDeletions({ supabase, userId })),
      error: '',
    };
  } catch (error) {
    deletions.error =
      error instanceof Error ? error.message : 'deletions_failed';
  }
  // Match the two outbound queues. Unscheduled, completed and child tasks
  // without a mirror have nothing to send to Calendar.
  const { count: creates, error: createError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('calendar_dirty', true)
    .is('calendar_event_id', null)
    .is('parent_id', null)
    .eq('is_completed', false)
    .neq('status', 'done')
    .neq('status', 'archived')
    .or('start_at.not.is.null,due_at.not.is.null');
  const { count: patches, error: patchError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('calendar_dirty', true)
    .not('calendar_event_id', 'is', null);
  const pendingError = createError || patchError;
  const pending = (creates ?? 0) + (patches ?? 0);
  const { count: conflicts, error: conflictError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('calendar_conflict', 'is', null);
  const { count: pendingDeletions, error: deletionError } = await supabase
    .from('pending_calendar_deletions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const statusError = pendingError || conflictError || deletionError;
  const ok =
    inbound.status === 'ok' &&
    !outbound.error &&
    !outbound.failed &&
    !deletions.error &&
    !deletions.failed &&
    !statusError &&
    pending === 0 &&
    conflicts === 0 &&
    pendingDeletions === 0;
  return {
    ok,
    count: inbound.count,
    inbound,
    outbound,
    deletions,
    pending: pendingError ? null : pending,
    conflicts: conflictError ? null : conflicts,
    pending_deletions: deletionError ? null : pendingDeletions,
    ...(statusError ? { error: statusError.message } : {}),
  };
}
export type SyncNowResult = Awaited<ReturnType<typeof syncCalendarNow>>;
