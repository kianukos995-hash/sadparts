"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, MessageCircle, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { invoiceTitle } from "@/lib/money-words";
import { priceOrder } from "@/lib/order-price";
import { whatsappOrderUrl } from "@/lib/order";
import type { Order } from "@/lib/types";

export function OrderShareBar({ order }: { order: Order }) {
  const router = useRouter();
  const pathname = usePathname();
  const { clients, settings, refresh } = useAvtoPrice();
  const client = clients.find((item) => item.id === order.clientId);
  const priced = priceOrder(order, client, settings.priceBands, order.markupPercent || settings.markupPercent);
  const [chatId, setChatId] = useState(
    client?.telegramChatId || settings.telegramNotifyChatId || settings.telegramChats?.[0]?.id || "",
  );
  const [busy, setBusy] = useState(false);
  const disabled = order.lines.length === 0;
  const wa = whatsappOrderUrl(
    client?.phone || "",
    `${invoiceTitle(order.number, order.createdAt)}\n${client?.name || ""}\n${priced.lines
      .map((line) => `${line.sku} × ${line.qty} = ${line.sum.toFixed(2)} ₽`)
      .join("\n")}\nИтого ${priced.totals.sell.toFixed(2)} ₽`,
  );

  async function download() {
    const response = await fetch(`/api/orders/${order.id}/invoice`);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Не собрать накладную");
    }
    const blob = await response.blob();
    const name =
      response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ||
      `order.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = decodeURIComponent(name);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Накладная ЗК · шаблон «Заказ клиента»</p>
      <p className="text-xs text-muted-foreground">
        Excel как в образце ЗК-500: шапка, позиции, итого и сумма прописью. Печать — из браузера, отправка —
        файл в Telegram или текст в WhatsApp.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled || busy}
          onClick={() =>
            void download()
              .then(() => toast.success("Excel скачан"))
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              )
          }
        >
          <FileSpreadsheet />
          Скачать Excel
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            const from = pathname.startsWith("/cart")
              ? `/cart?id=${order.id}`
              : `/orders/${order.id}`;
            router.push(`/orders/print/${order.id}?from=${encodeURIComponent(from)}`);
          }}
        >
          <Printer />
          Печать накладной
        </Button>
        <Button
          variant="outline"
          disabled={!wa}
          onClick={() => {
            if (wa) window.open(wa, "_blank", "noopener");
          }}
        >
          <MessageCircle />
          WhatsApp
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-1.5">
          <Label>Telegram Chat ID</Label>
          <Input
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            placeholder="число из чата с ботом"
            list={`chats-${order.id}`}
          />
          <datalist id={`chats-${order.id}`}>
            {settings.telegramChats?.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.title}
              </option>
            ))}
          </datalist>
        </label>
        <Button
          disabled={disabled || busy || !settings.telegramConfigured}
          onClick={() => {
            setBusy(true);
            void fetch(`/api/orders/${order.id}/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId }),
            })
              .then(async (response) => {
                const data = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(data.error || "Не отправить");
                toast.success("Накладная ушла в Telegram");
                await refresh();
              })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Send />
          В Telegram
        </Button>
      </div>
      {!settings.telegramConfigured ? (
        <p className="text-xs text-muted-foreground">
          Чтобы слать файл, откройте «Telegram-бот» и вставьте токен. Chat ID появится, когда клиент напишет
          боту.
        </p>
      ) : null}
      {!wa && client ? (
        <p className="text-xs text-muted-foreground">
          Для WhatsApp укажите телефон в карточке клиента.
        </p>
      ) : null}
    </div>
  );
}
