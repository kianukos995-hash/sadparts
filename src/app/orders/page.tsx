"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useViewerPricing } from "@/hooks/use-viewer-pricing";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { emptyDraft } from "@/lib/order";
import { priceOrder } from "@/lib/order-price";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "черновик",
  assembled: "проведён",
  sent: "отправлен",
};

type OrdersTab = "drafts" | "posted" | "paid";

export default function OrdersPage() {
  const router = useRouter();
  const { ready, clients, orders, settings, upsertOrder, removeOrder } = useAvtoPrice();
  const { user } = useAuth();
  const viewer = useViewerPricing();
  const [tab, setTab] = useState<OrdersTab>("posted");

  const groups = useMemo(() => {
    const drafts = orders.filter((order) => order.status === "draft");
    const posted = orders.filter((order) => order.status === "assembled" || order.status === "sent");
    const paid = orders.filter((order) => (order.paidAmount ?? 0) > 0);
    return { drafts, posted, paid };
  }, [orders]);

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю заказы…</p>;

  function table(list: Order[], empty: string) {
    if (list.length === 0) {
      return (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      );
    }
    return (
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
                viewer.bands.length ? viewer.bands : settings.priceBands,
                order.markupPercent || settings.markupPercent,
              );
              const href = order.status === "draft" ? `/cart?id=${order.id}` : `/orders/${order.id}`;
              return (
                <tr key={order.id} className="border-t">
                  <td className="px-3 py-2 font-medium">
                    <Link href={href} className="hover:underline">
                      {order.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{client?.name || "без клиента"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">
                      {(order.paidAmount ?? 0) > 0 && order.status !== "draft"
                        ? "оплачен"
                        : STATUS_LABEL[order.status]}
                    </Badge>
                  </td>
                  <td className="hidden px-3 py-2 text-right sm:table-cell">
                    {formatMoney(priced.totals.sell)}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                    {formatDateTime(order.updatedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => router.push(href)}>
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
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Черновики живут в корзине. Проведённые — после «Провести заказ». Оплаченные — если в
            «Деньги» есть приход, привязанный к заказу.
          </p>
        </div>
        <Button
          onClick={() => {
            const created = emptyDraft(
              orders,
              clients,
              settings.markupPercent,
              user?.clientId,
              { organizationId: user?.organizationId, createdByUserId: user?.id },
            );
            void upsertOrder(created).then(() => {
              toast.success(created.number);
              router.push(`/cart?id=${created.id}`);
            });
          }}
        >
          <Plus />
          Новый заказ
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab((value as OrdersTab) || "posted")}>
        <TabsList variant="line" className="w-full max-w-full flex-wrap justify-start">
          <TabsTrigger value="drafts">Черновики ({groups.drafts.length})</TabsTrigger>
          <TabsTrigger value="posted">Проведённые ({groups.posted.length})</TabsTrigger>
          <TabsTrigger value="paid">Оплаченные ({groups.paid.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="drafts" className="mt-4">
          {table(groups.drafts, "Черновиков нет. Соберите корзину в проценке.")}
        </TabsContent>
        <TabsContent value="posted" className="mt-4">
          {table(groups.posted, "Проведённых заказов нет. Проведите черновик из корзины.")}
        </TabsContent>
        <TabsContent value="paid" className="mt-4">
          {table(groups.paid, "Оплаченных заказов нет. Приход в «Деньги» привяжите к заказу.")}
        </TabsContent>
      </Tabs>
    </div>
  );
}
