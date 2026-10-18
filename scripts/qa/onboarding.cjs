// Runs the real Today page, view-mode hook and welcome modal in Chromium.
// Data hooks and unrelated page panels are fixtures. No auth or backend runs.
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { build } = require('esbuild'); // already supplied by the Vitest toolchain
const { chromium } = require('playwright-core'); // saved cloud QA runtime

const root = path.resolve(__dirname, '../..');
const fixtures = {
  '@/components/app/task-list-view': 'export function TaskListView(p) { return <main data-testid="list">{p.headerExtra}</main>; }',
  '@/hooks/use-tasks': `export const useTasks = () => ({data: []});
    export const useUpdateTask = () => ({mutate: () => { throw Error('Unexpected task update'); }});
    export const useCreateTask = () => ({mutateAsync: async task => { window.fixtureTasks.push(task); }});`,
  '@/hooks/use-calendar': 'export const useCalendarEvents = () => ({data: []});',
  '@/hooks/use-ai': 'export const useUserPrefs = () => ({data: {}});',
};
for (const [file, name] of Object.entries({
  'plan-my-day-button': 'PlanMyDayButton', 'today-ai-bar': 'TodayAiBar',
  'streak-ribbon': 'StreakRibbon', 'action-brief': 'ActionBrief',
  celebrations: 'Celebrations', 'calendar-event-chip': 'CalendarEventChip',
})) fixtures[`@/components/app/${file}`] = `export const ${name} = () => null;`;

(async () => {
  const bundle = await build({
    absWorkingDir: root, bundle: true, write: false, platform: 'browser', format: 'iife',
    jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' },
    stdin: { resolveDir: root, loader: 'tsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import TodayPage from './src/app/app/today/page';
      window.fixtureTasks = [];
      let root;
      window.loginFixture = () => {
        root?.unmount(); root = createRoot(document.getElementById('root'));
        root.render(<TodayPage />);
      };
      window.logoutFixture = () => { root?.unmount(); root = null; };
      window.loginFixture();`,
    },
    plugins: [{ name: 'isolated-data', setup(b) {
      b.onResolve({filter: /.*/}, args => {
        if (Object.hasOwn(fixtures, args.path)) return { path: args.path, namespace: 'fixture' };
        if (/supabase|resend|web-push/.test(args.path)) throw Error('Unexpected backend import: ' + args.path);
      });
      b.onLoad({filter: /.*/, namespace: 'fixture'}, args => ({
        contents: fixtures[args.path], loader: 'jsx', resolveDir: root,
      }));
    }}],
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/bundle.js') {
      res.writeHead(200, {'Content-Type': 'application/javascript'}); res.end(bundle.outputFiles[0].contents);
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.PW_EXE || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const mode of ['list', 'timeline']) {
      for (const dismiss of ['Skip for now', 'Close']) {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const external = [], errors = [];
        await context.route('**/*', route => {
          if (new URL(route.request().url()).origin === origin) return route.continue();
          external.push(new URL(route.request().url()).origin); return route.abort('blockedbyclient');
        });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        // No dayMode setting for list: exercise the actual default.
        if (mode === 'timeline') await context.addInitScript(() => localStorage.setItem('fl.dayMode', 'timeline'));
        await page.goto(origin);
        if (mode === 'list') assert.equal(await page.getByTestId('list').count(), 1);
        await page.getByRole('heading', {name: 'Two ways to begin.'}).waitFor({timeout: 5000});
        assert.equal(await page.getByRole('heading', {name: 'Two ways to begin.'}).count(), 1);
        await page.getByRole('button', {name: dismiss, exact: true}).click();
        assert.equal(await page.evaluate(() => localStorage.getItem('fl.onboardingSeen')), '1');
        for (let login = 0; login < 2; login++) {
          await page.evaluate(() => { window.logoutFixture(); window.loginFixture(); });
          await page.waitForTimeout(350); // modal's documented 250ms first-visit delay
          assert.equal(await page.getByRole('heading', {name: 'Two ways to begin.'}).count(), 0);
        }
        await page.getByRole('button', {name: mode === 'list' ? 'timeline' : 'list', exact: true}).click();
        await page.waitForTimeout(350);
        assert.equal(await page.getByRole('heading', {name: 'Two ways to begin.'}).count(), 0);
        await page.reload(); await page.waitForTimeout(350);
        assert.equal(await page.getByRole('heading', {name: 'Two ways to begin.'}).count(), 0);
        assert.deepEqual(await page.evaluate(() => window.fixtureTasks), []);
        assert.deepEqual(external, [], 'No external network request may escape the fixtures');
        assert.deepEqual(errors, []);
        results.push(`${mode}: ${dismiss}, two login remounts, view switch and reload`);
        await context.close();
      }
    }
    console.log(JSON.stringify({passed: results.length, checks: results, scope: 'isolated components; auth lifecycle simulated; no production login'}, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
