import type { Client, PriceView, UserRole } from "@/lib/types";
import { canSeeCost } from "@/lib/roles";

export function priceViewFor(role: UserRole | undefined, client?: Client | null): PriceView {
  if (canSeeCost(role)) return "cost";
  if (role === "guest") return "clean";
  return client?.priceView === "retail" ? "retail" : "clean";
}
