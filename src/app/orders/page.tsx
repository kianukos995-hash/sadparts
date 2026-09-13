"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderEditor } from "@/components/order-editor";
import { OrderShareBar } from "@/components/order-share";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatMoney } from "@/lib/format";
import { emptyDraft } from "@/lib/order";
import { priceOrder } from "@/lib/order-price";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "черновик",
  assembled: "собран",
  sent: "отправлен",
};

export default function OrdersPage() {
  const {
    ready,
    clients,
    orders,
    drafts,
    draft,
    setActiveDraftId,
    settings,
    upsertOrder,
    removeOrder,
  } = useAvtoPrice();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = orders.find((item) => item.id === editingId && item.status !== "draft") ?? null;

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю заказы…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Нумерация ЗК-0001. Черновики делятся по клиентам в проценке. Накладная — Excel по шаблону
            «Заказ клиента», печать и отправка в Telegram / WhatsApp.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const created = emptyDraft(orders, clients, settings.markupPercent, draft?.clientId);
            void upsertOrder(created).then(() => {
              setActiveDraftId(created.id);
              toast.success(created.number);
            });
          }}
        >
          Новая корзина
        </Button>
      </div>

      {drafts.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {drafts.map((item) => {
            const name = clients.find((client) => client.id === item.clientId)?.name;
            return (
              <Button
                key={item.id}
                size="sm"
                variant={item.id === draft?.id ? "default" : "outline"}
                onClick={() => setActiveDraftId(item.id)}
              >
                {item.number} · {name || "без клиента"} · {item.lines.length} поз.
              </Button>
            );
          })}
        </div>
      ) : null}

      {draft ? (
        <OrderEditor order={draft} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="text-sm text-muted-foreground">
              Черновика нет. Добавьте позиции из проценки — появится заказ ЗК-0001.
            </p>
            <Link href="/quote" className={cn(buttonVariants())}>
              Открыть проценку
            </Link>
          </CardContent>
        </Card>
      )}

      {draft ? <RosskoCheckout order={draft} /> : null}

      {editing ? (
        <OrderEditor order={editing} onClose={() => setEditingId(null)} />
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-medium">История</h2>
        {orders.filter((order) => order.status !== "draft").length === 0 ? (
          <p className="text-sm text-muted-foreground">Собранных заказов пока нет.</p>
        ) : (
          <div className="grid gap-2">
            {orders
              .filter((order) => order.status !== "draft")
              .map((order) => {
                const orderClient = clients.find((item) => item.id === order.clientId);
                const priced = priceOrder(
                  order,
                  orderClient,
                  settings.priceBands,
                  order.markupPercent || settings.markupPercent,
                );
                return (
                  <div key={order.id} className="grid gap-2 rounded-lg border px-3 py-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {order.number} · {orderClient?.name || "без клиента"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.lines.length} поз. · скидка {orderClient?.discountPercent ?? 0}%
                          {order.car ? ` · ${order.car}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
                        <span className="text-sm font-medium">{formatMoney(priced.totals.sell)}</span>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(order.id)}>
                          <Pencil />
                          Изменить
                        </Button>
                        {order.status === "assembled" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void upsertOrder({
                                ...order,
                                status: "sent",
                                updatedAt: new Date().toISOString(),
                              }).then(() => toast.success("Отмечен как отправленный"))
                            }
                          >
                            Отправлен
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            if (confirm(`Удалить ${order.number}?`)) void removeOrder(order.id);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    {editingId === order.id ? null : <OrderShareBar order={order} />}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

function RosskoCheckout({ order }: { order: Order }) {
  const { suppliers, clients, refresh } = useAvtoPrice();
  const supplier = suppliers.find((item) => item.adapter === "rossko" || item.code === "ROSSKO");
  const lines = order.lines.filter((line) => line.supplierId === supplier?.id);
  const client = clients.find((item) => item.id === order.clientId);
  const [deliveryId, setDeliveryId] = useState(supplier?.rosskoDeliveryId ?? "");
  const [paymentId, setPaymentId] = useState("1");
  const [deliveries, setDeliveries] = useState<{ id: string; name: string }[]>([]);
  const [payments, setPayments] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  if (!supplier || lines.length === 0) return null;
  const rossko = supplier;

  async function loadDetails() {
    setBusy(true);
    try {
      const response = await fetch("/api/rossko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "details", supplierId: rossko.id }),
      });
      const data = (await response.json()) as {
        error?: string;
        details?: { deliveries: { id: string; name: string }[]; payments: { id: number; name: string }[] };
        supplier?: { rosskoDeliveryId?: string };
      };
      if (!response.ok) throw new Error(data.error || "GetCheckoutDetails не удался");
      setDeliveries(data.details?.deliveries ?? []);
      setPayments(data.details?.payments ?? []);
      setDeliveryId(data.supplier?.rosskoDeliveryId || data.details?.deliveries[0]?.id || "");
      toast.success("Способы доставки Росско получены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const response = await fetch("/api/rossko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          supplierId: rossko.id,
          orderId: order.id,
          deliveryId,
          paymentId: Number(paymentId),
          contactName: client?.name || "Менеджер",
          contactPhone: client?.phone || "+7",
          comment: order.comment,
          deliveryParts: true,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        result?: { success: boolean; message?: string; orderIds: string[]; errors: { message: string }[] };
      };
      if (!response.ok) throw new Error(data.error || "GetCheckout не удался");
      await refresh();
      if (data.result?.success) {
        toast.success(`Росско заказ ${data.result.orderIds.join(", ")}`);
      } else {
        toast.error(data.result?.message || data.result?.errors.map((item) => item.message).join("; "));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Отправка в Росско · GetCheckout</p>
      <p className="text-xs text-muted-foreground">
        {lines.length} поз. Росско. Сначала GetCheckoutDetails (доставка/оплата), затем оформление.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          Доставка
          <select
            className="h-9 rounded-lg border bg-transparent px-3 text-sm"
            value={deliveryId}
            onChange={(event) => setDeliveryId(event.target.value)}
          >
            {deliveries.length === 0 ? <option value={deliveryId}>{deliveryId || "загрузить список"}</option> : null}
            {deliveries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          Оплата
          <select
            className="h-9 rounded-lg border bg-transparent px-3 text-sm"
            value={paymentId}
            onChange={(event) => setPaymentId(event.target.value)}
          >
            {payments.length === 0 ? <option value="1">Безналичный</option> : null}
            {payments.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void loadDetails()}>
          GetCheckoutDetails
        </Button>
        <Button disabled={busy || lines.length === 0} onClick={() => void send()}>
          GetCheckout
        </Button>
      </div>
      {order.externalIds?.length ? (
        <p className="text-xs text-muted-foreground">Номера Росско: {order.externalIds.join(", ")}</p>
      ) : null}
    </div>
  );
}
