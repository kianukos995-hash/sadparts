"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDays, formatMoney, formatStock } from "@/lib/format";
import type { Offer, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PartsTable({
  offers,
  suppliers,
  cheapestIds,
  onSelect,
  empty,
}: {
  offers: Offer[];
  suppliers: Supplier[];
  cheapestIds?: Set<string>;
  onSelect?: (offer: Offer) => void;
  empty: string;
}) {
  const names = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  if (offers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Артикул</TableHead>
          <TableHead>Бренд</TableHead>
          <TableHead className="min-w-48">Наименование</TableHead>
          <TableHead className="hidden lg:table-cell">OEM</TableHead>
          <TableHead>Поставщик</TableHead>
          <TableHead className="text-right">Цена</TableHead>
          <TableHead className="hidden text-right md:table-cell">До Москвы</TableHead>
          <TableHead className="text-right">Остаток</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {offers.map((offer) => {
          const cheapest = cheapestIds?.has(offer.id);
          return (
            <TableRow
              key={offer.id}
              className={cn(onSelect && "cursor-pointer")}
              onClick={() => onSelect?.(offer)}
            >
              <TableCell className="font-mono text-xs">{offer.sku}</TableCell>
              <TableCell>{offer.brand}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span>{offer.displayName?.trim() || offer.name}</span>
                  <span className="text-xs text-muted-foreground lg:hidden">{offer.oem || "—"}</span>
                </div>
              </TableCell>
              <TableCell className="hidden font-mono text-xs lg:table-cell">
                {offer.oem || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{names.get(offer.supplierId) ?? "—"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className={cn("font-medium", cheapest && "text-emerald-700")}>
                  {formatMoney(offer.price, offer.currency)}
                </span>
                {cheapest ? (
                  <span className="ml-1 text-[10px] font-medium tracking-wide text-emerald-700 uppercase">
                    min
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="hidden text-right text-xs md:table-cell">
                {formatDays(offer.deliveryDays)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right",
                  offer.stock <= 0 && "text-destructive",
                  offer.stock > 0 && offer.stock < 5 && "text-amber-700",
                )}
              >
                {formatStock(offer.stock)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
