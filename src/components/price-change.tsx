import { formatDateTime, formatSignedMoney, formatStock } from "@/lib/format";
import type { Offer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PriceChange({ offer, showBuy }: { offer: Offer; showBuy?: boolean }) {
  const priceChanged = Boolean(offer.priceDelta) && showBuy !== false;
  const stockChanged = Boolean(offer.stockDelta);
  if (!priceChanged && !stockChanged) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
      {priceChanged ? (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-medium",
            (offer.priceDelta ?? 0) > 0 ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800",
          )}
        >
          цена {formatSignedMoney(offer.priceDelta ?? 0, offer.currency)}
          {offer.prevPrice != null ? ` с ${offer.prevPrice}` : ""}
        </span>
      ) : null}
      {stockChanged ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
          остаток {offer.stockDelta! > 0 ? "+" : ""}
          {offer.stockDelta} → {formatStock(offer.stock)}
        </span>
      ) : null}
      {offer.changedAt ? (
        <span className="text-muted-foreground">{formatDateTime(offer.changedAt)}</span>
      ) : null}
    </div>
  );
}
