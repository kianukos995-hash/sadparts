"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime, formatMoney, formatStock } from "@/lib/format";
import type { Offer, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OfferDrawer({
  offer,
  offers,
  suppliers,
  onOpenChange,
}: {
  offer: Offer | null;
  offers: Offer[];
  suppliers: Supplier[];
  onOpenChange: (open: boolean) => void;
}) {
  const related = offer
    ? offers
        .filter((item) => {
          if (item.sku === offer.sku && item.brand === offer.brand) return true;
          return Boolean(offer.oem) && item.oem === offer.oem;
        })
        .sort((a, b) => a.price - b.price)
    : [];
  const minPrice = related[0]?.price;
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  return (
    <Sheet open={Boolean(offer)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {offer ? (
          <>
            <SheetHeader>
              <SheetTitle>{offer.name}</SheetTitle>
              <SheetDescription>
                {offer.brand} · {offer.sku}
                {offer.oem ? ` · OEM ${offer.oem}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-6">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{offer.category}</Badge>
                <Badge variant="outline">{names.get(offer.supplierId)}</Badge>
              </div>
              <p className="text-2xl font-semibold tracking-tight">
                {formatMoney(offer.price, offer.currency)}
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Остаток" value={formatStock(offer.stock)} />
                <Info label="Склад" value={offer.warehouse || "—"} />
                <Info label="Кратность" value={String(offer.multiplicity)} />
                <Info label="Обновлено" value={formatDateTime(offer.updatedAt)} />
              </dl>
              <div>
                <h3 className="mb-2 text-sm font-medium">Предложения по этой детали</h3>
                <div className="flex flex-col gap-2">
                  {related.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2",
                        item.price === minPrice && "border-emerald-300 bg-emerald-50",
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{names.get(item.supplierId)}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.brand} {item.sku} · {formatStock(item.stock)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        {formatMoney(item.price, item.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
