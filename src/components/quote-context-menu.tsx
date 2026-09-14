"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addOfferToCart, qtyStep, type QuoteMenuState } from "@/components/add-to-order";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import type { Offer } from "@/lib/types";

export function QuoteContextMenu({
  menu,
  clientId,
  orderId,
  onClose,
  onDetails,
}: {
  menu: QuoteMenuState | null;
  clientId?: string;
  orderId?: string;
  onClose: () => void;
  onDetails: (offer: Offer) => void;
}) {
  if (!menu) return null;
  return (
    <MenuBody
      key={`${menu.offer.id}:${menu.x}:${menu.y}`}
      menu={menu}
      clientId={clientId}
      orderId={orderId}
      onClose={onClose}
      onDetails={onDetails}
    />
  );
}

function MenuBody({
  menu,
  clientId,
  orderId,
  onClose,
  onDetails,
}: {
  menu: QuoteMenuState;
  clientId?: string;
  orderId?: string;
  onClose: () => void;
  onDetails: (offer: Offer) => void;
}) {
  const { addToDraft, orders } = useAvtoPrice();
  const [qty, setQty] = useState(qtyStep(menu.offer));

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-80 min-w-52 rounded-lg border bg-popover p-1 text-sm shadow-md"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="px-2 py-1 text-xs text-muted-foreground">
        {menu.offer.sku} · {menu.offer.warehouse || "склад"}
      </p>
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => {
          void addOfferToCart(menu.offer, addToDraft, orders, qty, { clientId, orderId });
          onClose();
        }}
      >
        В текущую корзину
      </Button>
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="text-xs text-muted-foreground">Кол-во</span>
        <Input
          className="h-7 w-16"
          value={qty}
          onChange={(event) => setQty(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void addOfferToCart(menu.offer, addToDraft, orders, qty, { clientId, orderId });
            onClose();
          }}
        >
          Добавить
        </Button>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => {
          onDetails(menu.offer);
          onClose();
        }}
      >
        Открыть карточку
      </Button>
    </div>
  );
}
