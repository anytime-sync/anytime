# Anytime

A calm place to get things done. Tasks, calendar, habits, Pomodoro — synced anywhere. TickTick-inspired, self-hosted, and yours. Web first; the architecture extends naturally to mobile (Capacitor) and desktop (Tauri / Electron) without changing the core code.

## What's in v1

- **Auth** — email/password + magic link via Supabase
- **Smart views** — Today, Tomorrow, Next 7 Days, Inbox
- **Lists (projects)** with colors
- **Tags** auto-extracted from quick-add (`#tag`)
- **Quick add** with natural-language parsing — `"Email Sam tomorrow 9am #work !1 ~Inbox"`
- **Priorities** (4 levels)
- **Calendar view** with drag-to-reschedule
- **Pomodoro timer** with focus / short break / long break, session log
- **Habits tracker** with weekly grid
- **Eisenhower matrix** (urgency × importance)
- **Search** + command palette (`⌘K` / `Ctrl K`)
- **Real-time sync** across tabs/devices via Supabase Realtime
- **Dark / light theme**
- **PWA** (installable; offline shell)

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Realtime)
- TanStack Query (server state) + Zustand (UI state)
- @dnd-kit (drag/drop)
- date-fns + chrono-node
- lucide-react icons
- next-themes, sonner

---

## Getting started

### 1. Prerequisites
- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) project

### 2. Install

```bash
npm install
```

### 3. Create the Supabase database

1. Go to your Supabase project → SQL Editor
2. Open `supabase/migrations/0001_init.sql` from this repo
3. Paste it into the SQL editor and **Run**

This creates all tables, indexes, RLS policies, and the trigger that creates a profile + default list when a new user signs up. It also enables Realtime on the relevant tables.

### 4. Configure environment

Copy `.env.example` → `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

You'll find these under Supabase → Project Settings → API.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000 — sign up, then you're in.

---

## Keyboard shortcuts

| Shortcut    | Action               |
|-------------|----------------------|
| `⌘K` / `Ctrl K` | Command palette / search |
| `q`         | Quick-add task       |
| `Esc`       | Close any open dialog|

## Quick-add syntax

```
Email Sam tomorrow 9am #work !1 ~Inbox
```

| Token | Meaning |
|-------|---------|
| free text | task title |
| `tomorrow 9am`, `next monday`, `in 2 days` | due date/time (chrono-node) |
| `#tag`     | adds a tag (creates if missing) |
| `!1`–`!4`  | priority: 1 = High, 2 = Medium, 3 = Low, 4 = None |
| `~ListName`| route to list (creates if missing) |

---

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import in Vercel → set the same env vars.
3. Add your production URL to Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: `https://yourdomain.com/auth/callback`

That's it — clean cloud sync from any device that can open the URL.

## Add PWA icons (optional but recommended)

Drop two PNGs in `public/icons/`:
- `icon-192.png` (192 × 192)
- `icon-512.png` (512 × 512)

Anything visual will do — the manifest references them. (You can generate them quickly from any logo with a tool like [realfavicongenerator.net](https://realfavicongenerator.net).)

---

## Roadmap to "full TickTick"

This is a strong v1. Major TickTick features still to build:

- [ ] Recurring tasks (RRULE wiring — column already exists; UI editor + materialization on completion)
- [ ] Reminders / push notifications (web push + service worker scheduling)
- [ ] Subtasks UI (table column already exists)
- [ ] Kanban view per list (`projects.view_mode` already exists)
- [ ] Timeline / Gantt view
- [ ] Sharing & collaborators (add a `members` table + RLS)
- [ ] Attachments (Supabase Storage)
- [ ] Smart lists / saved filters
- [ ] Bulk edit, multi-select
- [ ] Sticky note widget, focus statistics dashboard
- [ ] Import from TickTick / Todoist / Apple Reminders / Google Tasks
- [ ] Quick capture from email (Postmark inbound parse)

## Extending to other devices

You picked "decide later" — here's the easy path when you're ready:

- **PWA** — already enabled. Visit on mobile Chrome / iOS Safari → "Add to Home Screen". Done.
- **Native iOS/Android** — wrap with [Capacitor](https://capacitorjs.com): `npx cap init && npx cap add ios && npx cap add android`. The web app runs unchanged inside the shell; you only add native plugins for things like push notifications.
- **Native desktop** — wrap with [Tauri](https://tauri.app/) or Electron. Same web bundle.
- **Pure native rewrite** — would replace this UI but keep Supabase, schema, RLS, and the realtime channel layout exactly as-is.

## Project layout

```
ticktick-clone/
├── middleware.ts
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/                    # add icon-192.png and icon-512.png
├── supabase/
│   └── migrations/0001_init.sql
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx              # marketing landing
    │   ├── login/, signup/, auth/{callback,signout}/
    │   └── app/
    │       ├── layout.tsx        # auth-gated, mounts AppShell
    │       ├── today/, tomorrow/, next7/, inbox/
    │       ├── lists/[id]/, tags/[name]/
    │       ├── calendar/, matrix/, pomodoro/, habits/
    ├── components/
    │   ├── providers.tsx
    │   └── app/
    │       ├── app-shell.tsx
    │       ├── sidebar.tsx
    │       ├── task-list-view.tsx, task-item.tsx, task-detail-panel.tsx
    │       ├── quick-add.tsx, command-palette.tsx
    │       ├── create-project-dialog.tsx
    │       └── sw-register.tsx
    ├── hooks/
    │   ├── use-projects.ts, use-tags.ts, use-tasks.ts
    │   ├── use-habits.ts, use-realtime-sync.ts
    ├── lib/
    │   ├── db.types.ts
    │   ├── quick-parse.ts
    │   ├── supabase/{client,server,middleware}.ts
    │   └── utils.ts
    └── store/
        └── ui.ts
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # run production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
```

## License

MIT — do anything you want with it.
