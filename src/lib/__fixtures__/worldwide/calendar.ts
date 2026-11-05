/** In-memory provider/database fixtures. No credentials or network access. */
import { vi } from 'vitest';
import { eventBaseline } from '../../calendar-reconcile';
const copy = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
export function fixtureDatabase(tasks: any[] = []) {
  let clock = 0;
  const tables: Record<string, any[]> = {
    tasks: copy(tasks),
    user_preferences: [{ user_id: 'owner', timezone: 'Asia/Taipei' }],
    user_calendar_connections: [
      {
        user_id: 'owner',
        provider: 'google',
        primary_calendar_id: 'primary',
        sync_token: null,
        updated_at: 'connection-v1',
      },
    ],
    calendar_events: [],
    pending_calendar_deletions: [],
    task_calendar_deletion_baselines: [],
  };
  const writes: any[] = [],
    reads: any[] = [];
  const state = {
    fail: '' as string,
    beforeWrite: null as null | ((table: string, patch: any) => void),
  };
  const bump = () =>
    new Date(Date.UTC(2026, 10, 5, 0, 0, ++clock)).toISOString();
  const db: any = {
    from(table: string) {
      const filters: ((r: any) => boolean)[] = [],
        log: any[] = [];
      let action = 'read',
        payload: any,
        head = false,
        limit = Infinity;
      const run = () => {
        if (state.fail === `${table}:${action}`)
          return {
            data: null,
            error: { message: 'fixture_db_failure' },
            count: null,
          };
        if (action !== 'read') {
          state.beforeWrite?.(table, payload);
          writes.push({
            table,
            action,
            payload: copy(payload),
            filters: copy(log),
          });
        } else reads.push({ table, filters: copy(log) });
        let rows = (tables[table] ?? [])
          .filter((r) => filters.every((f) => f(r)))
          .slice(0, limit);
        if (action === 'update')
          for (const r of rows) {
            Object.assign(r, copy(payload));
            if (table === 'tasks') r.updated_at = bump();
          }
        if (action === 'delete')
          tables[table] = (tables[table] ?? []).filter(
            (r) => !rows.includes(r),
          );
        if (action === 'upsert')
          for (const item of Array.isArray(payload) ? payload : [payload]) {
            const old = tables[table].find(
              (r) =>
                r.user_id === item.user_id &&
                r.provider === item.provider &&
                r.external_id === item.external_id,
            );
            if (old) Object.assign(old, copy(item));
            else tables[table].push(copy(item));
          }
        return {
          data: head ? null : copy(rows),
          error: null,
          count: rows.length,
        };
      };
      const q: any = {
        select(c = '*', opts: any = {}) {
          head = !!opts.head;
          return q;
        },
        eq(k: string, v: any) {
          log.push(['eq', k, v]);
          filters.push((r) => r[k] === v);
          return q;
        },
        is(k: string, v: any) {
          log.push(['is', k, v]);
          filters.push((r) => (r[k] ?? null) === v);
          return q;
        },
        neq(k: string, v: any) {
          log.push(['neq', k, v]);
          filters.push((r) => r[k] !== v);
          return q;
        },
        not(k: string, _op: string, v: any) {
          log.push(['not', k, _op, v]);
          filters.push((r) => (r[k] ?? null) !== v);
          return q;
        },
        or(value: string) {
          log.push(['or', value]);
          if (value === 'start_at.not.is.null,due_at.not.is.null')
            filters.push((r) => r.start_at || r.due_at);
          return q;
        },
        order() {
          return q;
        },
        limit(n: number) {
          limit = n;
          return q;
        },
        update(p: any) {
          action = 'update';
          payload = p;
          return q;
        },
        delete() {
          action = 'delete';
          return q;
        },
        upsert(p: any) {
          action = 'upsert';
          payload = p;
          return q;
        },
        maybeSingle() {
          const result = run();
          return Promise.resolve({ ...result, data: result.data?.[0] ?? null });
        },
        then(resolve: any, reject: any) {
          return Promise.resolve().then(run).then(resolve, reject);
        },
      };
      return q;
    },
    rpc: vi.fn(async (name: string, p: any) => {
      if (state.fail === 'rpc')
        return { data: null, error: { message: 'fixture_rpc_failed' } };
      if (name === 'claim_pending_calendar_deletions')
        return {
          data: copy(tables.pending_calendar_deletions.slice(0, p.batch_size)),
          error: null,
        };
      if (name === 'reconcile_task_calendar') {
        const r = tables.tasks.find(
          (t) =>
            t.id === p.p_task_id &&
            t.user_id === p.p_user_id &&
            t.updated_at === p.p_expected_updated_at &&
            t.calendar_event_id === p.p_event_id,
        );
        if (!r) return { data: false, error: null };
        Object.assign(r, copy(p.p_patch), {
          calendar_id: p.p_calendar_id,
          calendar_etag: p.p_etag,
          calendar_baseline: copy(p.p_baseline),
          calendar_dirty: false,
          calendar_conflict: null,
          calendar_pending: null,
          updated_at: bump(),
        });
        return { data: true, error: null };
      }
      throw new Error('Unexpected fixture RPC ' + name);
    }),
  };
  return {
    db,
    tables,
    writes,
    reads,
    state,
    edit(id: string, patch: any) {
      const t = tables.tasks.find((t) => t.id === id);
      Object.assign(t, copy(patch), {
        updated_at: bump(),
        calendar_dirty: true,
      });
    },
  };
}
export function fixtureProvider(mocks: {
  create: any;
  patch: any;
  remove: any;
  get: any;
}) {
  const events = new Map<string, any>();
  let revision = 0;
  const state = {
    createLost: false,
    patchLost: false,
    beforePatch: null as null | ((id: string) => void),
    beforeDelete: null as null | ((id: string) => void),
    fail: '',
  };
  const save = (event: any) => {
    const next = { ...copy(event), etag: `"fixture-${++revision}"` };
    events.set(event.id, next);
    return copy(next);
  };
  mocks.get.mockImplementation(async ({ eventId }: any) => {
    if (!events.has(eventId)) throw new Error('google_get_event_failed: 404');
    return copy(events.get(eventId));
  });
  mocks.create.mockImplementation(async ({ event }: any) => {
    if (state.fail) throw new Error(state.fail);
    if (events.has(event.id))
      throw new Error('google_create_event_failed: 409');
    const r = save({ ...event, status: 'confirmed' });
    if (state.createLost) {
      state.createLost = false;
      throw new Error('fixture_lost_create_response');
    }
    return r;
  });
  mocks.patch.mockImplementation(async ({ eventId, patch, ifMatch }: any) => {
    if (state.fail) throw new Error(state.fail);
    state.beforePatch?.(eventId);
    const old = events.get(eventId);
    if (!ifMatch || old?.etag !== ifMatch)
      throw new Error('google_precondition_failed');
    const r = save({ ...old, ...patch });
    if (state.patchLost) {
      state.patchLost = false;
      throw new Error('fixture_lost_patch_response');
    }
    return r;
  });
  mocks.remove.mockImplementation(async ({ eventId, ifMatch }: any) => {
    if (state.fail) throw new Error(state.fail);
    state.beforeDelete?.(eventId);
    const old = events.get(eventId);
    if (old?.status === 'cancelled') return;
    if (!ifMatch || old?.etag !== ifMatch)
      throw new Error('google_precondition_failed');
    save({ id: eventId, status: 'cancelled' });
  });
  return {
    events,
    state,
    save,
    baseline(id: string) {
      return eventBaseline(events.get(id));
    },
  };
}
