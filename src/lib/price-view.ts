import type { Client, PriceView, UserRole } from "@/lib/types";
import { canSeeAnyCost } from "@/lib/scope";

export function priceViewFor(role: UserRole | undefined, client?: Client | null): PriceView {
  if (canSeeAnyCost(role)) return "cost";
  if (role === "guest") return "clean";
  return client?.priceView === "retail" ? "retail" : "clean";
}
