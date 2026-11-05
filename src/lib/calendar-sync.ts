/** Read all pages before advancing the checkpoint. Windowed resets never
 * authorize deletion by absence. Mapped task mirrors keep native identity. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getValidAccessToken } from './calendar-token';
import {
  listCalendarEvents,
  getCalendarEvent,
  type GoogleCalendarEvent,
} from './google-calendar';
import {
  isOurOwnEventTag,
  buildEventInput,
  taskEventId,
  type TaskRowForPush,
} from './calendar-write';
import { toCalendarEventRow } from './calendar-event-dates';
import {
  CalendarConflict,
  ordinaryInstance,
  recordCalendarConflict,
  reconcileTaskMirror,
  verifyMirror,
} from './calendar-reconcile';

export type SyncResult = {
  user_id: string;
  status: 'ok' | 'skipped' | 'error';
  count: number;
  error?: string;
  tasks_updated?: number;
  conflicts?: number;
};

const BOOTSTRAP_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const BOOTSTRAP_FUTURE_MS = 90 * 24 * 60 * 60 * 1000;

type ConnectionRow = {
  user_id: string;
  primary_calendar_id: string | null;
  sync_token: string | null;
  updated_at: string;
};

export async function syncUserCalendar({
  supabase,
  userId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  userId: string;
}): Promise<SyncResult> {
  const { data: connRaw, error: connErr } = await supabase
    .from('user_calendar_connections')
    .select('user_id, primary_calendar_id, sync_token, updated_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (connErr) {
    return {
      user_id: userId,
      status: 'error',
      count: 0,
      error: connErr.message,
    };
  }
  const conn = connRaw as ConnectionRow | null;
  if (!conn) {
    return {
      user_id: userId,
      status: 'skipped',
      count: 0,
      error: 'not_connected',
    };
  }
  if (!conn.primary_calendar_id) {
    return {
      user_id: userId,
      status: 'error',
      count: 0,
      error: 'no_primary_calendar_id',
    };
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken({ supabase, userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'token_refresh_failed';
    return { user_id: userId, status: 'error', count: 0, error: msg };
  }
  if (!accessToken) {
    return {
      user_id: userId,
      status: 'error',
      count: 0,
      error: 'no_access_token',
    };
  }

  const calendarId = conn.primary_calendar_id;
  let syncToken: string | null = conn.sync_token;
  let pageToken: string | undefined = undefined;
  let nextSyncToken: string | undefined = undefined;
  let total = 0,
    tasksUpdated = 0,
    conflicts = 0;
  const masters = new Map<string, GoogleCalendarEvent>();
  const processed = new Set<string>();
  const { data: prefs, error: prefsError } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefsError)
    return {
      user_id: userId,
      status: 'error',
      count: 0,
      error: prefsError.message,
    };
  const timezone = prefs?.timezone || 'UTC';
  let pages = 0;
  const MAX_PAGES = 25;

  const now = Date.now();
  let timeMin = syncToken
    ? undefined
    : new Date(now - BOOTSTRAP_PAST_MS).toISOString();
  let timeMax = syncToken
    ? undefined
    : new Date(now + BOOTSTRAP_FUTURE_MS).toISOString();

  try {
    while (pages < MAX_PAGES) {
      let resp;
      try {
        resp = await listCalendarEvents({
          accessToken,
          calendarId,
          syncToken,
          timeMin,
          timeMax,
          pageToken,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'list_events_failed';
        if (msg === 'google_sync_token_expired' && syncToken) {
          syncToken = null;
          pageToken = undefined;
          pages = 0;
          processed.clear();
          masters.clear();
          timeMin = new Date(now - BOOTSTRAP_PAST_MS).toISOString();
          timeMax = new Date(now + BOOTSTRAP_FUTURE_MS).toISOString();
          continue;
        }
        return {
          user_id: userId,
          status: 'error',
          count: total,
          tasks_updated: tasksUpdated,
          conflicts,
          error: msg,
        };
      }
      pages++;

      const externalItems: GoogleCalendarEvent[] = [];
      try {
        for (const ev of resp.items) {
          const mappedId = ev.recurringEventId ?? ev.id;
          const { data: mapped, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('calendar_event_id', mappedId)
            .maybeSingle();
          if (error) throw error;
          if (!mapped) {
            const tag = isOurOwnEventTag(ev.extendedProperties?.private);
            if (tag) {
              const { data: pending, error: pendingError } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('id', tag)
                .maybeSingle();
              if (pendingError) throw pendingError;
              if (
                pending?.calendar_pending?.operation === 'create' &&
                mappedId ===
                  taskEventId(
                    pending.id,
                    pending.calendar_event_generation ?? 0,
                  )
              )
                continue;
            }
            externalItems.push(ev);
            continue;
          }
          const task = mapped as TaskRowForPush;
          let master = ev;
          if (ev.recurringEventId) {
            master =
              masters.get(mappedId) ??
              (await getCalendarEvent({
                accessToken,
                calendarId,
                eventId: mappedId,
              }));
            masters.set(mappedId, master);
            try {
              verifyMirror(task, master, calendarId);
            } catch (error) {
              if (!(error instanceof CalendarConflict)) throw error;
              await recordCalendarConflict(supabase, task, error);
              processed.add(mappedId);
              conflicts++;
              continue;
            }
            if (!ordinaryInstance(ev, master)) {
              await recordCalendarConflict(
                supabase,
                task,
                new CalendarConflict(
                  'recurring_occurrence_edit_requires_review',
                  ev,
                ),
              );
              processed.add(mappedId);
              conflicts++;
              continue;
            }
          }
          if (processed.has(mappedId)) continue;
          const result = await reconcileTaskMirror(
            supabase,
            task,
            master,
            calendarId,
            buildEventInput(task, timezone),
            timezone,
          );
          processed.add(mappedId);
          if (result === 'updated') tasksUpdated++;
          if (result === 'conflict') conflicts++;
        }
      } catch (error) {
        return {
          user_id: userId,
          status: 'error',
          count: total,
          tasks_updated: tasksUpdated,
          conflicts,
          error:
            error instanceof Error ? error.message : 'task_reconcile_failed',
        };
      }

      if (externalItems.length > 0) {
        const rows = externalItems.map((ev) =>
          toCalendarEventRow({ userId, calendarId, ev, timezone }),
        );
        const { error: upErr } = await supabase
          .from('calendar_events')
          .upsert(rows, { onConflict: 'user_id,provider,external_id' });
        if (upErr) {
          return {
            user_id: userId,
            status: 'error',
            count: total,
            tasks_updated: tasksUpdated,
            conflicts,
            error: upErr.message,
          };
        }
        total += rows.length;
      }

      if (resp.nextPageToken) {
        pageToken = resp.nextPageToken;
        continue;
      }
      nextSyncToken = resp.nextSyncToken;
      pageToken = undefined;
      break;
    }

    // Never advertise a partial read as a successful synchronization.
    if (pageToken) {
      return {
        user_id: userId,
        status: 'error',
        count: total,
        tasks_updated: tasksUpdated,
        conflicts,
        error: 'calendar_sync_page_limit',
      };
    }

    let checkpoint = supabase
      .from('user_calendar_connections')
      .update({
        ...(nextSyncToken ? { sync_token: nextSyncToken } : {}),
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('updated_at', conn.updated_at);
    checkpoint = conn.sync_token
      ? checkpoint.eq('sync_token', conn.sync_token)
      : checkpoint.is('sync_token', null);
    const { data: savedCheckpoint, error: bumpErr } =
      await checkpoint.select('user_id');
    if (bumpErr) {
      return {
        user_id: userId,
        status: 'error',
        count: total,
        tasks_updated: tasksUpdated,
        conflicts,
        error: bumpErr.message,
      };
    }

    if (!savedCheckpoint?.length)
      return {
        user_id: userId,
        status: 'error',
        count: total,
        tasks_updated: tasksUpdated,
        conflicts,
        error: 'calendar_checkpoint_changed',
      };
    return {
      user_id: userId,
      status: 'ok',
      count: total,
      tasks_updated: tasksUpdated,
      conflicts,
    };
  } catch (error) {
    return {
      user_id: userId,
      status: 'error',
      count: total,
      tasks_updated: tasksUpdated,
      conflicts,
      error:
        error instanceof Error ? error.message : 'calendar_persistence_failed',
    };
  }
}
