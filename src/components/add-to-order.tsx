"use client";

import { ShoppingCart, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { availableStock } from "@/lib/stock";
import type { Offer } from "@/lib/types";
import type { MouseEvent } from "react";

export function AddToOrderButtons({
  offer,
  compact,
  clientId,
  orderId,
}: {
  offer: Offer;
  compact?: boolean;
  clientId?: string;
  orderId?: string;
}) {
  const { addToDraft, draft, clients, orders } = useAvtoPrice();
  const client = clients.find((item) => item.id === clientId);
  const target = orderId ? orders.find((item) => item.id === orderId) : null;
  const label = target
    ? `В ${target.number}`
    : client
      ? compact
        ? "В корзину"
        : `В ${client.name}`
      : compact
        ? "В корзину"
        : draft
          ? `В ${draft.number}`
          : "В корзину";

  async function intoCurrent() {
    const qty = Math.max(1, offer.multiplicity || 1);
    const free = availableStock(offer, orders);
    if (qty > free) {
      toast.warning(
        `Свободно ${free} шт. (прайс ${offer.stock}). Кладём ${qty} — остаток в учёте уйдёт в минус.`,
      );
    }
    const next = await addToDraft(offer, qty, {
      clientId: clientId || undefined,
      orderId: orderId || undefined,
    });
    toast.success(`${offer.sku} → ${next.number}`);
  }

  async function intoNew() {
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), {
      newOrder: true,
      clientId: clientId || undefined,
    });
    toast.success(`Новая корзина ${next.number}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => void intoCurrent()}>
        <ShoppingCart />
        {label}
      </Button>
      <Button size="sm" variant="ghost" title="Новая корзина" onClick={() => void intoNew()}>
        <ListPlus />
        {compact ? "" : "Новая корзина"}
      </Button>
    </div>
  );
}

export function offerContextAdd(
  offer: Offer,
  addToDraft: AvtoAdd,
  clientId?: string,
  orderId?: string,
) {
  return async (event: MouseEvent) => {
    event.preventDefault();
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), {
      newOrder: !orderId,
      orderId: orderId || undefined,
      clientId: clientId || undefined,
    });
    toast.success(`ПКМ: ${offer.sku} в ${next.number}`);
  };
}

type AvtoAdd = ReturnType<typeof useAvtoPrice>["addToDraft"];
