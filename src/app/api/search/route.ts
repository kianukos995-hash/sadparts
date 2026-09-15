import { NextRequest } from "next/server";
import { queryPriceOffers } from "@/lib/catalog-query";
import { anonymizeOffer, hideSuppliersFor } from "@/lib/client-catalog";
import { clientNavOnly } from "@/lib/scope";
import { fail, requireUser } from "@/lib/session";
import { readSettings, readStore } from "@/lib/server-store";
import { catalogSupplierIds, filterOffersForActor } from "@/lib/suppliers-scope";
import { publicOffer, viewerPriceContext } from "@/lib/viewer-price";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const store = await readStore();
  const settings = await readSettings();
  const allowedIds = catalogSupplierIds(store.suppliers, user);
  const scopedSuppliers = store.suppliers.filter((item) => allowedIds.has(item.id));
  const scopedOffers = filterOffersForActor(store.offers, store.suppliers, user);
  const supplierId = hideSuppliersFor(user.role)
    ? undefined
    : request.nextUrl.searchParams.get("supplierId") || undefined;
  if (query.length < 2) {
    if (clientNavOnly(user.role)) {
      return Response.json({
        offers: [],
        total: 0,
        message: "Введите артикул или название — полный прайс закрыт",
      });
    }
    const preview = await queryPriceOffers(scopedSuppliers, scopedOffers, {
      q: "",
      supplierId,
      page: 0,
      pageSize: 40,
    });
    return Response.json({
      offers: preview.offers,
      total: preview.total,
      message: preview.total ? `${preview.total} поз. в прайсах` : "Загрузите прайс поставщика",
    });
  }
  const result = await queryPriceOffers(scopedSuppliers, scopedOffers, {
    q: query,
    supplierId,
    live: request.nextUrl.searchParams.get("live") === "1" && user.role === "admin",
    page: 0,
    pageSize: 80,
  });
  const ctx = viewerPriceContext(user, store, settings);
  const offers = result.offers
    .map((offer) => publicOffer(offer, ctx))
    .map((offer) => (hideSuppliersFor(user.role) ? anonymizeOffer(offer) : offer));
  return Response.json({
    offers,
    total: result.total,
    message: offers.length ? undefined : "В прайсах нет совпадений",
  });
}
