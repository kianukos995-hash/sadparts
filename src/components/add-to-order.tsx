"use client";

import { ShoppingCart, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import type { Offer } from "@/lib/types";
import type { MouseEvent } from "react";

export function AddToOrderButtons({
  offer,
  compact,
  clientId,
}: {
  offer: Offer;
  compact?: boolean;
  clientId?: string;
}) {
  const { addToDraft, draft, clients } = useAvtoPrice();
  const client = clients.find((item) => item.id === clientId);
  const label = client
    ? compact
      ? "В заказ"
      : `В ${client.name}`
    : compact
      ? "В заказ"
      : draft
        ? `В ${draft.number}`
        : "В заказ";

  async function intoCurrent() {
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), {
      clientId: clientId || undefined,
    });
    toast.success(`${offer.sku} → ${next.number}`);
  }

  async function intoNew() {
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), {
      newOrder: true,
      clientId: clientId || undefined,
    });
    toast.success(`Новый заказ ${next.number}`);
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
) {
  return async (event: MouseEvent) => {
    event.preventDefault();
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), {
      newOrder: true,
      clientId: clientId || undefined,
    });
    toast.success(`ПКМ: ${offer.sku} в ${next.number}`);
  };
}

type AvtoAdd = ReturnType<typeof useAvtoPrice>["addToDraft"];
