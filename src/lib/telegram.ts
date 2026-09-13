import { readSettings, readStore, writeSettings } from "@/lib/server-store";
import { formatSuppliers, formatTelegramAnswer, searchOffers, TELEGRAM_HELP } from "@/lib/search";

const API = "https://api.telegram.org";

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: TelegramUser;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function telegramApi<T>(token: string, method: string, body?: unknown) {
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json()) as TelegramApiResult<T>;
  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} не выполнен`);
  }
  return data.result as T;
}

export async function getBotProfile(token: string) {
  return telegramApi<{ username?: string; first_name?: string }>(token, "getMe");
}

export async function sendTelegramMessage(token: string, chatId: number, text: string) {
  await telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
  });
}

export async function handleTelegramText(text: string, chatId: number, token: string) {
  const store = await readStore();
  const trimmed = text.trim();
  const [command, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(" ").trim();
  const lower = command.toLowerCase();

  if (lower === "/start" || lower === "/help") {
    await sendTelegramMessage(token, chatId, TELEGRAM_HELP);
    return;
  }
  if (lower === "/suppliers") {
    await sendTelegramMessage(token, chatId, formatSuppliers(store));
    return;
  }
  const query = lower === "/search" || lower === "/min" ? arg : trimmed.replace(/^\//, "");
  if (!query) {
    await sendTelegramMessage(token, chatId, TELEGRAM_HELP);
    return;
  }
  const hits = searchOffers(store, query);
  await sendTelegramMessage(token, chatId, formatTelegramAnswer(store, hits, query));
}

export async function processUpdates(updates: TelegramUpdate[]) {
  const settings = await readSettings();
  const token = settings.telegramToken.trim();
  if (!token || updates.length === 0) return 0;
  let lastId = settings.telegramOffset;
  for (const update of updates) {
    lastId = Math.max(lastId, update.update_id);
    const text = update.message?.text;
    const chatId = update.message?.chat.id;
    if (!text || chatId == null) continue;
    try {
      await handleTelegramText(text, chatId, token);
    } catch (error) {
      console.error("telegram reply failed", error);
    }
  }
  await writeSettings({ telegramOffset: lastId });
  return updates.length;
}

let polling = false;

export async function pollTelegram() {
  if (polling) return { processed: 0, busy: true, configured: true };
  const settings = await readSettings();
  const token = settings.telegramToken.trim();
  if (!token || !settings.telegramPolling) return { processed: 0, configured: Boolean(token) };
  polling = true;
  try {
    const offset = settings.telegramOffset ? settings.telegramOffset + 1 : 0;
    const updates = await telegramApi<TelegramUpdate[]>(token, "getUpdates", {
      offset,
      timeout: 0,
      allowed_updates: ["message"],
    });
    const processed = await processUpdates(updates);
    return { processed, configured: true };
  } finally {
    polling = false;
  }
}
