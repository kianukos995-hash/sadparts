import type { Client, Organization } from "@/lib/types";

/** Организация сама выдаёт ключи клиентам, пока админ не забрал контроль. */
export function orgAllowsClientKeys(org?: Organization | null) {
  if (!org) return false;
  return !org.adminControlsClients;
}

export function clampPercent(value: number | undefined, max?: number | null) {
  if (value == null || !Number.isFinite(value)) return value;
  if (typeof max !== "number" || !Number.isFinite(max)) return value;
  return Math.min(Math.max(0, value), Math.max(0, max));
}

export function clampDiscount(value: number, max?: number | null) {
  const n = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (typeof max !== "number" || !Number.isFinite(max)) return n;
  return Math.min(n, Math.max(0, max));
}

export function applyOrgCapsToOrg(org: Organization): Organization {
  const markup = clampPercent(org.markupPercent, org.maxMarkup);
  const priceBands = org.priceBands?.map((band) => ({
    ...band,
    markupPercent: clampPercent(band.markupPercent, org.maxMarkup) ?? band.markupPercent,
  }));
  const bandMarkups = org.bandMarkups
    ? Object.fromEntries(
        Object.entries(org.bandMarkups).map(([id, value]) => [
          id,
          clampPercent(value, org.maxMarkup) ?? 0,
        ]),
      )
    : org.bandMarkups;
  return {
    ...org,
    markupPercent: markup,
    priceBands,
    bandMarkups,
  };
}

export function applyOrgCapsToClient(client: Client, org: Organization): Client {
  if (client.organizationId !== org.id) return client;
  const markup = clampPercent(client.markupPercent, org.maxMarkup);
  const discount = clampDiscount(client.discountPercent, org.maxDiscountPercent);
  const maxMarkup =
    client.maxMarkup == null ? org.maxMarkup : clampPercent(client.maxMarkup, org.maxMarkup);
  const bandMarkups = client.bandMarkups
    ? Object.fromEntries(
        Object.entries(client.bandMarkups).map(([id, value]) => [
          id,
          clampPercent(value, org.maxMarkup) ?? 0,
        ]),
      )
    : client.bandMarkups;
  return {
    ...client,
    markupPercent: markup,
    discountPercent: discount,
    maxMarkup,
    bandMarkups,
  };
}

export function applyOrgCapsToClients(clients: Client[], org: Organization): Client[] {
  return clients.map((client) => applyOrgCapsToClient(client, org));
}

export function orgKeyStatus(org: Organization): "active" | "taken" | "none" {
  if (org.adminControlsClients) return "taken";
  if (org.accessKey) return "active";
  return "none";
}
