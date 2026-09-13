"use client";

import { ShoppingCart, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import type { Offer } from "@/lib/types";
import type { MouseEvent } from "react";

export function AddToOrderButtons({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const { addToDraft, draft } = useAvtoPrice();

  async function intoCurrent() {
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1));
    toast.success(`${offer.sku} → черновик ${next.number}`);
  }

  async function intoNew() {
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), { newOrder: true });
    toast.success(`Новый заказ ${next.number}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant="outline" onClick={() => void intoCurrent()}>
        <ShoppingCart />
        {compact ? "В заказ" : draft ? `В ${draft.number}` : "В заказ"}
      </Button>
      <Button size="sm" variant="ghost" title="Новый черновик" onClick={() => void intoNew()}>
        <ListPlus />
        {compact ? "" : "Новый заказ"}
      </Button>
    </div>
  );
}

export function offerContextAdd(offer: Offer, addToDraft: AvtoAdd) {
  return async (event: MouseEvent) => {
    event.preventDefault();
    const next = await addToDraft(offer, Math.max(1, offer.multiplicity || 1), { newOrder: true });
    toast.success(`ПКМ: ${offer.sku} в новый заказ ${next.number}`);
  };
}

type AvtoAdd = ReturnType<typeof useAvtoPrice>["addToDraft"];
