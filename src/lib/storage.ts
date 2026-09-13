import { STORE_KEY, STORE_VERSION } from "@/lib/constants";
import { createInitialStore } from "@/lib/seed";
import type { StoreSnapshot } from "@/lib/types";

function isStore(value: unknown): value is StoreSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as StoreSnapshot;
  return (
    Array.isArray(candidate.suppliers) &&
    Array.isArray(candidate.offers) &&
    Array.isArray(candidate.logs)
  );
}

export function loadStore(): StoreSnapshot {
  if (typeof window === "undefined") return createInitialStore();
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return createInitialStore();
    const parsed: unknown = JSON.parse(raw);
    if (!isStore(parsed) || parsed.version !== STORE_VERSION) {
      return createInitialStore();
    }
    return parsed;
  } catch {
    return createInitialStore();
  }
}

export function saveStore(store: StoreSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function resetStore(): StoreSnapshot {
  const next = createInitialStore();
  saveStore(next);
  return next;
}
