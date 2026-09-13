import { NextRequest } from "next/server";
import {
  patchOffer,
  removeClient,
  removeOrder,
  removeSupplier,
  replaceOffers,
  resetStore,
  upsertClient,
  upsertOrder,
  upsertSupplier,
} from "@/lib/server-store";
import type { Client, ImportMode, Offer, Order, Supplier, SyncLog } from "@/lib/types";

export async function POST(request: NextRequest) {
  let body: {
    action?: string;
    supplier?: Supplier;
    supplierId?: string;
    offers?: Offer[];
    log?: SyncLog;
    mode?: ImportMode;
    client?: Client;
    clientId?: string;
    order?: Order;
    orderId?: string;
    offerId?: string;
    patch?: Partial<Pick<Offer, "displayName" | "crossOems" | "name">>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  if (body.action === "upsertSupplier" && body.supplier) {
    return Response.json(await upsertSupplier(body.supplier));
  }
  if (body.action === "removeSupplier" && body.supplierId) {
    return Response.json(await removeSupplier(body.supplierId));
  }
  if (body.action === "replaceOffers" && body.supplierId && body.offers && body.log) {
    return Response.json(
      await replaceOffers(body.supplierId, body.offers, body.log, body.mode ?? "replace"),
    );
  }
  if (body.action === "patchOffer" && body.offerId && body.patch) {
    return Response.json(await patchOffer(body.offerId, body.patch));
  }
  if (body.action === "upsertClient" && body.client) {
    return Response.json(await upsertClient(body.client));
  }
  if (body.action === "removeClient" && body.clientId) {
    return Response.json(await removeClient(body.clientId));
  }
  if (body.action === "upsertOrder" && body.order) {
    return Response.json(await upsertOrder(body.order));
  }
  if (body.action === "removeOrder" && body.orderId) {
    return Response.json(await removeOrder(body.orderId));
  }
  if (body.action === "reset") {
    return Response.json(await resetStore());
  }
  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
