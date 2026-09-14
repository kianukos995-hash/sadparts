"use client";

import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { bandsForRole } from "@/lib/roles";
import { canSeeCost, clientNavOnly } from "@/lib/scope";
import { priceViewFor } from "@/lib/price-view";
import type { Client } from "@/lib/types";

export function useViewerPricing(selectedClientId?: string) {
  const { user } = useAuth();
  const { settings, clients, organizations } = useAvtoPrice();
  const locked = clientNavOnly(user?.role);
  const clientId = locked ? user?.clientId : selectedClientId;
  const client = clients.find((item) => item.id === clientId) as Client | undefined;
  const org = organizations.find((item) => item.id === user?.organizationId);
  const bands = bandsForRole(
    user?.role,
    settings.priceBands,
    settings.guestPriceBands,
    settings.managerPriceBands,
    org?.priceBands ?? settings.organizationPriceBands,
    Boolean(org) && user?.role !== "admin",
  );
  const showCost = canSeeCost(user?.role, user?.seeCost);
  return {
    user,
    client,
    clientId: clientId ?? "",
    locked,
    bands,
    view: priceViewFor(user, client),
    showCost,
    showAdminCost: user?.role === "admin",
    showOwnCost: showCost && user?.role !== "admin",
    costLabel: user?.role === "admin" ? "Закуп" : "Себестоимость",
    fallbackMarkup: settings.markupPercent,
    maxMarkup: client?.maxMarkup ?? org?.maxMarkup ?? settings.maxMarkup ?? undefined,
    org,
  };
}
