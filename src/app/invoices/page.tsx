"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatMoney } from "@/lib/format";
import { priceOrder } from "@/lib/order-price";
import { emptyPurchase, emptyPurchaseLine } from "@/lib/warehouse";
import type { Order, PurchaseLine, PurchaseOrder } from "@/lib/types";

export default function InvoicesPage() {
  return (
    <RoleGate allow={["admin", "organization", "manager"]}>
      <InvoicesInner />
    </RoleGate>
  );
}

function InvoicesInner() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const {
    ready,
    orders,
    clients,
    suppliers,
    settings,
    purchases,
    upsertPurchase,
    removePurchase,
    postPurchase,
    unpostPurchase,
  } = useAvtoPrice();
  const [supplierFilter, setSupplierFilter] = useState("");
  const [tab, setTab] = useState(admin ? "zk" : "sales");
  const [draft, setDraft] = useState<PurchaseOrder | null>(null);

  const sales = useMemo(() => {
    const posted = orders.filter((order) => order.status === "assembled" || order.status === "sent");
    if (admin) return posted.filter((order) => !order.organizationId);
    return posted.filter((order) => order.organizationId === user?.organizationId);
  }, [orders, admin, user?.organizationId]);

  const adminPurchases = useMemo(() => {
    const list = purchases.filter((item) => !item.organizationId);
    if (!supplierFilter) return list;
    return list.filter((item) => item.supplierId === supplierFilter);
  }, [purchases, supplierFilter]);

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю накладные…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Накладные</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {admin
            ? "Журнал администратора: заказы клиентов ЗК и плановые закупки у поставщиков ЗП. Книга организаций сюда не попадает."
            : "Ваша книга продаж своим клиентам. Нумерация ЗК своя, отдельно от журнала администратора."}
        </p>
      </div>

      {admin ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="flex-wrap justify-start">
            <TabsTrigger value="zk">Заказы клиентов ЗК</TabsTrigger>
            <TabsTrigger value="zp">Закупки ЗП</TabsTrigger>
          </TabsList>
          <TabsContent value="zk" className="mt-4">
            <SalesTable orders={sales} clients={clients} settingsBands={settings.priceBands} markup={settings.markupPercent} />
          </TabsContent>
          <TabsContent value="zp" className="mt-4">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-muted-foreground">У кого что планирую заказать</span>
                <select
                  className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                  value={supplierFilter}
                  onChange={(event) => setSupplierFilter(event.target.value)}
                >
                  <option value="">Все поставщики</option>
                  {suppliers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                onClick={() =>
                  setDraft(
                    emptyPurchase(purchases, suppliers[0]?.id ?? "", user?.id ?? "", undefined),
                  )
                }
              >
                <Plus />
                Новая ЗП
              </Button>
            </div>
            {adminPurchases.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
                Плановых закупок нет. Создайте ЗП-0001 — после проведения приход попадёт на свой склад.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Номер</th>
                      <th className="px-3 py-2 font-medium">Поставщик</th>
                      <th className="px-3 py-2 font-medium">Статус</th>
                      <th className="px-3 py-2 text-right font-medium">Позиции</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {adminPurchases.map((item) => {
                      const supplier = suppliers.find((entry) => entry.id === item.supplierId);
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{item.number}</td>
                          <td className="px-3 py-2">{supplier?.name || "—"}</td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary">
                              {item.status === "posted" ? "проведена" : "черновик"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">{item.lines.length}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => setDraft(item)}>
                                Открыть
                              </Button>
                              {item.status === "draft" ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    void postPurchase(item.id)
                                      .then(() => toast.success(`${item.number} проведена · приход на склад`))
                                      .catch((error: unknown) =>
                                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                                      )
                                  }
                                >
                                  Провести
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void unpostPurchase(item.id)
                                      .then(() => toast.success("Проведение отменено"))
                                      .catch((error: unknown) =>
                                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                                      )
                                  }
                                >
                                  Отменить
                                </Button>
                              )}
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Удалить ${item.number}?`)) {
                                    void removePurchase(item.id)
                                      .then(() => toast.success("Удалено"))
                                      .catch((error: unknown) =>
                                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                                      );
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
          </TabsContent>
        </Tabs>
      ) : (
        <SalesTable orders={sales} clients={clients} settingsBands={settings.priceBands} markup={settings.markupPercent} />
      )}

      {draft ? (
        <Card>
          <CardHeader>
            <CardTitle>{draft.number}</CardTitle>
            <CardDescription>
              Плановая закупка у поставщика. Проведение увеличивает остаток на своём складе, не в
              каталоге API.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1.5">
              <Label>Поставщик</Label>
              <select
                className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                value={draft.supplierId}
                onChange={(event) => setDraft({ ...draft, supplierId: event.target.value })}
              >
                {suppliers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2">
              {draft.lines.map((line, index) => (
                <PurchaseLineRow
                  key={line.id}
                  line={line}
                  onChange={(next) =>
                    setDraft({
                      ...draft,
                      lines: draft.lines.map((item, i) => (i === index ? next : item)),
                    })
                  }
                  onRemove={() =>
                    setDraft({ ...draft, lines: draft.lines.filter((item) => item.id !== line.id) })
                  }
                />
              ))}
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => setDraft({ ...draft, lines: [...draft.lines, emptyPurchaseLine()] })}
              >
                <Plus />
                Строка
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void upsertPurchase(draft).then(() => {
                    toast.success("ЗП сохранена");
                    setDraft(null);
                  })
                }
              >
                Сохранить черновик
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Закрыть
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SalesTable({
  orders,
  clients,
  settingsBands,
  markup,
}: {
  orders: Order[];
  clients: ReturnType<typeof useAvtoPrice>["clients"];
  settingsBands: ReturnType<typeof useAvtoPrice>["settings"]["priceBands"];
  markup: number;
}) {
  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        Продаж в этой книге нет.
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
            <th className="px-3 py-2 text-right font-medium">Сумма</th>
            <th className="hidden px-3 py-2 md:table-cell">Дата</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const client = clients.find((item) => item.id === order.clientId);
            const priced = priceOrder(order, client, settingsBands, order.markupPercent || markup);
            return (
              <tr key={order.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/orders/${order.id}`} className="hover:underline">
                    {order.number}
                  </Link>
                </td>
                <td className="px-3 py-2">{client?.name || "без клиента"}</td>
                <td className="px-3 py-2 text-right">{formatMoney(priced.totals.sell)}</td>
                <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                  {formatDateTime(order.updatedAt)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link href={`/orders/print/${order.id}`} className="text-sm hover:underline">
                    Печать
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PurchaseLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: PurchaseLine;
  onChange: (line: PurchaseLine) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_5rem_8rem_auto]">
      <Input
        placeholder="Артикул"
        value={line.sku}
        onChange={(event) => onChange({ ...line, sku: event.target.value })}
      />
      <Input
        placeholder="Бренд"
        value={line.brand}
        onChange={(event) => onChange({ ...line, brand: event.target.value })}
      />
      <Input
        type="number"
        min={1}
        value={line.qty}
        onChange={(event) => onChange({ ...line, qty: Math.max(1, Number(event.target.value) || 1) })}
      />
      <Input
        placeholder="Склад"
        value={line.warehouse}
        onChange={(event) => onChange({ ...line, warehouse: event.target.value })}
      />
      <Button size="icon-sm" variant="ghost" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}
