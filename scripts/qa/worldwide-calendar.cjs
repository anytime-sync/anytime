// Actual capture, Calendar, date picker and task query/update code in Chromium.
// Provider, authentication and PostgREST are local fixtures. External traffic is blocked.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('playwright-core');
const {
  fixtures: baseFixtures,
  database,
  task,
  backend,
} = require('./capture-reliability.cjs');
const root = path.resolve(__dirname, '../..');
const fixtures = {
  ...baseFixtures,
  '@/components/app/task-item': baseFixtures['./task-item'],
  'next/link':
    'export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; }',
};
(async () => {
  const bundle = await build({
    absWorkingDir: root,
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    stdin: {
      resolveDir: root,
      loader: 'tsx',
      contents: `
 import React from 'react'; import {createRoot} from 'react-dom/client'; import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
 import {QuickAdd} from './src/components/app/quick-add'; import CalendarPage from './src/app/app/calendar/page';
 import {DateTimePicker} from './src/components/app/date-time-picker'; import {useTask,useUpdateTask} from './src/hooks/use-tasks';
 import {useUIStore} from './src/store/ui'; import {Toaster} from 'sonner';
 const qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 window.fixtureReady=()=>qc.getQueryState(['userPrefs'])?.status==='success'&&qc.getQueryState(['projects'])?.status==='success';
 function Editor(){ const id=useUIStore(s=>s.selectedTaskId); const {data:task}=useTask(id); const update=useUpdateTask(); if(!task)return null;
 return <section aria-label="Fixture native editor"><h2>{task.title}</h2><DateTimePicker value={task.is_all_day?task.due_date||task.due_at:task.due_at} allDay={task.is_all_day} onChange={due_at=>update.mutate({id:task.id,due_at})}/><button onClick={()=>useUIStore.getState().setSelectedTaskId(null)}>Close editor</button></section>; }
 createRoot(document.getElementById('root')).render(<QueryClientProvider client={qc}><button onClick={()=>useUIStore.getState().setQuickAddOpen(true)}>Capture fixture</button><QuickAdd/><Editor/><CalendarPage/><Toaster/></QueryClientProvider>);
 `,
    },
    plugins: [
      {
        name: 'fixture-boundaries',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) =>
            Object.hasOwn(fixtures, args.path)
              ? { path: args.path, namespace: 'fixture' }
              : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: fixtures[args.path],
            loader: 'jsx',
            resolveDir: root,
          }));
        },
      },
    ],
  });
  const css = `body{margin:12px;font:14px sans-serif}.grid{display:grid}.grid-cols-7{grid-template-columns:repeat(7,minmax(0,1fr))}.grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}.grid-cols-12{grid-template-columns:repeat(12,minmax(0,1fr))}.flex{display:flex}.flex-col{flex-direction:column}.relative{position:relative}.absolute{position:absolute}.fixed{position:fixed;z-index:100;inset:0;background:white}.gap-px{gap:1px}.size-6{width:24px;height:24px}.size-9{width:36px;height:36px}.w-full{width:100%}.h-full{height:100%}.overflow-auto{overflow:auto}[data-day-cell-hit]{min-height:28px}.cursor-grab{padding:8px;background:#eee}.border-b{border-bottom:1px solid #ddd}button{cursor:pointer}svg{width:16px;height:16px}[role=dialog]{background:#fff;border:1px solid #ccc;padding:12px;z-index:1000}.pointer-events-none{pointer-events:none}.pointer-events-auto{pointer-events:auto}`;
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'content-type':
        req.url === '/bundle.js' ? 'application/javascript' : 'text/html',
    });
    res.end(
      req.url === '/bundle.js'
        ? bundle.outputFiles[0].contents
        : `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const results = [];
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PW_EXE || '/usr/bin/chromium',
      args: ['--no-sandbox'],
    });
    async function scenario(name, device, zone, now, run) {
      const db = database({ user_preferences: [{ timezone: zone }] });
      const context = await browser.newContext({
        timezoneId: device,
        viewport: { width: 1400, height: 1600 },
        serviceWorkers: 'block',
      });
      const violations = [],
        errors = [];
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {
          violations.push(url.origin);
          return route.abort('blockedbyclient');
        }
        if (
          url.pathname.startsWith('/rest/') ||
          url.pathname.startsWith('/api/')
        )
          return backend(route, db, violations);
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((instant) => {
        const NativeDate = Date;
        globalThis.Date = new Proxy(NativeDate, {
          construct(target, args, newTarget) {
            return Reflect.construct(
              target,
              args.length ? args : [instant],
              newTarget,
            );
          },
          apply() {
            return new NativeDate(instant).toString();
          },
          get(target, key) {
            return key === 'now' ? () => instant : Reflect.get(target, key);
          },
        });
      }, Date.parse(now));
      await page.goto(origin);
      await page.waitForFunction(() => window.fixtureReady());
      try {
        await run(page, db);
        assert.deepEqual(violations, []);
        assert.deepEqual(errors, []);
        results.push(name);
        console.log('PASS ' + name);
      } catch (e) {
        console.error({
          name,
          errors,
          violations,
          tasks: db.tasks,
          calls: JSON.stringify(db.calls.slice(-5)),
        });
        throw e;
      } finally {
        await context.close();
      }
    }
    const cell = (page, label) =>
      page
        .getByRole('button', { name: new RegExp(label) })
        .locator('xpath=../..');
    async function capture(page, text) {
      await page
        .getByRole('button', { name: 'Capture fixture', exact: true })
        .click();
      const input = page.locator('input').first();
      await input.fill(text);
      await input.press('Enter');
    }
    async function waitFor(test) {
      for (let i = 0; i < 200; i++) {
        if (test()) return;
        await new Promise((r) => setTimeout(r, 20));
      }
      assert.fail('fixture write timed out');
    }
    async function drag(page, source, target) {
      await source.scrollIntoViewIfNeeded();
      const a = await source.boundingBox(),
        b = await target.boundingBox();
      assert.ok(a && b);
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, {
        steps: 3,
      });
      await page.mouse.move(b.x + b.width / 2, b.y + 55, { steps: 12 });
      await page.mouse.up();
    }
    for (const device of ['UTC', 'Asia/Taipei', 'America/Los_Angeles'])
      await scenario(
        'create → Calendar → edit → drag → reload / ' + device,
        device,
        'America/New_York',
        '2026-03-07T18:00:00Z',
        async (page, db) => {
          await capture(page, 'Boundary tomorrow at 9am');
          await waitFor(() => db.tasks.length === 1);
          assert.equal(db.tasks[0].due_at, '2026-03-08T13:00:00.000Z');
          const march8 = cell(page, 'Sunday, March 8');
          await march8.getByText('Boundary', { exact: true }).waitFor();
          await march8.getByText('Boundary', { exact: true }).dblclick();
          const editor = page.getByRole('region', {
            name: 'Fixture native editor',
          });
          await editor.getByRole('button').first().click();
          const dialog = page.getByRole('dialog');
          await dialog
            .getByText('Hour', { exact: true })
            .locator('..')
            .getByRole('button', { name: '10', exact: true })
            .click();
          await dialog
            .getByRole('button', { name: 'Apply', exact: true })
            .click();
          await waitFor(
            () => db.tasks[0].due_at === '2026-03-08T14:00:00.000Z',
          );
          await editor.getByRole('button', { name: 'Close editor' }).click();
          await drag(
            page,
            march8.getByText('Boundary', { exact: true }),
            cell(page, 'Monday, March 9'),
          );
          await waitFor(
            () => db.tasks[0].due_at === '2026-03-09T14:00:00.000Z',
          );
          await page.reload();
          await cell(page, 'Monday, March 9')
            .getByText('Boundary', { exact: true })
            .waitFor();
          assert.equal(db.tasks.length, 1);
          assert.equal(db.tasks[0].schedule_timezone, 'America/New_York');
        },
      );
    await scenario(
      'civil date survives Kiritimati → Pago Pago account travel and drag',
      'America/Los_Angeles',
      'Pacific/Kiritimati',
      '2026-11-04T12:00:00Z',
      async (page, db) => {
        await capture(page, 'Civil tomorrow');
        await waitFor(() => db.tasks.length === 1);
        assert.equal(db.tasks[0].due_date, '2026-11-06');
        await cell(page, 'Friday, November 6')
          .getByText('Civil', { exact: true })
          .waitFor();
        db.user_preferences[0].timezone = 'Pacific/Pago_Pago';
        await page.reload();
        const from = cell(page, 'Friday, November 6');
        await from.getByText('Civil', { exact: true }).waitFor();
        await drag(
          page,
          from.getByText('Civil', { exact: true }),
          cell(page, 'Saturday, November 7'),
        );
        await waitFor(() => db.tasks[0].due_date === '2026-11-07');
        await page.reload();
        await cell(page, 'Saturday, November 7')
          .getByText('Civil', { exact: true })
          .waitFor();
        assert.equal(db.tasks.length, 1);
      },
    );
    for (const [date, text, error] of [
      ['2026-03-07T18:00Z', 'Gap tomorrow at 2:30am', 'does not exist'],
      ['2026-10-31T18:00Z', 'Fold tomorrow at 1:30am', 'Ambiguous'],
    ])
      await scenario(
        'explicit input rejects ' + text,
        'Asia/Taipei',
        'America/New_York',
        date,
        async (page, db) => {
          await capture(page, text);
          await page.getByText(new RegExp(error)).first().waitFor();
          assert.equal(await page.locator('input').first().inputValue(), text);
          assert.equal(db.tasks.length, 0);
        },
      );

    await scenario(
      'canonical Google DATE membership ignores old compatibility timestamps after travel',
      'Asia/Taipei',
      'Pacific/Pago_Pago',
      '2026-11-05T20:00Z',
      async (page, db) => {
        db.calendar_events.push({
          id: 'civil-event',
          title: 'DATE fixture',
          user_id: 'fixture-user',
          provider: 'google',
          external_id: 'provider-date',
          calendar_id: 'primary',
          is_all_day: true,
          cancelled: false,
          start_at: '2026-11-04T10:00:00Z',
          end_at: '2026-11-05T10:00:00Z',
          raw: {
            id: 'provider-date',
            etag: '"v1"',
            start: { date: '2026-11-05' },
            end: { date: '2026-11-06' },
          },
        });
        await page.reload();
        await cell(page, 'Thursday, November 5')
          .getByText('DATE fixture', { exact: true })
          .waitFor();
        await page
          .getByRole('button', { name: /Wednesday, November 4/ })
          .click();
        assert.equal(
          await page.getByText('DATE fixture', { exact: true }).count(),
          0,
        );
      },
    );
    await scenario(
      'cross-midnight work and multi-day DATE use exclusive ends in day view',
      'America/Los_Angeles',
      'Asia/Taipei',
      '2026-11-05T12:00Z',
      async (page, db) => {
        db.tasks.push(
          task('Midnight end', '2026-11-05T16:00:00Z', {
            start_at: '2026-11-05T15:00:00Z',
            time_kind: 'work',
            is_all_day: false,
          }),
          task('Overnight fixture', '2026-11-05T17:00:00Z', {
            start_at: '2026-11-05T15:00:00Z',
            time_kind: 'work',
            is_all_day: false,
          }),
        );
        db.calendar_events.push({
          id: 'span-event',
          title: 'DATE span',
          user_id: 'fixture-user',
          provider: 'google',
          external_id: 'provider-span',
          calendar_id: 'primary',
          is_all_day: true,
          cancelled: false,
          start_at: '2026-11-04T16:00:00Z',
          end_at: '2026-11-07T16:00:00Z',
          raw: {
            id: 'provider-span',
            etag: '"v1"',
            start: { date: '2026-11-05' },
            end: { date: '2026-11-08' },
          },
        });
        await page.reload();
        await cell(page, 'Thursday, November 5')
          .getByText('Midnight end', { exact: true })
          .waitFor();
        await page.getByRole('button', { name: /Friday, November 6/ }).click();
        await page.getByText('Overnight fixture', { exact: true }).waitFor();
        await page.getByText('DATE span', { exact: true }).waitFor();
        assert.equal(
          await page.getByText('Midnight end', { exact: true }).count(),
          0,
        );
        await page
          .getByRole('button', { name: 'Next day', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Next day', exact: true })
          .click();
        assert.equal(
          await page.getByText('DATE span', { exact: true }).count(),
          0,
        );
      },
    );
    console.log(
      JSON.stringify(
        {
          passed: results.length,
          checks: results,
          scope:
            'synthetic browser fixtures, external requests blocked; no provider or production acceptance',
        },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
