import { NextRequest } from "next/server";
import { buildClientInvoice } from "@/lib/invoice";
import { readSettings, readStore, upsertOrder } from "@/lib/server-store";
import { sendTelegramDocument } from "@/lib/telegram";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: { chatId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const store = await readStore();
  const order = store.orders.find((item) => item.id === id);
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  if (order.lines.length === 0) {
    return Response.json({ error: "В заказе нет позиций" }, { status: 400 });
  }
  const client = store.clients.find((item) => item.id === order.clientId);
  const settings = await readSettings();
  const token = settings.telegramToken.trim();
  if (!token) {
    return Response.json({ error: "Сначала подключите Telegram-бота" }, { status: 400 });
  }
  const chatId = (
    body.chatId ||
    client?.telegramChatId ||
    settings.telegramNotifyChatId ||
    ""
  ).trim();
  if (!chatId) {
    return Response.json(
      { error: "Укажите Chat ID: в карточке клиента, в настройках или в окне отправки" },
      { status: 400 },
    );
  }
  const invoice = await buildClientInvoice(order, client, settings);
  await sendTelegramDocument(token, chatId, invoice.buffer, invoice.filename, invoice.caption);
  const next = {
    ...order,
    status: order.status === "draft" ? "assembled" : "sent",
    updatedAt: new Date().toISOString(),
    externalMessage: `Telegram ${chatId}`,
  } as typeof order;
  await upsertOrder(next);
  return Response.json({ ok: true, chatId, filename: invoice.filename });
}
