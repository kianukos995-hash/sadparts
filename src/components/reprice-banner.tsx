"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderLine, Offer } from "@/lib/types";

type Change = {
  line: OrderLine;
  missing: boolean;
  priceChanged: boolean;
  stockChanged: boolean;
  daysChanged: boolean;
  currentBuy?: number;
  currentStock?: number;
  currentDays?: number;
  currentSell?: number;
};

type Fill = {
  sku: string;
  qty: number;
  shortage: number;
  offers: { offer: Offer; take: number; sell: number }[];
};

export function RepriceBanner({
  orderId,
  clientId,
}: {
  orderId: string;
  clientId?: string;
}) {
  const [data, setData] = useState<{ needsReprice: boolean; changes: Change[]; fills: Fill[] } | null>(
    null,
  );

  useEffect(() => {
    void fetch(`/api/orders/reprice?id=${encodeURIComponent(orderId)}`)
      .then(async (response) => {
        if (!response.ok) return;
        setData(
          (await response.json()) as { needsReprice: boolean; changes: Change[]; fills: Fill[] },
        );
      })
      .catch(() => undefined);
  }, [orderId]);

  if (!data?.needsReprice) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" />
        Цены, наличие или сроки изменились. Нужна перепроценка заказа.
      </p>
      <ul className="mt-2 grid gap-1 text-xs">
        {data.changes
          .filter((item) => item.missing || item.priceChanged || item.stockChanged || item.daysChanged)
          .slice(0, 8)
          .map((item) => (
            <li key={item.line.id}>
              {item.line.sku}
              {item.missing
                ? " — позиции нет у прошлого поставщика"
                : ` — было ${formatMoney(item.line.snapshotSell ?? item.line.buyPrice)}, сейчас ${formatMoney(item.currentSell ?? 0)}, остаток ${item.currentStock ?? 0}, срок ${item.currentDays ?? "—"} дн.`}
            </li>
          ))}
      </ul>
      {data.fills.some((item) => item.offers.length > 0) ? (
        <div className="mt-2 text-xs">
          <p className="font-medium">Добор по артикулу (до 2 поставщиков, дешевле сначала):</p>
          {data.fills.map((fill) => (
            <p key={fill.sku}>
              {fill.sku}:{" "}
              {fill.offers.map((part) => `${part.offer.brand} ${part.take} шт. по ${formatMoney(part.sell)}`).join(" + ") ||
                "нет наличия"}
              {fill.shortage ? ` · не хватает ${fill.shortage}` : ""}
            </p>
          ))}
        </div>
      ) : null}
      <Link
        href={`/quote?orderId=${orderId}${clientId ? `&clientId=${clientId}` : ""}`}
        className={cn(buttonVariants({ size: "sm" }), "mt-3")}
      >
        Перепроценить
      </Link>
    </div>
  );
}
