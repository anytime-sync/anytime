/**
 * POST /api/telegram/webhook
 *
 * Receives Telegram Bot updates and routes them to First Light actions.
 *
 * Commands:
 *   /start          — link Telegram account
 *   /today          — show today's tasks
 *   /add <text>     — create a task (natural language: "meeting with Patrick tomorrow 3pm")
 *   /done <number>  — complete a task by its list number
 *   /week           — show this week's tasks
 *   /overdue        — show overdue tasks
 *   <free text>     — treated as /add
 *
 * Env vars needed:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET (optional, for webhook verification)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  type TelegramUpdate,
  sendMessage,
  isBotConfigured,
  verifyWebhookSecret,
} from "@/lib/telegram";
import { accountTimezone, channelTaskFilter, parseChannelTask } from '@/lib/task-channel';
import { taskNotificationDate } from '@/lib/task-notification';
import { calendarDate } from '@/lib/day-window';
import { completeTaskOccurrence } from '@/lib/task-completion';
import type { Task } from '@/lib/db.types';

// Service-role client for DB access
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ---------------------------------------------------------------------------
// User linking: Telegram ID → First Light user
// ---------------------------------------------------------------------------

async function getUserByTelegramId(
  telegramId: number,
): Promise<{ userId: string } | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("user_telegram_links")
    .select("user_id")
    .eq("telegram_id", telegramId)
    .single();
  return data ? { userId: data.user_id } : null;
}


async function linkByCode(
  telegramId: number,
  code: string,
  telegramUsername?: string,
): Promise<{ userId: string } | { error: string }> {
  const sb = getSupabase();
  
  // Look up the code
  const { data: token } = await sb
    .from("telegram_link_tokens")
    .select("user_id, expires_at")
    .eq("code", code.toUpperCase())
    .single();

  if (!token) {
    return { error: "Invalid code. Go to firstlight.to/app/settings → Telegram to get a new one." };
  }

  if (new Date(token.expires_at) < new Date()) {
    // Clean up expired token
    await sb.from("telegram_link_tokens").delete().eq("code", code.toUpperCase());
    return { error: "Code expired. Go to Settings → Telegram and generate a new one." };
  }

  // Check if this telegram_id is already linked to another account
  const { data: existing } = await sb
    .from("user_telegram_links")
    .select("user_id")
    .eq("telegram_id", telegramId)
    .single();

  if (existing) {
    return { error: "This Telegram account is already linked to a First Light account." };
  }

  // Create the link
  const { error: linkError } = await sb
    .from("user_telegram_links")
    .upsert({
      user_id: token.user_id,
      telegram_id: telegramId,
      telegram_username: telegramUsername ?? null,
    }, { onConflict: "user_id" });

  if (linkError) {
    return { error: "Failed to link: " + linkError.message };
  }

  // Delete the used token
  await sb.from("telegram_link_tokens").delete().eq("code", code.toUpperCase());

  return { userId: token.user_id };
}

// ---------------------------------------------------------------------------
// Task helpers
// ---------------------------------------------------------------------------

type TaskRow = Task;
async function getTasks(userId: string, zone: string, days = 1, overdue = false): Promise<TaskRow[]> {
  let query = getSupabase().from('tasks').select('*')
    .eq('user_id', userId).neq('status', 'archived')
    .or(channelTaskFilter(calendarDate(new Date(), zone), zone, days, overdue))
    .order('due_at', { ascending: true }).limit(100);
  if (overdue) query = query.eq('is_completed', false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
async function createTask(userId: string, text: string, zone: string): Promise<TaskRow> {
  const parsed = parseChannelTask(text, zone);
  const { title, start_at, due_at, start_date, due_date, schedule_timezone, time_kind, is_all_day, priority, rrule, reminder_at, reminder_offset_min } = parsed;
  const { data, error } = await getSupabase().from('tasks').insert({
    user_id: userId, title: (title || text).trim().slice(0, 500), status: 'open',
    start_at, due_at, start_date, due_date, schedule_timezone, time_kind,
    is_all_day, priority, rrule, reminder_at, reminder_offset_min,
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}
async function completeTask(userId: string, task: TaskRow, zone: string): Promise<boolean> {
  // The listed revision, not a refetched newer one, is the user's command.
  if (task.user_id !== userId || !task.updated_at) return false;
  try { await completeTaskOccurrence(getSupabase(), task, zone, task.updated_at); return true; }
  catch { return false; }
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const PRIORITY_EMOJI: Record<number, string> = {
  0: "",
  1: "🔵",
  3: "🟡",
  5: "🔴",
};

function formatTaskList(tasks: TaskRow[], title: string, zone: string, offset = 0): string {
  if (!tasks.length) return `${title} · ${zone}\n\nNo tasks.`;
  return `${title} · ${zone}\n\n` + tasks.map((task, index) => {
    const label = taskNotificationDate(task, zone);
    return `${index + offset + 1}. ${task.status === 'done' ? '✅' : '⬜'} ${PRIORITY_EMOJI[task.priority] ?? ''}${task.title}${label ? ` (${label})` : ''}`;
  }).join('\n');
}
function formatCreated(task: TaskRow, zone: string): string {
  const when = taskNotificationDate(task, zone);
  return `✨ Created: ${task.title}${when ? ` · ${when}` : ''} · ${zone}`;
}

// ---------------------------------------------------------------------------
// Command router
// ---------------------------------------------------------------------------

// Keep a short-lived cache of listed tasks per chat so /done N works
const taskListCache = new Map<number, TaskRow[]>();

async function handleCommand(
  telegramId: number,
  chatId: number,
  text: string,
  username?: string,
): Promise<string> {
  const cmd = text.startsWith("/") ? text.split(/\s+/)[0].toLowerCase() : null;
  const args = cmd ? text.slice(cmd.length).trim() : text;
  
  const link = await getUserByTelegramId(telegramId);
  
  // Handle /start with linking code
  if (!link && cmd === "/start" && args.length > 0) {
    const result = await linkByCode(telegramId, args, username);
    if ("error" in result) {
      return result.error;
    }
    return (
      "✅ Account linked successfully!\n\n" +
      "Try /today to see your tasks, or just type a task to add it."
    );
  }
  
  if (!link) {
    return (
      "👋 Welcome to First Light!\n\n" +
      "To connect your account:\n" +
      "1. Go to firstlight.to/app/settings\n" +
      "2. Scroll to \"Telegram\"\n" +
      "3. Click \"Connect Telegram\"\n" +
      "4. Send the code here\n\n" +
      "Or just type a 6-character code if you have one."
    );
  }

  const { userId } = link;
  const zone = await accountTimezone(getSupabase(), userId);

  switch (cmd) {
    case "/start":
      return "Welcome to First Light! Your account is linked. Try /today to see your tasks.";

    case "/today": {
      const tasks = await getTasks(userId, zone);
      const overdue = await getTasks(userId, zone, 1, true);
      taskListCache.set(chatId, [...tasks, ...overdue]);
      let msg = formatTaskList(tasks, "📋 Today", zone);
      if (overdue.length > 0) {
        msg += "\n\n" + formatTaskList(overdue, "⚠️ Overdue", zone, tasks.length);
      }
      return msg;
    }

    case "/week": {
      const tasks = await getTasks(userId, zone, 7);
      taskListCache.set(chatId, tasks);
      return formatTaskList(tasks, "📅 This Week", zone);
    }

    case "/overdue": {
      const tasks = await getTasks(userId, zone, 1, true);
      taskListCache.set(chatId, tasks);
      return formatTaskList(tasks, "⚠️ Overdue", zone);
    }

    case "/done": {
      const n = parseInt(args, 10);
      if (isNaN(n) || n < 1) {
        return "Usage: /done <number>\n\nUse the number from /today or /week list.";
      }
      const cached = taskListCache.get(chatId);
      if (!cached || n > cached.length) {
        return "No task list cached. Run /today first, then /done <number>.";
      }
      const task = cached[n - 1];
      const ok = await completeTask(userId, task, zone);
      return ok ? `✅ Done: ${task.title}` : "Task changed or completion failed. Refresh /today or /week before trying again.";
    }

    case "/add": {
      if (!args) return "Usage: /add <task description>";
      try { return formatCreated(await createTask(userId, args, zone), zone); }
      catch (error) { return `Task not saved: ${error instanceof Error ? error.message : 'Try again.'}`; }
    }

    default: {
      // If user is not linked and sends a 6-char code, try linking
      if (!link && /^[A-Fa-f0-9]{6}$/.test(text.trim())) {
        const result = await linkByCode(telegramId, text.trim(), username);
        if ("error" in result) {
          return result.error;
        }
        return (
          "✅ Account linked successfully!\n\nTry /today to see your tasks, or just type a task to add it."
        );
      }
      // Treat free text as a new task
      if (text.trim().length > 0 && !text.startsWith("/")) {
        try { return formatCreated(await createTask(userId, text, zone), zone); }
        catch (error) { return `Task not saved: ${error instanceof Error ? error.message : 'Try again.'}`; }
      }
      return (
        "First Light Bot\n\n" +
        "/today — today's tasks\n" +
        "/week — this week\n" +
        "/overdue — overdue tasks\n" +
        "/add <text> — create a task\n" +
        "/done <N> — complete task #N\n" +
        "\nOr just type a task to add it!"
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isBotConfigured()) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 503 });
  }

  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const msg = update.message;
  if (!msg?.text || !msg.from) {
    return NextResponse.json({ ok: true }); // ignore non-text messages
  }

  try {
    const reply = await handleCommand(msg.from.id, msg.chat.id, msg.text, msg.from.username);
    await sendMessage(msg.chat.id, reply, {
      replyToMessageId: msg.message_id,
    });
  } catch (err) {
    console.error("[telegram] handler error:", err);
    await sendMessage(msg.chat.id, "Something went wrong. Try again.");
  }

  // Telegram expects 200 quickly
  return NextResponse.json({ ok: true });
}
