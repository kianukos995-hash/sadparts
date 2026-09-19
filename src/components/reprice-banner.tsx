"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Offer, OrderLine } from "@/lib/types";

function skuKey(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function matchesLive(offer: Offer, change: RepriceChange) {
  if (skuKey(offer.sku) !== skuKey(change.line.sku)) return false;
  if (offer.stock <= 0) return false;
  if (change.missing || change.skuMismatch) return true;
  if (offer.supplierId === change.line.supplierId && (offer.warehouse || "") === (change.line.warehouse || "")) {
    return offer.stock >= change.line.qty;
  }
  return true;
}

export type RepriceChange = {
  line: OrderLine;
  missing: boolean;
  priceChanged: boolean;
  stockChanged: boolean;
  stockShortage?: boolean;
  daysChanged: boolean;
  skuMismatch?: boolean;
  offerMismatch?: boolean;
  problem?: boolean;
  reasons?: string[];
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

export function useRepriceCheck(orderId?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ needsReprice: boolean; changes: RepriceChange[]; fills: Fill[] } | null>(
    null,
  );
  const [dismissed, setDismissed] = useState<string[]>([]);

  const load = useCallback(() => {
    if (!orderId) {
      setData(null);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    void fetch(`/api/orders/reprice?id=${encodeURIComponent(orderId)}`)
      .then(async (response) => {
        const json = (await response.json()) as {
          error?: string;
          needsReprice?: boolean;
          changes?: RepriceChange[];
          fills?: Fill[];
        };
        if (!response.ok) throw new Error(json.error || "Не проверить цены");
        setData({
          needsReprice: Boolean(json.needsReprice),
          changes: json.changes ?? [],
          fills: json.fills ?? [],
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Не проверить цены");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const problems = useMemo(() => {
    const skip = new Set(dismissed.map((sku) => sku.toLowerCase()));
    return (data?.changes ?? []).filter((item) => {
      if (skip.has(item.line.sku.toLowerCase())) return false;
      return (
        item.problem ||
        item.missing ||
        item.skuMismatch ||
        item.offerMismatch ||
        item.stockShortage ||
        item.stockChanged ||
        item.priceChanged ||
        item.daysChanged
      );
    });
  }, [data, dismissed]);

  function resolveByOffer(offer: Offer) {
    const hit = problems.find((item) => matchesLive(offer, item));
    if (!hit) return;
    setDismissed((current) =>
      current.includes(hit.line.sku.toLowerCase()) ? current : [...current, hit.line.sku.toLowerCase()],
    );
  }

  return { loading, error, data, problems, reload: load, resolveByOffer, needsReprice: problems.length > 0 };
}

export function RepriceBanner({
  orderId,
  clientId,
}: {
  orderId: string;
  clientId?: string;
}) {
  const { loading, error, data, problems } = useRepriceCheck(orderId);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Сверяю заказ с прайсом…</p>;
  }
  if (error) {
    return <p className="text-sm text-amber-800">{error}</p>;
  }
  if (!data || problems.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="size-4" />
        Цены, наличие или артикул не совпадают с прайсом. Нужна перепроценка.
      </p>
      <ul className="mt-2 grid gap-1 text-xs">
        {problems.slice(0, 8).map((item) => (
          <li key={item.line.id} className="font-mono">
            <span className="rounded bg-amber-200/80 px-1">{item.line.sku}</span>
            {" — "}
            {(item.reasons ?? []).join(", ") ||
              (item.missing
                ? "позиции нет у прошлого поставщика"
                : `было ${formatMoney(item.line.snapshotSell ?? item.line.buyPrice)}, сейчас ${formatMoney(item.currentSell ?? 0)}, остаток ${item.currentStock ?? 0}`)}
          </li>
        ))}
      </ul>
      {data.fills.some((item) => item.offers.length > 0) ? (
        <div className="mt-2 text-xs">
          <p className="font-medium">Добор по артикулу (до 2 складов, дешевле сначала):</p>
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
        href={`/quote?orderId=${orderId}${clientId ? `&clientId=${clientId}` : ""}&reprice=1`}
        className={cn(buttonVariants({ size: "sm" }), "mt-3")}
      >
        Перепроценить
      </Link>
    </div>
  );
}

export function RepriceQuickAccess({
  orderId,
  onPickSku,
  problems,
  loading,
  error,
  onClose,
}: {
  orderId?: string;
  onPickSku: (sku: string) => void;
  problems: RepriceChange[];
  loading: boolean;
  error: string;
  onClose?: () => void;
}) {
  if (!orderId) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-amber-950">
            <AlertTriangle className="size-4" />
            Быстрый доступ — позиции на перепроценку
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            Нажмите артикул — он попадёт в поиск. После добавления живой строки с достаточным остатком позиция
            исчезнет из ленты.
          </p>
        </div>
        {onClose ? (
          <Button size="icon-sm" variant="ghost" type="button" onClick={onClose} title="Скрыть ленту">
            <X />
          </Button>
        ) : null}
      </div>
      {loading ? <p className="mt-2 text-sm text-muted-foreground">Сверяю с прайсом…</p> : null}
      {error ? <p className="mt-2 text-sm text-amber-800">{error}</p> : null}
      {!loading && !error && problems.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Все позиции совпадают с прайсом.</p>
      ) : null}
      {problems.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {problems.map((item) => (
            <button
              key={item.line.id}
              type="button"
              onClick={() => onPickSku(item.line.sku)}
              className="min-w-40 shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-2 text-left"
            >
              <p className="font-mono text-sm font-semibold">{item.line.sku}</p>
              <p className="text-[11px] text-muted-foreground">
                {(item.reasons ?? []).join(" · ") || "не совпадает с прайсом"}
              </p>
              <p className="text-[11px] text-muted-foreground">нужно {item.line.qty} шт.</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
