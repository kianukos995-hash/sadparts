import type { PriceBand, UserRole } from "@/lib/types";
import { DEFAULT_PRICE_BANDS, sanitizeBands } from "@/lib/price-bands";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  client: "Клиент",
  guest: "Гость",
};

export const GUEST_CLIENT_ID = "cli-guest";

const DEFAULT_GUEST_BANDS: PriceBand[] = DEFAULT_PRICE_BANDS.map((band) => ({
  ...band,
  id: band.id.replace("band-", "guest-"),
  markupPercent: Math.min(80, band.markupPercent + 4),
}));

export function defaultGuestBands() {
  return sanitizeBands(DEFAULT_GUEST_BANDS);
}

export function bandsForRole(
  role: UserRole | undefined,
  warehouse: PriceBand[] | undefined,
  guest: PriceBand[] | undefined,
  manager: PriceBand[] | undefined,
) {
  if (role === "guest") return sanitizeBands(guest?.length ? guest : DEFAULT_GUEST_BANDS);
  if (role === "manager") return sanitizeBands(manager?.length ? manager : warehouse);
  return sanitizeBands(warehouse);
}

export function canSeeCost(role?: UserRole) {
  return role === "admin" || role === "manager";
}

export function canManageStaff(role?: UserRole) {
  return role === "admin";
}

export function canSeeDesk(role?: UserRole) {
  return role === "admin" || role === "manager";
}

export function clientNavOnly(role?: UserRole) {
  return role === "client" || role === "guest";
}
