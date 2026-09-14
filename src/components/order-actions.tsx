"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, MessageCircle, Printer, Save, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { invoiceTitle } from "@/lib/money-words";
import { priceOrder } from "@/lib/order-price";
import { whatsappOrderUrl } from "@/lib/order";
import type { Order } from "@/lib/types";

function invoiceText(order: Order, clientName: string, lines: string[], total: string) {
  return `${invoiceTitle(order.number, order.createdAt)}\n${clientName}\n${lines.join("\n")}\nИтого ${total}`;
}

export function OrderActionsSidebar({
  order,
  onPosted,
  onSaved,
}: {
  order: Order;
  onPosted?: (order: Order) => void;
  onSaved?: (order: Order) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { clients, settings, upsertOrder, refresh } = useAvtoPrice();
  const client = clients.find((item) => item.id === order.clientId);
  const priced = priceOrder(
    order,
    client,
    settings.priceBands,
    order.markupPercent || settings.markupPercent,
  );
  const [chatId, setChatId] = useState(
    client?.telegramChatId || settings.telegramNotifyChatId || settings.telegramChats?.[0]?.id || "",
  );
  const [busy, setBusy] = useState(false);
  const disabled = order.lines.length === 0;
  const text = invoiceText(
    order,
    client?.name || "",
    priced.lines.map((line) => `${line.sku} × ${line.qty} = ${line.sum.toFixed(2)} ₽`),
    `${priced.totals.sell.toFixed(2)} ₽`,
  );
  const wa = whatsappOrderUrl(client?.phone || "", text);
  const posted = order.status !== "draft";

  async function persist(next: Order) {
    await upsertOrder({ ...next, updatedAt: new Date().toISOString() });
  }

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
    <aside className="grid gap-3 rounded-xl border bg-muted/20 p-4 xl:sticky xl:top-20">
      <p className="text-sm font-semibold">Документы и отправка</p>
      <div className="grid gap-2">
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => {
            setBusy(true);
            void persist({ ...order, status: posted ? order.status : "draft" })
              .then(() => {
                toast.success(`Заказ ${order.number} сохранён`);
                onSaved?.({ ...order, status: posted ? order.status : "draft" });
              })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Save />
          Сохранить заказ
        </Button>
        <Button
          disabled={disabled || busy || posted}
          onClick={() => {
            setBusy(true);
            void persist({ ...order, status: "assembled", postedAt: new Date().toISOString() })
              .then(() => {
                toast.success(`Заказ ${order.number} проведён`);
                onPosted?.({ ...order, status: "assembled" });
              })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              )
              .finally(() => setBusy(false));
          }}
        >
          Провести заказ
        </Button>
      </div>
      <div className="grid gap-2 border-t pt-3">
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
          disabled={disabled || busy}
          onClick={() =>
            void download()
              .then(() => toast.success("Накладная скачана"))
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              )
          }
        >
          <FileSpreadsheet />
          Скачать накладную
        </Button>
      </div>
      <div className="grid gap-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Отправить в</p>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => {
            void navigator.clipboard.writeText(text).then(
              () => {
                window.open("https://web.max.ru", "_blank", "noopener");
                toast.success("Текст накладной скопирован — вставьте в Макс");
              },
              () => toast.error("Не скопировать текст"),
            );
          }}
        >
          <Share2 />
          Макс
        </Button>
        <label className="grid gap-1.5">
          <Label>Telegram Chat ID</Label>
          <Input
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            placeholder="число из чата с ботом"
            list={`chats-side-${order.id}`}
          />
          <datalist id={`chats-side-${order.id}`}>
            {settings.telegramChats?.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.title}
              </option>
            ))}
          </datalist>
        </label>
        <Button
          variant="outline"
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
          Telegram
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
        {!settings.telegramConfigured ? (
          <p className="text-[11px] text-muted-foreground">
            Для Telegram откройте настройки бота и вставьте токен.
          </p>
        ) : null}
        {!wa && client ? (
          <p className="text-[11px] text-muted-foreground">
            Для WhatsApp укажите телефон в профиле или карточке клиента.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
