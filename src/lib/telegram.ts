/**
 * Telegram Bot API client for First Light.
 *
 * Env: TELEGRAM_BOT_TOKEN
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ---------------------------------------------------------------------------
// Types (subset of Telegram Bot API)
// ---------------------------------------------------------------------------

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export async function sendMessage(
  chatId: number,
  text: string,
  opts?: { parseMode?: "Markdown" | "HTML"; replyToMessageId?: number },
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };
  if (opts?.parseMode) body.parse_mode = opts.parseMode;
  if (opts?.replyToMessageId) body.reply_to_message_id = opts.replyToMessageId;

  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[telegram] sendMessage failed:", err);
  }
}

export async function setWebhook(url: string): Promise<boolean> {
  const res = await fetch(`${API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      allowed_updates: ["message"],
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
    }),
  });
  const data = await res.json();
  return data.ok === true;
}

// ---------------------------------------------------------------------------
// Token check
// ---------------------------------------------------------------------------

export function isBotConfigured(): boolean {
  return BOT_TOKEN.length > 0;
}

export function verifyWebhookSecret(req: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured = skip check
  const header = req.headers.get("x-telegram-bot-api-secret-token");
  return header === secret;
}
