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

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_at: string | null;
  start_at: string | null;
  is_all_day: boolean;
  completed_at: string | null;
}

async function getTodayTasks(userId: string): Promise<TaskRow[]> {
  const sb = getSupabase();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const { data } = await sb
    .from("tasks")
    .select("id, title, status, priority, due_at, start_at, is_all_day, completed_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .gte("due_at", startOfDay.toISOString())
    .lte("due_at", endOfDay.toISOString())
    .order("due_at", { ascending: true });

  return (data ?? []) as TaskRow[];
}

async function getOverdueTasks(userId: string): Promise<TaskRow[]> {
  const sb = getSupabase();
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  const { data } = await sb
    .from("tasks")
    .select("id, title, status, priority, due_at, start_at, is_all_day, completed_at")
    .eq("user_id", userId)
    .eq("status", "open")
    .lt("due_at", now.toISOString())
    .order("due_at", { ascending: true });

  return (data ?? []) as TaskRow[];
}

async function getWeekTasks(userId: string): Promise<TaskRow[]> {
  const sb = getSupabase();
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const { data } = await sb
    .from("tasks")
    .select("id, title, status, priority, due_at, start_at, is_all_day, completed_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .gte("due_at", now.toISOString())
    .lte("due_at", endOfWeek.toISOString())
    .order("due_at", { ascending: true });

  return (data ?? []) as TaskRow[];
}

async function createTask(
  userId: string,
  title: string,
  dueAt?: string,
  startAt?: string,
): Promise<TaskRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      due_at: dueAt ?? null,
      start_at: startAt ?? null,
      status: "open",
      priority: 0,
      is_all_day: !startAt && !dueAt?.includes("T"),
    })
    .select("id, title, status, priority, due_at, start_at, is_all_day, completed_at")
    .single();

  if (error) throw new Error(error.message);
  return data as TaskRow;
}

async function completeTask(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const sb = getSupabase();
  const { error } = await sb
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);
  return !error;
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

function formatTaskList(tasks: TaskRow[], title: string): string {
  if (tasks.length === 0) return `${title}\n\nNo tasks.`;

  const lines = tasks.map((t, i) => {
    const done = t.status === "done" ? "✅" : "⬜";
    const pri = PRIORITY_EMOJI[t.priority] ?? "";
    const time = t.due_at && !t.is_all_day
      ? new Date(t.due_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Taipei",
        })
      : t.is_all_day
        ? "all day"
        : "";
    const timeStr = time ? ` (${time})` : "";
    return `${i + 1}. ${done} ${pri}${t.title}${timeStr}`;
  });

  return `${title}\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Natural language parsing (simple, no AI call needed for basic patterns)
// ---------------------------------------------------------------------------

function parseTaskInput(text: string): { title: string; dueAt?: string } {
  // For now, just pass through. chrono-node parsing happens server-side
  // via the existing /api/ai/parse-task route if needed.
  // Basic: if the text has "tomorrow", "today", etc. we can handle simply.
  return { title: text.trim() };
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

  switch (cmd) {
    case "/start":
      return "Welcome to First Light! Your account is linked. Try /today to see your tasks.";

    case "/today": {
      const tasks = await getTodayTasks(userId);
      const overdue = await getOverdueTasks(userId);
      taskListCache.set(chatId, [...overdue, ...tasks]);
      let msg = formatTaskList(tasks, "📋 Today");
      if (overdue.length > 0) {
        msg += "\n\n" + formatTaskList(overdue, "⚠️ Overdue");
      }
      return msg;
    }

    case "/week": {
      const tasks = await getWeekTasks(userId);
      taskListCache.set(chatId, tasks);
      return formatTaskList(tasks, "📅 This Week");
    }

    case "/overdue": {
      const tasks = await getOverdueTasks(userId);
      taskListCache.set(chatId, tasks);
      return formatTaskList(tasks, "⚠️ Overdue");
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
      const ok = await completeTask(userId, task.id);
      return ok ? `✅ Done: ${task.title}` : "Failed to complete task.";
    }

    case "/add": {
      if (!args) return "Usage: /add <task description>";
      const parsed = parseTaskInput(args);
      const task = await createTask(userId, parsed.title, parsed.dueAt);
      return `✨ Created: ${task.title}`;
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
        const parsed = parseTaskInput(text);
        const task = await createTask(userId, parsed.title, parsed.dueAt);
        return `✨ Created: ${task.title}`;
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
