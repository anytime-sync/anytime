// Real capture components, queries and Supabase request serialization in Chromium.
// Auth and PostgREST are synthetic fixtures; every external request is blocked.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '../..');
const fixtures = {
  '@/lib/supabase/client': `import {createClient as client} from '@supabase/supabase-js';
    const sb = client(location.origin, 'fixture-anon', {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}});
    export const createClient = () => ({from: sb.from.bind(sb), auth: {getUser: async () => ({data: {user: {id: 'fixture-user'}}})}});`,
  './voice-button': 'export const VoiceButton = () => null;',
  './scan-tasks-sheet': 'export const ScanTasksSheet = () => null;',
  './action-brief': 'export const ActionBrief = () => null;',
  './task-item': 'export const TaskItem = ({task}) => <div data-testid="task">{task.title}</div>;',
  './sortable-mixed-list': `export const SortableMixedList = ({items}) => <div>{items.map(i =>
    <div key={i.id} data-testid={i.kind} data-id={i.id}>{i.kind === 'task' ? i.task.title : i.event.title}
      {i.kind === 'task' && i.task.tags.map(t => <span key={t.id}> #{t.name}</span>)}</div>)}</div>;`,
};

// Small strict PostgREST filter evaluator, limited to the operators used here.
// Unexpected requests fail the test; it does not simulate auth, RLS or SQL.
function split(value) {
  let depth = 0, start = 0;
  const out = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) { out.push(value.slice(start, i)); start = i + 1; }
  }
  return [...out, value.slice(start)];
}
function matches(row, expression) {
  for (const op of ['and', 'or']) if (expression.startsWith(op + '(')) {
    const parts = split(expression.slice(op.length + 1, -1)).map(p => matches(row, p));
    return op === 'and' ? parts.every(Boolean) : parts.some(Boolean);
  }
  const [, key, op, raw] = expression.match(/^([\w_>\-]+)\.(\w+)\.(.*)$/) || [];
  const field = key?.split(/->>?/).reduce((value, part) => value?.[part], row);
  const value = raw === 'null' ? null : raw === 'false' ? false : raw === 'true' ? true : raw;
  if (op === 'is' || op === 'eq') return (field ?? null) === value;
  if (op === 'neq') return field !== value;
  if (field == null) return false;
  if (op === 'lt') return field < value;
  if (op === 'gt') return field > value;
  if (op === 'gte') return field >= value;
  if (op === 'lte') return field <= value;
  throw Error('Unimplemented fixture filter: ' + expression);
}
const task = (id, due_at, extra = {}) => ({
  id, title: id, user_id: 'fixture-user', status: 'open', is_completed: false,
  parent_id: null, project_id: null, start_at: null, due_at, start_date: null, due_date: null, schedule_timezone: null, position: 0,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', ...extra,
});
function database(options = {}) {
  return { tasks: [], tags: [], task_tags: [], projects: [], calendar_events: [],
    user_preferences: [{timezone: 'Asia/Taipei'}], calls: [], failures: [], finished: 0, holdTask: null, ...options };
}
async function backend(route, db, violations) {
  const request = route.request(), url = new URL(request.url());
  const json = data => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
  if (url.pathname === '/api/calendar/google/status') return json({connected: false});
  if (url.pathname === '/api/keywords/active') return json({phrases: []});
  if (url.pathname === '/api/keywords/quadrants') return json({keywords: []});
  const table = url.pathname.split('/rest/v1/')[1];
  if (!table || !Array.isArray(db[table])) {
    violations.push(request.method() + ' ' + url.pathname); return route.abort('blockedbyclient');
  }
  const call = {table, method: request.method(), query: Object.fromEntries(url.searchParams), prefer: request.headers().prefer};
  db.calls.push(call);
  if (call.method === 'GET') {
    if (table === 'user_preferences' && db.failures.includes('prefs-read')) return route.fulfill({status: 400, json: {message: 'Fixture preferences unavailable'}});
    let rows = db[table].map(r => ({...r}));
    for (const [key, value] of url.searchParams) {
      if (['select', 'order'].includes(key)) continue;
      rows = rows.filter(r => matches(r, key === 'or' ? 'or' + value : `${key}.${value}`));
    }
    if (table === 'tasks') rows = rows.map(r => ({...r, task_tags: db.task_tags.filter(l => l.task_id === r.id).map(l => ({...l, tags: db.tags.find(t => t.id === l.tag_id)}))}));
    return json(request.headers().accept?.includes('object+json') ? rows[0] ?? null : rows);
  }
  if (call.method === 'PATCH') {
    const body = request.postDataJSON(); call.body = body;
    const rows = db[table].filter(row => [...url.searchParams].filter(([key]) => !['select','order'].includes(key)).every(([key,value]) => matches(row, `${key}.${value}`)));
    for (const row of rows) Object.assign(row, body, {updated_at: new Date().toISOString()});
    return json(rows);
  }
  if (call.method !== 'POST') { violations.push(call.method + ' ' + table); return route.abort(); }
  const body = request.postDataJSON(); call.body = body;
  if (db.failures.includes(table + '-before')) return route.fulfill({status: 503, json: {message: 'Fixture ' + table + ' unavailable'}});
  if (table === 'tasks' && db.holdTask) await db.holdTask;
  const output = (Array.isArray(body) ? body : [body]).map(row => {
    const conflict = call.query.on_conflict?.split(',');
    const existing = conflict && db[table].find(r => conflict.every(k => r[k] === row[k]));
    if (existing) return existing;
    const id = table + '-' + (db[table].length + 1);
    const saved = table === 'tasks' ? task(id, null, row) : {id, is_archived: false, ...row};
    db[table].push(saved); return saved;
  });
  // Model a committed write whose response never reached the browser.
  if (db.failures.includes(table + '-after')) return route.abort('connectionreset');
  return json(request.headers().accept?.includes('object+json') ? output[0] : output);
}

module.exports = {fixtures, database, task, backend};

if (require.main === module) (async () => {
  const bundle = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: {'process.env.NODE_ENV': '"test"'},
    stdin: {resolveDir: root, loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
      import {Toaster} from 'sonner'; import {QuickAdd} from './src/components/app/quick-add';
      import {TaskListView} from './src/components/app/task-list-view';
      import {useUIStore} from './src/store/ui';
      let app; const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
      window.fixtureReady = () => qc.getQueryState(['projects'])?.status === 'success';
      window.remountFixture = () => {
        app?.unmount(); useUIStore.getState().setQuickAddOpen(false);
        app = createRoot(document.getElementById('root'));
        app.render(<QueryClientProvider client={qc}><a href="/away">Away</a><QuickAdd/>
          <TaskListView title="Fixture tasks" filter={{view: new URLSearchParams(location.search).get('view') || 'all'}}/>
          <Toaster/></QueryClientProvider>);
      }; window.remountFixture();`,
    },
    plugins: [{name: 'synthetic-boundaries', setup(b) {
      b.onResolve({filter: /.*/}, args => Object.hasOwn(fixtures, args.path) ? {path: args.path, namespace: 'fixture'} : undefined);
      b.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({contents: fixtures[args.path], loader: 'jsx', resolveDir: root}));
    }}],
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') { res.writeHead(200, {'Content-Type': 'application/javascript'}); return res.end(bundle.outputFiles[0].contents); }
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const results = [];
  let browser;
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.PW_EXE || '/usr/bin/chromium', args: ['--no-sandbox']});
    const origin = `http://127.0.0.1:${server.address().port}`;
    async function scenario(name, db, run, options = {}) {
      const context = await browser.newContext({timezoneId: options.device || 'America/Los_Angeles', serviceWorkers: 'block'});
      const violations = [], errors = [];
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { violations.push(url.origin); return route.abort('blockedbyclient'); }
        if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/api/')) return backend(route, db, violations).finally(() => { db.finished++; });
        return route.continue();
      });
      const page = await context.newPage(); page.setDefaultTimeout(6000);
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.setFixedTime(new Date(options.now || '2026-11-03T12:00:00.000Z'));
      await page.goto(origin + (options.view ? '?view=' + options.view : ''));
      await page.waitForFunction(() => window.fixtureReady());
      try {
        await run(page);
        assert.deepEqual(violations, [], 'No AI, calendar write, unexpected API or external traffic');
        assert.deepEqual(errors, []);
        results.push(name); console.log('PASS ' + name);
      } catch (e) { e.message = name + ': ' + e.message; throw e; }
      finally { await context.close(); }
    }
    async function inputFor(page, mode) {
      if (mode === 'quick') {
        await page.getByRole('button', {name: 'Quick add', exact: true}).click();
        return page.locator('input').first();
      }
      return page.locator('input').first();
    }
    async function saved(page, title) {
      await page.locator('[data-testid="task"]:not([data-id^="optimistic-"])').filter({hasText: title}).waitFor();
    }
    async function waitUntil(condition) {
      const deadline = Date.now() + 6000;
      while (!condition()) { assert.ok(Date.now() < deadline, 'fixture operation must complete'); await new Promise(resolve => setTimeout(resolve, 10)); }
    }
    const taskPosts = db => db.calls.filter(c => c.table === 'tasks' && c.method === 'POST');

    for (const mode of ['quick', 'inline']) {
      const db = database();
      await scenario(mode + ': missing explicit list before capture; one task after reload', db, async page => {
        const input = await inputFor(page, mode);
        await input.fill('Ship fixture tomorrow at 9am #work ~NewList'); await input.press('Enter');
        await saved(page, 'Ship fixture');
        assert.equal(db.tasks.length, 1); assert.equal(db.projects.length, 1);
        assert.equal(db.tasks[0].project_id, db.projects[0].id); assert.equal(db.tags.length, 1); assert.equal(db.task_tags.length, 1);
        const writes = db.calls.filter(c => c.method === 'POST').map(c => c.table);
        assert.deepEqual(writes, ['projects', 'tasks', 'tags', 'task_tags']);
        assert.equal(db.tasks[0].time_kind, 'deadline'); assert.equal(db.tasks[0].start_at, null); assert.ok(db.tasks[0].due_at);
        await page.reload(); await saved(page, 'Ship fixture');
        assert.equal(await page.getByTestId('task').count(), 1); assert.equal(taskPosts(db).length, 1);
      });
      const failure = database({failures: ['projects-before']});
      await scenario(mode + ': failed list preserves complete draft, retry saves requested list', failure, async page => {
        const input = await inputFor(page, mode), draft = 'Preserve fixture tomorrow at 9am #work ~NewList';
        await input.fill(draft); await input.press('Enter');
        await page.getByText('Fixture projects unavailable', {exact: true}).waitFor();
        assert.equal(await input.inputValue(), draft); assert.equal(taskPosts(failure).length, 0);
        failure.failures = []; await input.press('Enter'); await saved(page, 'Preserve fixture');
        assert.equal(failure.tasks.length, 1); assert.equal(failure.tasks[0].project_id, failure.projects[0].id);
        assert.ok(failure.tasks[0].due_at); assert.equal(failure.tags[0].name, 'work');
      });
      const existing = database({projects: [{id: 'existing-list', name: 'Work', is_archived: false}]});
      let release;
      existing.holdTask = new Promise(resolve => { release = resolve; });
      await scenario(mode + ': existing list, blank input and repeated Enter during insert', existing, async page => {
        const input = await inputFor(page, mode); await input.fill('   '); await input.press('Enter');
        assert.equal(taskPosts(existing).length, 0);
        await input.fill('Existing fixture ~work'); await input.press('Enter');
        await page.waitForFunction(() => document.querySelector('input[aria-busy="true"]'));
        for (let i = 0; i < 3; i++) await input.press('Enter');
        if (mode === 'quick') await input.press('Escape');
        assert.equal(await input.inputValue(), 'Existing fixture ~work');
        release(); await saved(page, 'Existing fixture');
        assert.equal(taskPosts(existing).length, 1); assert.equal(existing.tasks[0].project_id, 'existing-list');
        assert.equal(existing.calls.filter(c => c.table === 'projects' && c.method === 'POST').length, 0);
      });
      const taskFailure = database({failures: ['tasks-before']});
      await scenario(mode + ': retry task failure reuses the already saved explicit list', taskFailure, async page => {
        const input = await inputFor(page, mode), draft = 'Retry fixture #work ~NewList';
        await input.fill(draft); await input.press('Enter');
        await page.getByText('Fixture tasks unavailable', {exact: true}).waitFor();
        assert.equal(await input.inputValue(), draft); assert.equal(taskFailure.tasks.length, 0);
        taskFailure.failures = []; await input.press('Enter'); await saved(page, 'Retry fixture');
        assert.equal(taskFailure.projects.length, 1); assert.equal(taskFailure.tasks.length, 1);
        assert.equal(taskFailure.calls.filter(c => c.table === 'projects' && c.method === 'POST').length, 1);
      });
    }

    for (const failure of ['tags-before', 'tags-after', 'task_tags-after']) {
      const db = database({failures: [failure]});
      await scenario(failure + ': saved task retained, repeated metadata-only retries are idempotent', db, async page => {
        const input = await inputFor(page, 'quick'); await input.fill('Recover fixture #work'); await input.press('Enter');
        const retry = page.getByRole('button', {name: 'Retry tags', exact: true});
        await retry.waitFor(); await saved(page, 'Recover fixture'); assert.equal(taskPosts(db).length, 1);
        const finished = db.finished;
        await retry.click();
        await waitUntil(() => db.finished > finished && db.calls.filter(c => c.method === 'POST' && c.table === failure.split('-')[0]).length >= 2);
        assert.equal(taskPosts(db).length, 1); assert.equal(db.tasks.length, 1);
        db.failures = []; await retry.click(); await page.getByText('Tags saved', {exact: true}).waitFor();
        assert.equal(await retry.count(), 0); assert.equal(db.tags.length, 1); assert.equal(db.task_tags.length, 1);
        assert.equal(taskPosts(db).length, 1);
        for (const c of db.calls.filter(c => c.table === 'task_tags' && c.method === 'POST')) {
          assert.equal(c.query.on_conflict, 'task_id,tag_id'); assert.match(c.prefer, /resolution=ignore-duplicates/);
        }
        await page.reload(); await saved(page, 'Recover fixture'); assert.equal(await page.getByTestId('task').count(), 1);
      });
    }
    const partial = database({failures: ['tags-before']});
    await scenario('reload after partial success keeps task; recovery action is page-local', partial, async page => {
      const input = await inputFor(page, 'inline'); await input.fill('Reload fixture #work'); await input.press('Enter');
      await page.getByRole('button', {name: 'Retry tags'}).waitFor(); await saved(page, 'Reload fixture');
      await page.reload(); await saved(page, 'Reload fixture');
      assert.equal(await page.getByRole('button', {name: 'Retry tags'}).count(), 0);
      assert.equal(taskPosts(partial).length, 1); assert.equal(partial.tasks.length, 1);
    });
    const interrupted = database();
    await scenario('cancel, back and remount do not submit or resurrect unsaved drafts', interrupted, async page => {
      let input = await inputFor(page, 'quick'); await input.fill('Cancelled fixture ~Missing'); await input.press('Escape');
      input = await inputFor(page, 'quick'); assert.equal(await input.inputValue(), ''); await input.press('Escape');
      await page.locator('input').first().fill('Unsubmitted fixture #work');
      await page.getByRole('link', {name: 'Away'}).click(); await page.goBack(); await page.waitForFunction(() => window.fixtureReady());
      await page.evaluate(() => window.remountFixture());
      assert.equal(await page.locator('input').first().inputValue(), '');
      assert.equal(interrupted.calls.filter(c => c.method === 'POST').length, 0);
    });

    for (const view of ['today', 'tomorrow']) {
      const db = database({tasks: [task('at-start', '2026-10-25T16:00:00.000Z'), task('last-in-day', '2026-10-26T15:59:59.999Z'), task('next-start', '2026-10-26T16:00:00.000Z'), task('next-end', '2026-10-27T16:00:00.000Z')]});
      await scenario('Taipei account / Los Angeles device: ' + view + ' half-open membership', db, async page => {
        await page.getByTestId('task').first().waitFor();
        assert.deepEqual(await page.getByTestId('task').allTextContents(), view === 'today' ? ['at-start', 'last-in-day'] : ['next-start']);
        assert.match(await page.locator('body').innerText(), /Asia\/Taipei/);
        assert.equal(await page.evaluate(() => new Date().getDate()), 25, 'device date differs from account date 26');
        if (view === 'today') {
          const input = await inputFor(page, 'inline'); await input.fill('Account day fixture'); await input.press('Enter');
          await saved(page, 'Account day fixture'); assert.equal(db.tasks.at(-1).due_at, '2026-10-25T16:00:00.000Z');
        }
      }, {view, now: '2026-10-25T18:00:00.000Z'});
    }
    for (const device of ['Asia/Taipei', 'America/Los_Angeles']) {
      const db = database({user_preferences: [{timezone: 'America/New_York'}], tasks: [
        task('before-start', '2026-11-01T03:59:59.999Z'), task('at-start', '2026-11-01T04:00:00.000Z'),
        task('first-130', '2026-11-01T05:30:00.000Z'), task('second-130', '2026-11-01T06:30:00.000Z'),
        task('last-in-day', '2026-11-02T04:59:59.999Z'), task('next-start', '2026-11-02T05:00:00.000Z'),
      ]});
      await scenario('New York 25-hour Tomorrow / ' + device, db, async page => {
        await page.getByTestId('task').first().waitFor();
        assert.deepEqual(await page.getByTestId('task').allTextContents(), ['at-start', 'first-130', 'second-130', 'last-in-day']);
      }, {view: 'tomorrow', device, now: '2026-10-31T12:00:00.000Z'});
    }
    await scenario('preference failure is visible and disables account-day default capture', database({failures: ['prefs-read']}), async page => {
      await page.getByRole('alert').waitFor(); assert.equal(await page.locator('input').first().isDisabled(), true);
    }, {view: 'today'});
    console.log(JSON.stringify({passed: results.length, checks: results, scope: 'Synthetic PostgREST, real capture/query code; external browser traffic blocked; no login or production writes'}, null, 2));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error); process.exitCode = 1;});
