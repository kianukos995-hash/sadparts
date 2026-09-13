import type { PriceBreakdown } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PriceFormula({
  breakdown,
  currency = "RUB",
  className,
  compact,
}: {
  breakdown: PriceBreakdown;
  currency?: string;
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        {formatMoney(breakdown.buy, currency)} + {formatMoney(breakdown.markupAmount, currency)} −{" "}
        {formatMoney(breakdown.discountAmount, currency)} = {formatMoney(breakdown.sell, currency)}
      </p>
    );
  }

  return (
    <div className={cn("grid gap-1 text-sm", className)}>
      <p className="text-muted-foreground">
        Закуп {formatMoney(breakdown.buy, currency)} + наценка {breakdown.markupPercent}% (
        {formatMoney(breakdown.markupAmount, currency)}) − скидка {breakdown.discountPercent}% (
        {formatMoney(breakdown.discountAmount, currency)})
      </p>
      <p className="font-medium">
        Клиенту {formatMoney(breakdown.sell, currency)}
      </p>
    </div>
  );
}
