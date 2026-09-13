"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderShareBar } from "@/components/order-share";
import { PriceFormula } from "@/components/price-formula";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDays, formatMoney } from "@/lib/format";
import { copyClientVehicle } from "@/lib/order";
import { clientLineTotal, clientPriceBreakdown } from "@/lib/pricing";
import { priceOrder } from "@/lib/order-price";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

export function OrderEditor({
  order,
  onClose,
  onAssembled,
  onDeleted,
  onReturnedToCart,
  listHref,
}: {
  order: Order;
  onClose?: () => void;
  onAssembled?: (order: Order) => void;
  onDeleted?: () => void;
  onReturnedToCart?: (order: Order) => void;
  listHref?: string;
}) {
  const { suppliers, clients, settings, upsertOrder, removeOrder } = useAvtoPrice();
  const [markupOverride, setMarkupOverride] = useState("");
  const client = clients.find((item) => item.id === order.clientId);
  const useBands = markupOverride.trim() === "";
  const markup = useBands ? null : Number.parseFloat(markupOverride.replace(",", ".")) || 0;
  const names = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );
  const priced = useMemo(
    () => priceOrder(order, client, settings.priceBands, settings.markupPercent, markup),
    [order, client, settings.priceBands, settings.markupPercent, markup],
  );

  async function persist(next: Order) {
    await upsertOrder({
      ...next,
      markupPercent: markup ?? next.markupPercent ?? settings.markupPercent,
      updatedAt: new Date().toISOString(),
    });
  }

  const title =
    order.status === "draft" ? `Черновик ${order.number}` : `Заказ ${order.number}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          {settings.moscowHubNote || "Срок в строке — дни до Москвы от поставщика."}
          {listHref ? (
            <Link href={listHref} className="text-foreground underline-offset-4 hover:underline">
              К списку
            </Link>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5">
            <Label>Клиент</Label>
            <select
              className="h-9 rounded-lg border bg-transparent px-3 text-sm"
              value={order.clientId}
              onChange={(event) => {
                const id = event.target.value;
                const nextClient = clients.find((item) => item.id === id);
                void persist({
                  ...order,
                  clientId: id,
                  ...copyClientVehicle(nextClient),
                });
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
              placeholder="по коридорам"
              value={markupOverride}
              onChange={(event) => setMarkupOverride(event.target.value)}
              onBlur={() => {
                if (!useBands) void persist({ ...order, markupPercent: markup ?? 0 });
              }}
            />
          </label>
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">Скидка клиента</p>
            <p className="text-lg font-semibold">{client?.discountPercent ?? 0}%</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field
            label="Автомобиль"
            value={order.car ?? ""}
            onChange={(car) => void persist({ ...order, car })}
          />
          <Field
            label="VIN"
            value={order.vin ?? ""}
            onChange={(vin) => void persist({ ...order, vin })}
          />
          <Field
            label="Госномер"
            value={order.plate ?? ""}
            onChange={(plate) => void persist({ ...order, plate })}
          />
          <Field
            label="Год"
            value={order.year ?? ""}
            onChange={(year) => void persist({ ...order, year })}
          />
          <Field
            label="Цвет"
            value={order.color ?? ""}
            onChange={(color) => void persist({ ...order, color })}
          />
        </div>

        {order.lines.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Позиций нет. Откройте проценку и нажмите «В заказ».
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
              {order.lines.map((line) => {
                const breakdown = clientPriceBreakdown(
                  line.buyPrice,
                  settings.priceBands,
                  settings.markupPercent,
                  client,
                  markup,
                );
                return (
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
                            ...order,
                            lines: order.lines.map((item) =>
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
                      {formatMoney(breakdown.sell, line.currency)}
                      <PriceFormula breakdown={breakdown} currency={line.currency} compact />
                      <p className="text-[11px] font-normal text-muted-foreground">
                        × {line.qty} ={" "}
                        {formatMoney(
                          clientLineTotal(
                            line.buyPrice,
                            line.qty,
                            settings.priceBands,
                            settings.markupPercent,
                            client,
                            markup,
                          ),
                          line.currency,
                        )}
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
                            ...order,
                            lines: order.lines.filter((item) => item.id !== line.id),
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <label className="grid gap-1.5">
          <Label>Комментарий</Label>
          <Textarea
            rows={2}
            value={order.comment}
            onChange={(event) => {
              void persist({ ...order, comment: event.target.value });
            }}
          />
        </label>

        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {priced.totals.qty} шт. · закуп {formatMoney(priced.totals.buy)} + наценка{" "}
              {formatMoney(priced.totals.markup)} − скидка {formatMoney(priced.totals.discount)}
            </p>
            <p className="text-xl font-semibold">Клиенту {formatMoney(priced.totals.sell)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/quote?orderId=${order.id}${order.clientId ? `&clientId=${order.clientId}` : ""}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Search />
              Добавить из проценки
            </Link>
            {order.status === "draft" ? (
              <>
                <Button
                  variant="outline"
                  disabled={order.lines.length === 0}
                  onClick={() => {
                    void persist({ ...order, lines: [] }).then(() => toast.success("Корзина очищена"));
                  }}
                >
                  Очистить
                </Button>
                <Button
                  disabled={order.lines.length === 0}
                  onClick={() => {
                    void persist({ ...order, status: "assembled" }).then(() => {
                      toast.success(`Заказ ${order.number} собран · остаток списан`);
                      onAssembled?.({ ...order, status: "assembled" });
                    });
                  }}
                >
                  Собрать заказ
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    void persist({ ...order, status: "draft" }).then(() => {
                      toast.success(`${order.number} снова в корзине · остаток возвращён`);
                      onReturnedToCart?.({ ...order, status: "draft" });
                    });
                  }}
                >
                  Вернуть в корзину
                </Button>
                {onClose ? (
                  <Button variant="outline" onClick={onClose}>
                    Закрыть
                  </Button>
                ) : null}
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                if (!confirm(`Удалить ${order.number}?`)) return;
                void removeOrder(order.id).then(() => {
                  toast.success("Удалено");
                  onDeleted?.();
                });
              }}
            >
              <Trash2 />
              Удалить
            </Button>
          </div>
        </div>
        <OrderShareBar order={order} />
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
