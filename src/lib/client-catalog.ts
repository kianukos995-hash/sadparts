import { clientNavOnly } from "@/lib/scope";
import type { Offer, Supplier, UserRole } from "@/lib/types";

/** Клиент и гость не видят имена поставщиков — только срок и наличие. */
export function hideSuppliersFor(role?: UserRole) {
  return clientNavOnly(role);
}

export function anonymizeSupplier(supplier: Supplier): Supplier {
  return {
    ...supplier,
    name: "",
    code: "",
    notes: "",
    deliveryNote: "",
    apiUrl: "",
    apiKey: "",
    apiKey2: "",
  };
}

export function anonymizeOffer(offer: Offer): Offer {
  return {
    ...offer,
    warehouse: "склад",
  };
}

export function categoryMatches(value: string | undefined, wanted: string | undefined) {
  const needle = (wanted ?? "").trim().toLowerCase();
  if (!needle) return true;
  return (value ?? "").trim().toLowerCase() === needle;
}
