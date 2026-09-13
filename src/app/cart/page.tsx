"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderEditor } from "@/components/order-editor";
import { RosskoCheckout } from "@/components/rossko-checkout";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatMoney } from "@/lib/format";
import { emptyDraft } from "@/lib/order";
import { priceOrder } from "@/lib/order-price";
import { cn } from "@/lib/utils";

function CartPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const {
    ready,
    clients,
    drafts,
    draft,
    orders,
    setActiveDraftId,
    settings,
    upsertOrder,
    removeOrder,
  } = useAvtoPrice();
  const selectedId = params.get("id") || draft?.id || "";
  const selected = drafts.find((item) => item.id === selectedId) ?? draft;

  useEffect(() => {
    const id = params.get("id");
    if (id && drafts.some((item) => item.id === id)) setActiveDraftId(id);
  }, [params, drafts, setActiveDraftId]);

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю корзину…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Корзина</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Сюда падают позиции из проценки. У каждого клиента своя корзина. Собранное уходит в список
            заказов.
          </p>
        </div>
        <Button
          onClick={() => {
            const created = emptyDraft(orders, clients, settings.markupPercent, selected?.clientId);
            void upsertOrder(created).then(() => {
              setActiveDraftId(created.id);
              router.push(`/cart?id=${created.id}`);
              toast.success(created.number);
            });
          }}
        >
          <Plus />
          Новая корзина
        </Button>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="text-sm text-muted-foreground">
              Корзина пуста. Откройте проценку, выберите клиента и нажмите «В заказ».
            </p>
            <Link href="/quote" className={cn(buttonVariants())}>
              Открыть проценку
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Номер</th>
                <th className="px-3 py-2 font-medium">Клиент</th>
                <th className="px-3 py-2 text-right font-medium">Позиции</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Сумма</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {drafts.map((item) => {
                const client = clients.find((entry) => entry.id === item.clientId);
                const priced = priceOrder(
                  item,
                  client,
                  settings.priceBands,
                  settings.markupPercent,
                );
                const active = item.id === selected?.id;
                return (
                  <tr
                    key={item.id}
                    className={cn("border-t", active && "bg-amber-50/70")}
                  >
                    <td className="px-3 py-2 font-medium">{item.number}</td>
                    <td className="px-3 py-2">{client?.name || "без клиента"}</td>
                    <td className="px-3 py-2 text-right">{item.lines.length}</td>
                    <td className="hidden px-3 py-2 text-right sm:table-cell">
                      {formatMoney(priced.totals.sell)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => {
                            setActiveDraftId(item.id);
                            router.push(`/cart?id=${item.id}`);
                          }}
                        >
                          Открыть
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Удалить ${item.number}?`)) {
                              void removeOrder(item.id).then(() => toast.success("Удалено"));
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

      {selected ? (
        <>
          <OrderEditor
            order={selected}
            listHref="/cart"
            onAssembled={(next) => router.push(`/orders/${next.id}`)}
            onDeleted={() => router.push("/cart")}
          />
          <RosskoCheckout order={selected} />
        </>
      ) : null}
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загружаю корзину…</p>}>
      <CartPageInner />
    </Suspense>
  );
}
