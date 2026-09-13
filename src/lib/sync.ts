import { getByPath } from "@/lib/json-path";
import { mapPayloadToOffers } from "@/lib/mapping";
import type { Offer, ParsedTable, Supplier, SyncLog } from "@/lib/types";

export async function fetchSupplierPayload(supplier: Supplier) {
  const response = await fetch("/api/fetch-price-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: supplier.apiUrl,
      apiKey: supplier.apiKey,
      authMode: supplier.authMode,
      authHeaderName: supplier.authHeaderName,
      authQueryParam: supplier.authQueryParam,
      jsonOnly: true,
    }),
  });
  const data = (await response.json()) as { payload?: unknown; error?: string };
  if (!response.ok || data.error) {
    throw new Error(data.error || "Не удалось получить прайс");
  }
  return data.payload;
}

export async function fetchFeedTable(input: {
  url: string;
  apiKey?: string;
  authMode?: Supplier["authMode"];
  authHeaderName?: string;
  authQueryParam?: string;
  itemsPath?: string;
}) {
  const response = await fetch("/api/fetch-price-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as { table?: ParsedTable; error?: string };
  if (!response.ok || !data.table) {
    throw new Error(data.error || "Не удалось получить прайс по ссылке");
  }
  return data.table;
}

export function payloadToOffers(payload: unknown, supplier: Supplier) {
  const extracted = getByPath(payload, supplier.itemsPath);
  const items = Array.isArray(extracted) ? extracted : null;
  if (!items) {
    throw new Error(
      supplier.itemsPath
        ? `В ответе нет массива по пути «${supplier.itemsPath}»`
        : "Ответ API не является массивом позиций",
    );
  }
  return mapPayloadToOffers(items, supplier);
}

export function buildSyncLog(
  supplier: Supplier,
  result: { offers: Offer[]; skipped: number } | { error: string },
  source: Supplier["source"],
  fileName?: string,
  label?: string,
): SyncLog {
  if ("error" in result) {
    return {
      id: crypto.randomUUID(),
      supplierId: supplier.id,
      at: new Date().toISOString(),
      status: "error",
      imported: 0,
      error: result.error,
      source,
      fileName,
      label,
    };
  }
  return {
    id: crypto.randomUUID(),
    supplierId: supplier.id,
    at: new Date().toISOString(),
    status: "ok",
    imported: result.offers.length,
    error: result.skipped ? `Пропущено без артикула: ${result.skipped}` : undefined,
    source,
    fileName,
    label,
  };
}

export async function syncSupplier(supplier: Supplier) {
  const payload = await fetchSupplierPayload(supplier);
  return payloadToOffers(payload, supplier);
}
