const LEGACY_ORDERS = "sadparts-orders-v1";
const LEGACY_DRAFT = "sadparts-active-draft";

export function ordersStorageKey(userId?: string | null) {
  return userId ? `${LEGACY_ORDERS}:${userId}` : LEGACY_ORDERS;
}

export function draftStorageKey(userId?: string | null) {
  return userId ? `${LEGACY_DRAFT}:${userId}` : LEGACY_DRAFT;
}

export function clearLegacyDrafts() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_ORDERS);
  window.localStorage.removeItem(LEGACY_DRAFT);
}

export function clearLocalDrafts(userId?: string | null) {
  if (typeof window === "undefined") return;
  clearLegacyDrafts();
  if (userId) {
    window.localStorage.removeItem(ordersStorageKey(userId));
    window.localStorage.removeItem(draftStorageKey(userId));
  }
}
