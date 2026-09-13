import { NextRequest } from "next/server";
import { searchOffers } from "@/lib/search";
import { rosskoSearch, isRosskoSupplier, ensureRosskoDelivery } from "@/lib/rossko";
import { readStore, upsertSupplier } from "@/lib/server-store";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json({ offers: [], message: "Введите артикул, OEM или название" });
  }
  const store = await readStore();
  const local = searchOffers(store, query, 40).map((item) => item.offer);
  const rosskoSuppliers = store.suppliers.filter((item) => item.active !== false && isRosskoSupplier(item));
  const extra = [];
  const notes: string[] = [];
  for (const supplier of rosskoSuppliers) {
    const result = await rosskoSearch(supplier, query);
    extra.push(...result.offers);
    if (result.message) notes.push(result.message);
    if (result.live && !supplier.rosskoDeliveryId) {
      try {
        await upsertSupplier(await ensureRosskoDelivery(supplier));
      } catch {
        // ignore persist of delivery id
      }
    }
  }
  const seen = new Set(local.map((item) => item.id));
  const merged = [...local];
  for (const offer of extra) {
    if (!seen.has(offer.id)) {
      seen.add(offer.id);
      merged.push(offer);
    }
  }
  merged.sort((a, b) => a.price - b.price || a.deliveryDays - b.deliveryDays);
  return Response.json({
    offers: merged.slice(0, 80),
    message: notes[0],
  });
}
