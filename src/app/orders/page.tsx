"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDateTime, formatMoney } from "@/lib/format";
import { emptyDraft } from "@/lib/order";
import { priceOrder } from "@/lib/order-price";
import type { OrderStatus } from "@/lib/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "черновик",
  assembled: "собран",
  sent: "отправлен",
};

export default function OrdersPage() {
  const router = useRouter();
  const { ready, clients, orders, settings, upsertOrder, removeOrder } = useAvtoPrice();
  const list = orders.filter((order) => order.status !== "draft");

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю заказы…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Собранные ЗК. Черновики живут в корзине. Откройте заказ, чтобы править, печатать или
            добавить позиции из проценки.
          </p>
        </div>
        <Button
          onClick={() => {
            const created = emptyDraft(orders, clients, settings.markupPercent);
            void upsertOrder({ ...created, status: "assembled" }).then(() => {
              toast.success(created.number);
              router.push(`/orders/${created.id}`);
            });
          }}
        >
          <Plus />
          Новый заказ
        </Button>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          Заказов нет. Соберите корзину в проценке или нажмите «Новый заказ».
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Номер</th>
                <th className="px-3 py-2 font-medium">Клиент</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Сумма</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Дата</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((order) => {
                const client = clients.find((item) => item.id === order.clientId);
                const priced = priceOrder(
                  order,
                  client,
                  settings.priceBands,
                  order.markupPercent || settings.markupPercent,
                );
                return (
                  <tr key={order.id} className="border-t">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{client?.name || "без клиента"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
                    </td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell">
                      {formatMoney(priced.totals.sell)}
                    </td>
                    <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                      {formatDateTime(order.updatedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => router.push(`/orders/${order.id}`)}>
                          Открыть
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Удалить ${order.number}?`)) {
                              void removeOrder(order.id).then(() => toast.success("Удалено"));
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
