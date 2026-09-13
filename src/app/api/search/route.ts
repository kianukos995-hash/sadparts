import { NextRequest } from "next/server";
import { queryPriceOffers } from "@/lib/catalog-query";
import { readStore } from "@/lib/server-store";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const store = await readStore();
  if (query.length < 2) {
    const preview = await queryPriceOffers(store.suppliers, store.offers, {
      q: "",
      supplierId: request.nextUrl.searchParams.get("supplierId") || undefined,
      page: 0,
      pageSize: 40,
    });
    return Response.json({
      offers: preview.offers,
      total: preview.total,
      message: preview.total ? `${preview.total} поз. в прайсах` : "Загрузите прайс поставщика",
    });
  }
  const result = await queryPriceOffers(store.suppliers, store.offers, {
    q: query,
    supplierId: request.nextUrl.searchParams.get("supplierId") || undefined,
    live: request.nextUrl.searchParams.get("live") === "1",
    page: 0,
    pageSize: 80,
  });
  return Response.json({
    offers: result.offers,
    total: result.total,
    message: result.offers.length ? undefined : "В прайсах нет совпадений",
  });
}
