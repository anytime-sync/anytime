# Current product scope

Hosted AI and semantic search were retired on 2026-10-18. See docs/PUBLIC_CONTENT_FACTS.md and src/lib/product-availability.ts. Earlier AI setup notes below are historical.

# First Light

Cloud engineering, isolated checks and release gates: [operating workflow](docs/OPERATIONS.md) | [prioritized backlog](docs/BACKLOG.md).

A calm place to get things done. Tasks, calendar, habits, Pomodoro — synced anywhere. task-manager–class, self-hosted, and yours. Web first; the architecture extends naturally to mobile (Capacitor) and desktop (Tauri / Electron) without changing the core code.

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
# Optional — enables AI features (Daily Edition, Weekly Retro, LLM quick-add,
# Smart Eisenhower). The app works without this; AI features are skipped.
ANTHROPIC_API_KEY=sk-ant-...
```

You'll find Supabase keys under Supabase → Project Settings → API. Get an Anthropic key at https://console.anthropic.com/.

### AI features

When `ANTHROPIC_API_KEY` is set, the app turns on:

- **Daily Edition** — editorial morning briefing on the Today page, in a calm, magazine-style voice. Cached server-side per user per local date.
- **Weekly review** (`/app/retro`) — last week's edition: what shipped, what slipped, what's worth dropping.
- **LLM quick-add parser** — quick-add and every inline "Add task" row run a Claude Haiku parse on submit, with the existing chrono-node parser as fallback. Understands richer natural language ("the Friday before the offsite", "after dentist before kids pickup").
- **Smart Eisenhower** — `AI · suggest` button on the matrix page proposes moves for tasks that look misplaced; one-click apply.
- **Voice capture** — microphone button on every Add Task input. Uses the browser's built-in `webkitSpeechRecognition` (no API key, no server round-trip).
- **Anti-overload banner** — Today view warns plainly when the day is over your daily capacity (default 4h), and offers to defer the lowest-priority task.

Costs are designed to be small: Haiku for parsing/quadrants, Sonnet for editorial briefings; daily and weekly outputs are cached.

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

## Roadmap — features still to build

This is a strong v1. Major task-management features still to build:

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
first-light/
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
    │   �