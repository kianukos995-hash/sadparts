import type { PriceBand, UserRole } from "@/lib/types";
import { DEFAULT_PRICE_BANDS, sanitizeBands } from "@/lib/price-bands";

export {
  canSeeCost,
  canSeeOwnCost,
  canSeeAnyCost,
  canManageStaff,
  canSeeDesk,
  clientNavOnly,
} from "@/lib/scope";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  organization: "Организация",
  manager: "Менеджер организации",
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
  _manager: PriceBand[] | undefined,
  organization?: PriceBand[] | undefined,
  underOrg = false,
) {
  if (role === "guest") return sanitizeBands(guest?.length ? guest : DEFAULT_GUEST_BANDS);
  if (role === "organization" || role === "manager" || underOrg) {
    return sanitizeBands(organization?.length ? organization : DEFAULT_PRICE_BANDS);
  }
  return sanitizeBands(warehouse);
}
