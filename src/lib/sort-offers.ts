import type { Offer } from "@/lib/types";
import type { SortDir } from "@/components/sort-toggle";

export function sortOffers(offers: Offer[], days: SortDir, price: SortDir) {
  const next = [...offers];
  next.sort((a, b) => {
    if (days) {
      const diff = (a.deliveryDays || 0) - (b.deliveryDays || 0);
      if (diff) return days === "asc" ? diff : -diff;
    }
    if (price) {
      const diff = a.price - b.price;
      if (diff) return price === "asc" ? diff : -diff;
    }
    return 0;
  });
  return next;
}
