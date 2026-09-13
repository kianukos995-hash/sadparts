import { NextRequest } from "next/server";
import { findPriceOffer } from "@/lib/catalog-query";
import { writeOfferPatch } from "@/lib/offer-patches";
import { patchOffer, readStore } from "@/lib/server-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    direction?: "take" | "release";
    items?: { offerId?: string; supplierId?: string; qty?: number }[];
  };
  if (body.direction !== "take" && body.direction !== "release") {
    return Response.json({ error: "Не указано направление" }, { status: 400 });
  }
  const items = (body.items ?? []).filter((item) => item.offerId && (item.qty ?? 0) > 0);
  if (items.length === 0) {
    return Response.json({ error: "Нет позиций" }, { status: 400 });
  }
  const store = await readStore();
  const changed: { offerId: string; stock: number }[] = [];
  for (const item of items) {
    const offerId = item.offerId!;
    const qty = Math.max(0, Math.round(item.qty ?? 0));
    const found = await findPriceOffer(store.suppliers, store.offers, offerId);
    const current = found?.stock ?? 0;
    const nextStock = body.direction === "take" ? current - qty : current + qty;
    const supplierId =
      item.supplierId ||
      found?.supplierId ||
      store.suppliers.find((entry) => offerId.startsWith(`${entry.id}:`))?.id ||
      "";
    if (supplierId) {
      await writeOfferPatch(supplierId, offerId, { stock: nextStock });
    }
    await patchOffer(offerId, { stock: nextStock });
    changed.push({ offerId, stock: nextStock });
  }
  return Response.json({ ok: true, changed });
}
