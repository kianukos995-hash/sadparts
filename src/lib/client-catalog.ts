import { clientNavOnly } from "@/lib/scope";
import type { Offer, Supplier, UserRole } from "@/lib/types";

/** Клиент и гость не видят имена и ключи поставщиков. Логотип и срок в проценке оставляем. */
export function hideSuppliersFor(role?: UserRole) {
  return clientNavOnly(role);
}

export function anonymizeSupplier(supplier: Supplier): Supplier {
  return {
    ...supplier,
    name: "",
    code: "",
    logoUrl: supplier.logoUrl || "",
    notes: "",
    deliveryNote: "",
    apiUrl: "",
    apiKey: "",
    apiKey2: "",
    emailAlias: "",
    presetId: supplier.presetId || "",
  };
}

export function anonymizeOffer(offer: Offer): Offer {
  return offer;
}

export function categoryMatches(value: string | undefined, wanted: string | undefined) {
  const needle = (wanted ?? "").trim().toLowerCase();
  if (!needle) return true;
  return (value ?? "").trim().toLowerCase() === needle;
}
