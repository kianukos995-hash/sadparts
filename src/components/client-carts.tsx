"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { emptyDraft } from "@/lib/order";
import type { Client } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClientCartBar({
  clientId,
  onClientId,
  onSelectDraft,
}: {
  clientId: string;
  onClientId: (id: string) => void;
  onSelectDraft?: (id: string) => void;
}) {
  const { clients, drafts, draft, orders, setActiveDraftId, upsertOrder, settings } = useAvtoPrice();
  const { user } = useAuth();

  async function newCart(client?: Client) {
    const created = emptyDraft(
      orders,
      clients,
      settings.markupPercent,
      client?.id || clientId || "",
      { organizationId: user?.organizationId, createdByUserId: user?.id },
    );
    await upsertOrder(created);
    setActiveDraftId(created.id);
    onSelectDraft?.(created.id);
    if (created.clientId) onClientId(created.clientId);
    toast.success(`Корзина ${created.number}${client ? ` · ${client.name}` : ""}`);
  }

  return (
    <div className="grid gap-2 rounded-xl border bg-muted/20 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Корзины по клиентам</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void newCart(clients.find((item) => item.id === clientId))}>
            Новая корзина
          </Button>
          <Link href="/cart" className="text-sm text-muted-foreground hover:underline">
            К корзине
          </Link>
          <Link href="/orders" className="text-sm text-muted-foreground hover:underline">
            К заказам
          </Link>
        </div>
      </div>
      {drafts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Выберите клиента и нажмите «В заказ» — появится отдельная корзина с номером ЗК-0001.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {drafts.map((item) => {
            const client = clients.find((entry) => entry.id === item.clientId);
            const active = item.id === draft?.id;
            return (
              <Button
                key={item.id}
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn(!active && item.clientId === clientId && "border-amber-500")}
                onClick={() => {
                  setActiveDraftId(item.id);
                  onSelectDraft?.(item.id);
                  onClientId(item.clientId);
                }}
              >
                {item.number}
                {client ? ` · ${client.name}` : " · без клиента"} · {item.lines.length} поз.
              </Button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Смена клиента переключает его корзину. ПКМ в проценке — меню (в текущую корзину / количество /
        карточка), а не новый заказ.
      </p>
    </div>
  );
}
