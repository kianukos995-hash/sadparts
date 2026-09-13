import { NextRequest } from "next/server";
import { queryPriceOffers, priceMeta } from "@/lib/catalog-query";
import { readStore } from "@/lib/server-store";
import type { CatalogBrowseFilter } from "@/lib/file-catalog";

export const runtime = "nodejs";

function num(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const meta = url.searchParams.get("meta");
  const store = await readStore();
  if (meta === "1") {
    return Response.json(await priceMeta(store.suppliers));
  }
  const result = await queryPriceOffers(store.suppliers, store.offers, {
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
    changedOnly: url.searchParams.get("changed") === "1",
    live: url.searchParams.get("live") === "1",
    page: Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0,
    pageSize: Number.parseInt(url.searchParams.get("pageSize") ?? "40", 10) || 40,
  });
  return Response.json(result);
}
