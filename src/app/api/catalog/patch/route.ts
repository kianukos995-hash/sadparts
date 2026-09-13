import { NextRequest } from "next/server";
import { writeOfferPatch } from "@/lib/offer-patches";
import { patchOffer, readStore } from "@/lib/server-store";
import type { Offer } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    offerId?: string;
    supplierId?: string;
    patch?: Partial<Pick<Offer, "displayName" | "crossOems" | "notes" | "applicability" | "name">>;
  };
  if (!body.offerId || !body.patch) {
    return Response.json({ error: "Нет данных для сохранения" }, { status: 400 });
  }
  const store = await readStore();
  const supplierId =
    body.supplierId ||
    store.suppliers.find((item) => body.offerId!.startsWith(`${item.id}:`))?.id ||
    "";
  if (supplierId) {
    await writeOfferPatch(supplierId, body.offerId, body.patch);
  }
  const next = await patchOffer(body.offerId, body.patch);
  return Response.json({ ok: true, store: next });
}
