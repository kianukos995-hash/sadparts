import { NextRequest } from "next/server";
import { processUpdates, type TelegramUpdate } from "@/lib/telegram";
import { readSettings } from "@/lib/server-store";

export async function POST(request: NextRequest) {
  const settings = await readSettings();
  if (!settings.telegramToken) {
    return Response.json({ error: "Бот не настроен" }, { status: 503 });
  }
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (settings.telegramSecret && secret !== settings.telegramSecret) {
    return Response.json({ error: "Неверный секрет вебхука" }, { status: 401 });
  }
  const update = (await request.json()) as TelegramUpdate;
  await processUpdates([update]);
  return Response.json({ ok: true });
}
