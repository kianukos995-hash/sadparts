import { NextRequest } from "next/server";
import { queryPriceOffers, priceMeta } from "@/lib/catalog-query";
import { readSettings, readStore } from "@/lib/server-store";
import type { CatalogBrowseFilter } from "@/lib/file-catalog";
import { fail, requireUser } from "@/lib/session";
import { publicOffer, viewerPriceContext } from "@/lib/viewer-price";
import { clientNavOnly } from "@/lib/scope";
import { catalogSupplierIds, filterOffersForActor } from "@/lib/suppliers-scope";

export const runtime = "nodejs";

function num(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const url = request.nextUrl;
  const meta = url.searchParams.get("meta");
  const store = await readStore();
  const allowedIds = catalogSupplierIds(store.suppliers, user);
  const scopedSuppliers = store.suppliers.filter((item) => allowedIds.has(item.id));
  const scopedOffers = filterOffersForActor(store.offers, store.suppliers, user);
  if (meta === "1") {
    return Response.json(await priceMeta(scopedSuppliers));
  }
  const settings = await readSettings();
  const live = url.searchParams.get("live") === "1" && user.role === "admin";
  const requestedSupplier = url.searchParams.get("supplierId") || undefined;
  if (requestedSupplier && !allowedIds.has(requestedSupplier)) {
    return Response.json({ offers: [], total: 0, page: 0, pageSize: 40 });
  }
  const result = await queryPriceOffers(scopedSuppliers, scopedOffers, {
    q: url.searchParams.get("q") ?? "",
    qField: (["sku", "oem", "name", "brand"].includes(url.searchParams.get("field") ?? "")
      ? (url.searchParams.get("field") as CatalogBrowseFilter["qField"])
      : "any"),
    supplierId: url.searchParams.get("supplierId") || undefined,
    brand: url.searchParams.get("brand") || undefined,
    minPrice: num(url.searchParams.get("minPrice")),
    maxPrice: num(url.searchParams.get("maxPrice")),
    maxDays: num(url.searchParams.get("maxDays")),
    inStock: url.searchParams.get("inStock") === "1",
    changedOnly: url.searchParams.get("changed") === "1" && !clientNavOnly(user.role),
    live,
    page: Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0,
    pageSize: Number.parseInt(url.searchParams.get("pageSize") ?? "40", 10) || 40,
  });
  const selectedClientId = url.searchParams.get("clientId") || user.clientId;
  const selected = store.clients.find((item) => item.id === selectedClientId);
  const ctx = viewerPriceContext(user, store, settings);
  const offers = result.offers.map((offer) => publicOffer(offer, ctx, selected));
  const q = url.searchParams.get("q") ?? "";
  if (q.trim()) {
    const { logActivity } = await import("@/lib/activity");
    void logActivity({
      userId: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      organizationId: user.organizationId,
      issuedByUserId: user.issuedByUserId,
      action: "search",
      detail: `Поиск «${q.trim()}», найдено ${result.total}`,
      path: "/quote",
      sku: q.trim(),
    });
  }
  return Response.json({ ...result, offers });
}
