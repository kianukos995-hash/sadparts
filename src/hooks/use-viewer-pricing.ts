"use client";

import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { bandsForRole, canSeeCost } from "@/lib/roles";
import { priceViewFor } from "@/lib/price-view";
import type { Client } from "@/lib/types";

export function useViewerPricing(selectedClientId?: string) {
  const { user } = useAuth();
  const { settings, clients } = useAvtoPrice();
  const locked = user?.role === "client" || user?.role === "guest";
  const clientId = locked ? user?.clientId : selectedClientId;
  const client = clients.find((item) => item.id === clientId) as Client | undefined;
  const bands = bandsForRole(
    user?.role,
    settings.priceBands,
    settings.guestPriceBands,
    settings.managerPriceBands,
  );
  return {
    user,
    client,
    clientId: clientId ?? "",
    locked,
    bands,
    view: priceViewFor(user?.role, client),
    showCost: canSeeCost(user?.role),
    fallbackMarkup: settings.markupPercent,
  };
}
