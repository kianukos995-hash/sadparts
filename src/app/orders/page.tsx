"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { findDraft } from "@/lib/order";
import { formatDays, formatMoney } from "@/lib/format";
import { lineTotal, sellUnitPrice } from "@/lib/pricing";
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
    suppliers,
    clients,
    orders,
    settings,
    upsertOrder,
    removeOrder,
  } = useAvtoPrice();
  const [markupOverride, setMarkupOverride] = useState<string | null>(null);

  const storedDraft = findDraft(orders);

  const client = clients.find((item) => item.id === storedDraft?.clientId);
  const discount = client?.discountPercent ?? 0;
  const markup =
    markupOverride === null
      ? (storedDraft?.markupPercent ?? settings.markupPercent)
      : Number.parseFloat(markupOverride.replace(",", ".")) || 0;
  const names = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );

  const totals = useMemo(() => {
    if (!storedDraft) return { buy: 0, sell: 0, qty: 0 };
    return storedDraft.lines.reduce(
      (acc, line) => ({
        buy: acc.buy + line.buyPrice * line.qty,
        sell: acc.sell + lineTotal(line.buyPrice, line.qty, markup, discount),
        qty: acc.qty + line.qty,
      }),
      { buy: 0, sell: 0, qty: 0 },
    );
  }, [storedDraft, markup, discount]);

  async function persist(next: Order) {
    await upsertOrder({ ...next, markupPercent: markup, updatedAt: new Date().toISOString() });
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю заказы…</p>;

  const draft = storedDraft;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          OEM, артикул, срок до Москвы, количество, наценка склада и скидка клиента.
        </p>
      </div>

      {draft ? (
      <Card>
        <CardHeader>
          <CardTitle>Черновик {draft.number}</CardTitle>
          <CardDescription>
            {settings.moscowHubNote || "Срок в строке — дни до Москвы от поставщика."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5">
              <Label>Клиент</Label>
              <select
                className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                value={draft.clientId}
                onChange={(event) => {
                  void persist({ ...draft, clientId: event.target.value });
                }}
              >
                <option value="">Без клиента</option>
                {clients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · скидка {item.discountPercent}%
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <Label>Наценка, %</Label>
              <Input
                type="number"
                min={0}
                value={markupOverride ?? String(draft.markupPercent)}
                onChange={(event) => setMarkupOverride(event.target.value)}
                onBlur={() => {
                  void persist({ ...draft, markupPercent: markup });
                }}
              />
            </label>
            <div className="grid gap-1 text-sm">
              <p className="text-muted-foreground">Скидка клиента</p>
              <p className="text-lg font-semibold">{discount}%</p>
            </div>
          </div>

          {draft.lines.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              Позиций нет. Откройте каталог и нажмите «В заказ».
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Артикул</TableHead>
                  <TableHead className="hidden md:table-cell">OEM</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Закуп</TableHead>
                  <TableHead className="text-right">Клиенту</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">До Москвы</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-mono text-xs">{line.sku}</p>
                      <p className="text-sm">
                        {line.brand} · {line.name}
                      </p>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {line.oem || "—"}
                    </TableCell>
                    <TableCell>{names.get(line.supplierId) ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="ml-auto h-8 w-20 text-right"
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(event) => {
                          const qty = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
                          void persist({
                            ...draft,
                            lines: draft.lines.map((item) =>
                              item.id === line.id ? { ...item, qty } : item,
                            ),
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {formatMoney(line.buyPrice, line.currency)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(
                        sellUnitPrice(line.buyPrice, markup, discount),
                        line.currency,
                      )}
                      <p className="text-[11px] font-normal text-muted-foreground">
                        × {line.qty} ={" "}
                        {formatMoney(lineTotal(line.buyPrice, line.qty, markup, discount), line.currency)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      {formatDays(line.deliveryDays)}
                      {line.warehouse ? (
                        <p className="text-[11px] text-muted-foreground">{line.warehouse}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          void persist({
                            ...draft,
                            lines: draft.lines.filter((item) => item.id !== line.id),
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <label className="grid gap-1.5">
            <Label>Комментарий</Label>
            <Textarea
              rows={2}
              value={draft.comment}
              onChange={(event) => {
                void persist({ ...draft, comment: event.target.value });
              }}
            />
          </label>

          <div className="flex flex-col gap-3 rounded-lg bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {totals.qty} шт. · закуп {formatMoney(totals.buy)}
              </p>
              <p className="text-xl font-semibold">Клиенту {formatMoney(totals.sell)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={draft.lines.length === 0}
                onClick={() => {
                  void persist({ ...draft, lines: [] }).then(() => toast.success("Черновик очищен"));
                }}
              >
                Очистить
              </Button>
              <Button
                disabled={draft.lines.length === 0}
                onClick={() => {
                  void persist({ ...draft, status: "assembled" }).then(() =>
                    toast.success(`Заказ ${draft.number} собран`),
                  );
                }}
              >
                Собрать заказ
              </Button>
            </div>
          </div>
          <RosskoCheckout order={draft} />
        </CardContent>
      </Card>
      ) : (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 py-10">
          <p className="text-sm text-muted-foreground">
            Черновика нет. Добавьте позиции из каталога — OEM, артикул, срок до Москвы и цена
            подтянутся сами.
          </p>
          <Link href="/catalog" className={cn(buttonVariants())}>
            Открыть каталог
          </Link>
        </CardContent>
      </Card>
      )}

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
                const orderDiscount = orderClient?.discountPercent ?? 0;
                const sell = order.lines.reduce(
                  (sum, line) =>
                    sum + lineTotal(line.buyPrice, line.qty, order.markupPercent, orderDiscount),
                  0,
                );
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-1 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {order.number} · {orderClient?.name || "без клиента"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.lines.length} поз. · наценка {order.markupPercent}% · скидка{" "}
                        {orderDiscount}%
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
                      <span className="text-sm font-medium">{formatMoney(sell)}</span>
                      {order.status === "assembled" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void persist({ ...order, status: "sent" }).then(() =>
                              toast.success("Отмечен как отправленный"),
                            )
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
          <Label>Доставка</Label>
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
          <Label>Оплата</Label>
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
