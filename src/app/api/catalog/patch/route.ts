import { NextRequest } from "next/server";
import { writeOfferPatch } from "@/lib/offer-patches";
import { patchOffer, readSettings, readStore } from "@/lib/server-store";
import type { OfferPatch } from "@/lib/offer-patches";
import { fail, requireUser } from "@/lib/session";
import { canEditSupplier } from "@/lib/suppliers-scope";
import { publicStoreFor } from "@/lib/public-store";
import { listAccessKeys } from "@/lib/auth-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const body = (await request.json()) as {
    offerId?: string;
    supplierId?: string;
    patch?: OfferPatch;
  };
  if (!body.offerId || !body.patch) {
    return Response.json({ error: "Нет данных для сохранения" }, { status: 400 });
  }
  const store = await readStore();
  const supplierId =
    body.supplierId ||
    store.suppliers.find((item) => body.offerId!.startsWith(`${item.id}:`))?.id ||
    "";
  const supplier = store.suppliers.find((item) => item.id === supplierId);
  if (!supplier || !canEditSupplier(supplier, user, store.organizations ?? [])) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  await writeOfferPatch(supplierId, body.offerId, body.patch);
  const next = await patchOffer(body.offerId, body.patch);
  const [settings, keys] = await Promise.all([readSettings(), listAccessKeys()]);
  return Response.json({ ok: true, store: publicStoreFor(user, next, settings, keys) });
}
