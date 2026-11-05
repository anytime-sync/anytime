import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const owner = '00000000-0000-4000-8000-000000000001',
  task = '00000000-0000-4000-8000-000000000002';

const migration = () =>
  readFileSync(
    'supabase/migrations/20261105080347_worldwide_schedule_sync.sql',
    'utf8',
  );

/** Bounded hosted catalog parity, supplied read-only by the coordinator.
 * The queue body, trigger, FK and ACL below are exact. Group activity models
 * only the supplied DELETE branch; it is not the complete hosted function. */
async function fixture(applyMigration = true) {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${owner}');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('fixture.uid',true),'')::uuid $$;
      create function auth.role() returns text language sql as $$ select current_setting('fixture.role',true) $$;
      grant usage on schema auth to authenticated, service_role;
      create table tasks(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, assignee_id uuid references auth.users(id) on delete set null, project_id uuid, share_group_id uuid, title text, notes text, priority int, position int, start_at timestamptz, due_at timestamptz, is_all_day boolean, rrule text, is_completed boolean default false, completed_at timestamptz, status text, parent_id uuid, calendar_event_id text, reminder_at timestamptz, reminder_sent_at timestamptz, updated_at timestamptz default now());
      create function public.is_project_member(id uuid) returns boolean language sql as $$ select id='00000000-0000-4000-8000-000000000004'::uuid and auth.uid()='00000000-0000-4000-8000-000000000003'::uuid $$;
      create function public.is_share_group_member(id uuid) returns boolean language sql as $$ select false $$;
      create table user_calendar_connections(user_id uuid, provider text, primary_calendar_id text);
      create table pending_calendar_deletions(user_id uuid not null references auth.users(id) on delete cascade, calendar_id text, event_id text not null);
      alter table pending_calendar_deletions enable row level security;
      create policy owner_queue on pending_calendar_deletions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      grant select,insert,update,delete on pending_calendar_deletions to authenticated,service_role;
      create function public.queue_calendar_event_delete() returns trigger language plpgsql security definer set search_path to 'public','pg_catalog' as $$
      DECLARE v_calendar_id text;
      BEGIN
        IF OLD.calendar_event_id IS NULL THEN RETURN OLD; END IF;
        SELECT primary_calendar_id INTO v_calendar_id FROM public.user_calendar_connections WHERE user_id=OLD.user_id AND provider='google';
        INSERT INTO public.pending_calendar_deletions(user_id,calendar_id,event_id) VALUES(OLD.user_id,v_calendar_id,OLD.calendar_event_id);
        RETURN OLD;
      END; $$;
      revoke all on function public.queue_calendar_event_delete() from public,anon,authenticated;
      grant execute on function public.queue_calendar_event_delete() to service_role;
      create trigger tasks_queue_calendar_delete after delete on public.tasks for each row execute function public.queue_calendar_event_delete();
      create table share_groups(id uuid primary key);
      create table group_activity(group_id uuid not null references share_groups(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null, task_id uuid);
      create function public.tg_group_task_activity() returns trigger language plpgsql security definer set search_path to 'public','pg_catalog' as $$
      begin
        if tg_op='DELETE' then
          if old.share_group_id is not null then insert into public.group_activity(group_id,actor_id,task_id) values(old.share_group_id,auth.uid(),old.id); end if;
          return old;
        end if;
        return new;
      end $$;
      revoke all on function public.tg_group_task_activity() from public,anon,authenticated;
      grant execute on function public.tg_group_task_activity() to service_role;
      create trigger tg_tasks_group_activity after insert or delete or update on public.tasks for each row execute function public.tg_group_task_activity();
      create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
      create trigger tasks_set_updated_at before update on tasks for each row execute function public.set_updated_at();
      alter table tasks enable row level security;
      create policy owner_only on tasks for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
      create policy "assignee reads task" on public.tasks for select to authenticated using(assignee_id=auth.uid());
      create policy "assignee updates task" on public.tasks for update to authenticated using(assignee_id=auth.uid()) with check((assignee_id=auth.uid()) or (user_id=auth.uid()));
      grant select,insert,update,delete on tasks to authenticated,service_role;
      grant select on user_calendar_connections to service_role;
      insert into tasks(id,user_id,title,due_at) values('${task}','${owner}','Fixture','2026-03-07T14:00Z');
      insert into user_calendar_connections values('${owner}','google','fixture-calendar');`);
    const compat = readFileSync(
      'supabase/migrations/0021_api_compat.sql',
      'utf8',
    );
    await db.exec(
      compat
        .split('-- ===== tasks.status =====')[1]
        .split('-- ===== goals table =====')[0],
    );
    await db.exec(
      readFileSync(
        'supabase/migrations/20261005140000_task_time_intent.sql',
        'utf8',
      ),
    );
    if (applyMigration) await db.exec(migration());
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

it('executes prepared SQL in an ephemeral fixture: atomic history, retry receipt, CAS, ownership and baseline persistence', async () => {
  const db = await fixture();
  try {
    const row = async () =>
      (await db.query<any>('select * from tasks where id=$1', [task])).rows[0];
    expect(await row()).toMatchObject({
      time_kind: null,
      calendar_dirty: false,
      start_date: null,
      due_date: null,
      schedule_timezone: null,
      calendar_baseline: null,
    });
    await db.exec(
      `set fixture.uid='${owner}'; set fixture.role='authenticated'; set role authenticated;`,
    );
    await expect(
      db.exec(`update tasks set calendar_etag='forged' where id='${task}'`),
    ).rejects.toThrow('calendar_state_is_server_managed');
    await expect(
      db.exec(`update tasks set calendar_event_id='forged' where id='${task}'`),
    ).rejects.toThrow('calendar_state_is_server_managed');
    await expect(
      db.exec(
        `update tasks set calendar_event_generation=5 where id='${task}'`,
      ),
    ).rejects.toThrow('calendar_state_is_server_managed');
    await expect(
      db.exec(
        `insert into task_completion_receipts values('${owner}','${task}',now(),'{"forged":true}')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      `update tasks set title='Native edit still allowed' where id='${task}'`,
    );
    expect((await row()).calendar_dirty).toBe(true);
    await expect(
      db.exec(`update tasks set calendar_dirty=false where id='${task}'`),
    ).rejects.toThrow('calendar_state_is_server_managed');
    await db.exec(
      `update tasks set is_all_day=true,time_kind='deadline',due_date='2026-11-05',due_at='2026-11-04T16:00Z',schedule_timezone='Asia/Taipei' where id='${task}'`,
    );
    await expect(
      db.exec(`update tasks set due_at='2026-11-05T16:00Z' where id='${task}'`),
    ).rejects.toThrow('civil_date_changed_use_current_client');
    expect((await row()).due_date.toISOString().slice(0, 10)).toBe(
      '2026-11-05',
    );
    await db.exec(
      `update tasks set due_date='2026-11-06',due_at='2026-11-05T16:00Z' where id='${task}'`,
    );
    await db.exec(
      `update tasks set due_date=null,due_at='2026-03-07T14:00Z',is_all_day=false where id='${task}'; reset role;`,
    );
    await db.exec(`update tasks set time_kind='deadline',schedule_timezone='America/New_York',rrule='FREQ=DAILY;COUNT=2',reminder_offset_min=30 where id='${task}';
      create function reject_fixture_history() returns trigger language plpgsql as $$ begin if new.is_completed then raise exception 'fixture_history_failed'; end if; return new; end $$;
      create trigger zz_fixture_history before insert on tasks for each row execute function reject_fixture_history();
      set fixture.uid='${owner}'; set fixture.role='authenticated'; set role authenticated;`);
    const before = await row();
    const revision = before.updated_at.toISOString();
    const patch = {
      due_at: '2026-03-08T13:00:00Z',
      rrule: 'FREQ=DAILY;COUNT=1',
      reminder_at: '2026-03-08T12:30:00Z',
    };
    const complete = () =>
      db.query<any>(
        'select public.complete_task_occurrence($1,$2,$3,$4) result',
        [owner, task, revision, JSON.stringify(patch)],
      );
    await expect(complete()).rejects.toThrow('fixture_history_failed');
    expect(await row()).toEqual(before);
    await db.exec(
      'reset role; drop trigger zz_fixture_history on tasks; set role authenticated;',
    );
    const result = await complete();
    expect(result.rows[0].result).toMatchObject({
      recurring: true,
      data: { id: task, rrule: 'FREQ=DAILY;COUNT=1' },
    });
    const [retry1, retry2] = await Promise.all([complete(), complete()]);
    expect(retry1.rows).toEqual(result.rows);
    expect(retry2.rows).toEqual(result.rows);
    expect((await db.query('select id from tasks')).rows).toHaveLength(2);
    const history = (
      await db.query<any>('select * from tasks where id<>$1', [task])
    ).rows[0];
    expect(history).toMatchObject({
      is_completed: true,
      status: 'done',
      rrule: null,
      calendar_event_id: null,
      schedule_timezone: 'America/New_York',
    });
    await expect(
      db.query('select public.complete_task_occurrence($1,$2,$3,null)', [
        '00000000-0000-4000-8000-000000000099',
        task,
        revision,
      ]),
    ).rejects.toThrow('task_not_found');
    await expect(
      db.query(
        'select public.reconcile_task_calendar($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          owner,
          task,
          revision,
          'fixture-calendar',
          'event',
          '"v1"',
          '{}',
          '{}',
        ],
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec(
      `reset role; update tasks set calendar_event_id='event',calendar_dirty=true where id='${task}'; set role service_role; set fixture.role='service_role';`,
    );
    const current = await row();
    const reconcile = (rev: string) =>
      db.query<any>(
        'select public.reconcile_task_calendar($1,$2,$3,$4,$5,$6,$7,$8) saved',
        [
          owner,
          task,
          rev,
          'fixture-calendar',
          'event',
          '"v1"',
          JSON.stringify({ summary: 'Remote fixture' }),
          JSON.stringify({ title: 'Remote fixture' }),
        ],
      );
    expect((await reconcile(revision)).rows[0].saved).toBe(false);
    expect(
      (await reconcile(current.updated_at.toISOString())).rows[0].saved,
    ).toBe(true);
    expect(await row()).toMatchObject({
      title: 'Remote fixture',
      calendar_dirty: false,
      calendar_etag: '"v1"',
      calendar_id: 'fixture-calendar',
    });
    await db.exec(`reset role;
      insert into auth.users values('00000000-0000-4000-8000-000000000003');
      create policy shared_fixture_select on tasks for select to authenticated using(project_id='00000000-0000-4000-8000-000000000004');
      create policy shared_fixture_update on tasks for update to authenticated using(project_id='00000000-0000-4000-8000-000000000004') with check(project_id='00000000-0000-4000-8000-000000000004');
      update tasks set project_id='00000000-0000-4000-8000-000000000004' where id='${task}';
      set fixture.uid='00000000-0000-4000-8000-000000000003'; set fixture.role='authenticated'; set role authenticated;`);
    const sharedRevision = (
      await db.query<any>(
        'select updated_at::text revision from tasks where id=$1',
        [task],
      )
    ).rows[0].revision;
    const sharedArgs = [
      owner,
      task,
      sharedRevision,
      JSON.stringify({ ...patch, due_at: '2026-03-09T13:00:00Z' }),
    ];
    await db.query(
      'select public.complete_task_occurrence($1,$2,$3,$4)',
      sharedArgs,
    );
    await db.query(
      'select public.complete_task_occurrence($1,$2,$3,$4)',
      sharedArgs,
    );
    expect(
      (
        await db.query<any>(
          'select count(*)::int n from tasks where user_id=auth.uid() and is_completed',
        )
      ).rows[0].n,
    ).toBe(1);
    await db.exec(
      "reset role; set role service_role; set fixture.role='service_role';",
    );
    await db.query('delete from tasks where id=$1', [task]);
    expect(
      (await db.query('select * from task_completion_receipts')).rows,
    ).toHaveLength(0);
    expect(
      (await db.query<any>('select * from task_calendar_deletion_baselines'))
        .rows[0],
    ).toMatchObject({
      user_id: owner,
      task_id: task,
      event_id: 'event',
      etag: '"v1"',
    });
  } finally {
    await db.close();
  }
}, 20000);

it('preserves assignee-only completion, exact retries and revocation without granting metadata or receipt writes', async () => {
  const db = await fixture();
  const assignee = '00000000-0000-4000-8000-000000000003';
  const replacement = '00000000-0000-4000-8000-000000000005';
  const stranger = '00000000-0000-4000-8000-000000000006';
  try {
    await db.exec(`insert into auth.users values('${assignee}'),('${replacement}'),('${stranger}');
      update tasks set assignee_id='${assignee}',rrule='FREQ=DAILY;COUNT=3',time_kind='deadline',is_all_day=false,schedule_timezone='America/New_York',
        calendar_event_id='event',calendar_id='fixture-calendar',calendar_etag='acknowledged',calendar_baseline='{"summary":"Fixture"}' where id='${task}';
      set fixture.uid='${assignee}'; set fixture.role='authenticated'; set role authenticated;`);
    const visible = (await db.query<any>('select * from tasks')).rows;
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({
      user_id: owner,
      assignee_id: assignee,
      project_id: null,
      share_group_id: null,
    });
    // Establish the deployed UPDATE capability independently of the new RPC.
    await db.exec(
      `update tasks set title='Assignee native edit' where id='${task}'`,
    );
    const revision = (
      await db.query<any>(
        'select updated_at::text revision from tasks where id=$1',
        [task],
      )
    ).rows[0].revision;
    await expect(
      db.exec(`update tasks set calendar_etag='forged' where id='${task}'`),
    ).rejects.toThrow('calendar_state_is_server_managed');
    await expect(
      db.exec(`update tasks set user_id='${assignee}' where id='${task}'`),
    ).rejects.toThrow('task_identity_is_immutable');
    await expect(
      db.exec(
        `insert into task_completion_receipts values('${assignee}','${task}',now(),'{}')`,
      ),
    ).rejects.toThrow(/permission denied/);
    const args = [
      owner,
      task,
      revision,
      JSON.stringify({
        due_at: '2026-03-08T13:00:00Z',
        rrule: 'FREQ=DAILY;COUNT=2',
        user_id: assignee,
        assignee_id: stranger,
        calendar_event_id: 'forged',
        calendar_etag: 'forged',
        calendar_baseline: { forged: true },
        calendar_dirty: false,
      }),
    ];
    const complete = () =>
      db.query<any>(
        'select public.complete_task_occurrence($1,$2,$3,$4) result',
        args,
      );
    const completed = await complete();
    expect(completed.rows[0].result).toMatchObject({
      recurring: true,
      data: {
        id: task,
        user_id: owner,
        assignee_id: assignee,
        calendar_event_id: 'event',
        calendar_etag: 'acknowledged',
        calendar_baseline: { summary: 'Fixture' },
        calendar_dirty: true,
      },
    });
    expect((await complete()).rows).toEqual(completed.rows);
    expect((await complete()).rows).toEqual(completed.rows);
    expect(
      (await db.query<any>('select * from tasks where user_id=auth.uid()'))
        .rows,
    ).toMatchObject([
      {
        is_completed: true,
        calendar_event_id: null,
        calendar_etag: null,
        calendar_baseline: null,
      },
    ]);
    expect(
      (await db.query('select * from task_completion_receipts')).rows,
    ).toHaveLength(1);
    for (const statement of [
      "update task_completion_receipts set result='{}'",
      'delete from task_completion_receipts',
      'truncate task_completion_receipts',
    ])
      await expect(db.exec(statement)).rejects.toThrow(/permission denied/);

    // Access is rechecked before receipt lookup, including a retry after reassignment.
    await db.exec(
      `reset role; update tasks set assignee_id='${replacement}' where id='${task}'; set role authenticated;`,
    );
    expect(
      (await db.query('select id from tasks where id=$1', [task])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query('select * from task_completion_receipts')).rows,
    ).toHaveLength(0);
    await expect(complete()).rejects.toThrow('task_not_found');
    await db.exec(`set fixture.uid='${stranger}'`);
    await expect(complete()).rejects.toThrow('task_not_found');
    // NULL assignee must not turn IF NOT(authorized) into a NULL/bypass.
    await db.exec(
      `reset role; update tasks set assignee_id=null where id='${task}'; set role authenticated;`,
    );
    await expect(complete()).rejects.toThrow('task_not_found');
    await db.exec('reset role');
    expect(
      (await db.query('select * from task_completion_receipts')).rows,
    ).toHaveLength(1);
    expect((await db.query('select * from tasks')).rows).toHaveLength(2);
  } finally {
    await db.close();
  }
}, 20000);

it('reproduces the inherited account-cascade FK failure with the exact existing queue trigger before the proposed migration', async () => {
  const db = await fixture(false);
  try {
    await db.exec(
      `update tasks set calendar_event_id='event' where id='${task}'`,
    );
    await expect(
      db.query('delete from auth.users where id=$1', [owner]),
    ).rejects.toThrow(/pending_calendar_deletions_user_id_fkey/);
    // Failed account deletion is atomic; no fixture data was partially removed.
    expect((await db.query('select * from auth.users')).rows).toHaveLength(1);
    expect((await db.query('select * from tasks')).rows).toHaveLength(1);
    expect(
      (await db.query('select * from pending_calendar_deletions')).rows,
    ).toHaveLength(0);
  } finally {
    await db.close();
  }
}, 20000);

it('keeps linked-task deletion enqueue, trusted snapshots and queue ACL while fixing the inherited account-cascade interaction', async () => {
  const db = await fixture(false);
  const queueMetadata = () =>
    db.query(`select p.oid,p.proacl::text,p.proowner,p.prosecdef,p.proconfig,t.oid trigger_oid,t.tgtype
    from pg_proc p join pg_trigger t on t.tgfoid=p.oid
    where p.oid='public.queue_calendar_event_delete()'::regprocedure and t.tgname='tasks_queue_calendar_delete'`);
  try {
    const before = await queueMetadata();
    await db.exec(migration());
    expect((await queueMetadata()).rows).toEqual(before.rows);
    expect(
      (
        await db.query<any>(`select has_function_privilege('authenticated','public.queue_calendar_event_delete()','EXECUTE') client,
      has_function_privilege('anon','public.queue_calendar_event_delete()','EXECUTE') anon,
      has_function_privilege('service_role','public.queue_calendar_event_delete()','EXECUTE') server`)
      ).rows[0],
    ).toEqual({ client: false, anon: false, server: true });
    await db.exec(`update tasks set calendar_event_id='event',calendar_id='fixture-calendar',calendar_etag='acknowledged',calendar_baseline='{}' where id='${task}';
      set fixture.uid='${owner}'; set fixture.role='authenticated'; set role authenticated;`);
    await db.query('delete from tasks where id=$1', [task]);
    expect(
      (await db.query('select * from pending_calendar_deletions')).rows,
    ).toEqual([
      { user_id: owner, calendar_id: 'fixture-calendar', event_id: 'event' },
    ]);
    // Existing owner-editable queue fields are never trusted provider authority.
    await db.exec(
      "update pending_calendar_deletions set calendar_id='forged',event_id='forged'",
    );
    await expect(
      db.exec('select * from task_calendar_deletion_baselines'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("update task_calendar_deletion_baselines set etag='forged'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec(
        `insert into task_calendar_deletion_baselines values('${owner}','forged','forged','${task}','forged','{}')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    expect(
      (await db.query('select * from task_calendar_deletion_baselines')).rows,
    ).toEqual([
      {
        user_id: owner,
        event_id: 'event',
        calendar_id: 'fixture-calendar',
        task_id: task,
        etag: 'acknowledged',
        baseline: {},
      },
    ]);

    // Both BEFORE snapshot and exact existing AFTER queue triggers are present.
    // This account has no group-shared task; it is not a complete hosted cascade proof.
    await db.exec(`insert into tasks(id,user_id,title,calendar_event_id,calendar_id,calendar_etag,calendar_baseline)
      values('${task}','${owner}','Second linked fixture','event-2','fixture-calendar','acknowledged','{}');
      set fixture.uid='';`);
    await db.query('delete from auth.users where id=$1', [owner]);
    for (const table of [
      'auth.users',
      'tasks',
      'pending_calendar_deletions',
      'task_calendar_deletion_baselines',
      'task_completion_receipts',
    ]) {
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
    }
  } finally {
    await db.close();
  }
}, 20000);

it('bounds the modeled inherited group-activity DELETE behavior without changing that function', async () => {
  const db = await fixture();
  const group = '00000000-0000-4000-8000-000000000007';
  try {
    await db.exec(`insert into share_groups values('${group}'); update tasks set share_group_id='${group}' where id='${task}';
      set fixture.uid='${owner}'; delete from tasks where id='${task}';`);
    expect((await db.query('select * from group_activity')).rows).toEqual([
      { group_id: group, actor_id: owner, task_id: task },
    ]);
    // Model only the supplied branch's missing-group ordering, not an assertion
    // that hosted account deletion takes this order or has these relationships.
    await db.exec(`insert into tasks(id,user_id,share_group_id,title) values('${task}','${owner}','${group}','Group fixture');
      delete from share_groups where id='${group}'; set fixture.uid='';`);
    await expect(
      db.query('delete from auth.users where id=$1', [owner]),
    ).rejects.toThrow(/group_activity_group_id_fkey/);
    expect((await db.query('select * from auth.users')).rows).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 20000);

it.each([
  [
    'missing function',
    'drop trigger tasks_queue_calendar_delete on tasks; drop function public.queue_calendar_event_delete()',
  ],
  ['missing trigger', 'drop trigger tasks_queue_calendar_delete on tasks'],
  [
    'client execution granted',
    'grant execute on function public.queue_calendar_event_delete() to authenticated',
  ],
])(
  'preflight rejects an unreviewed queue prerequisite: %s',
  async (_reason, change) => {
    const db = await fixture(false);
    try {
      await db.exec(change);
      await expect(db.exec(migration())).rejects.toThrow(
        'worldwide_schedule_requires_reviewed_calendar_queue',
      );
      await db.exec('rollback');
      expect(
        (
          await db.query(
            `select 1 from information_schema.columns where table_name='tasks' and column_name='start_date'`,
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.close();
    }
  },
  20000,
);
