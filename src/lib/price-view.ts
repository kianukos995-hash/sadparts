import type { Client, PriceView, PublicUser } from "@/lib/types";
import { canSeeCost } from "@/lib/scope";

export function priceViewFor(user?: PublicUser | null, client?: Client | null): PriceView {
  if (canSeeCost(user?.role, user?.seeCost)) return "cost";
  const view = user?.priceView ?? client?.priceView;
  return view === "retail" ? "retail" : "clean";
}
