"use client";

import { useState, type MouseEvent } from "react";
import { ShoppingCart, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { availableStock } from "@/lib/stock";
import type { Offer } from "@/lib/types";

export const STOCK_EMPTY_ERROR = "выбери другого поставщика, у этого нет данной позиции";

export function qtyStep(offer: Offer) {
  return Math.max(1, offer.multiplicity || 1);
}

export async function addOfferToCart(
  offer: Offer,
  addToDraft: ReturnType<typeof useAvtoPrice>["addToDraft"],
  orders: ReturnType<typeof useAvtoPrice>["orders"],
  qty: number,
  options?: { clientId?: string; orderId?: string; newOrder?: boolean },
) {
  const step = qtyStep(offer);
  const count = Math.max(step, Math.ceil(qty / step) * step);
  const free = availableStock(offer, orders);
  if (free <= 0 || offer.stock <= 0) {
    toast.error(STOCK_EMPTY_ERROR);
    return null;
  }
  if (count > free) {
    toast.error(
      `На складе «${offer.warehouse || "этот"}» свободно ${free} шт. ${STOCK_EMPTY_ERROR}`,
    );
    return null;
  }
  const next = await addToDraft(offer, count, options);
  toast.success(`${offer.sku} → ${next.number} · ${count} шт.`);
  return next;
}

export function QtyControl({
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
  const { addToDraft, orders } = useAvtoPrice();
  const step = qtyStep(offer);
  const [qty, setQty] = useState(step);
  const free = availableStock(offer, orders);

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
      <Button
        size="icon-sm"
        variant="outline"
        type="button"
        onClick={() => setQty((value) => Math.max(step, value - step))}
      >
        <Minus />
      </Button>
      <Input
        className="h-7 w-14 px-1 text-center"
        value={qty}
        onChange={(event) => setQty(Math.max(step, Number.parseInt(event.target.value, 10) || step))}
      />
      <Button
        size="icon-sm"
        variant="outline"
        type="button"
        onClick={() => setQty((value) => value + step)}
      >
        <Plus />
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={() => void addOfferToCart(offer, addToDraft, orders, qty, { clientId, orderId })}
      >
        <ShoppingCart />
        {compact ? "В корзину" : "Добавить"}
      </Button>
      {free <= 0 ? (
        <span className="text-[11px] text-amber-800">нет на складе</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">своб. {free}</span>
      )}
    </div>
  );
}

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
  return <QtyControl offer={offer} compact={compact} clientId={clientId} orderId={orderId} />;
}

export type QuoteMenuState = {
  x: number;
  y: number;
  offer: Offer;
};

export function openQuoteContextMenu(
  event: MouseEvent,
  offer: Offer,
  setMenu: (menu: QuoteMenuState) => void,
) {
  event.preventDefault();
  event.stopPropagation();
  setMenu({ x: event.clientX, y: event.clientY, offer });
}
