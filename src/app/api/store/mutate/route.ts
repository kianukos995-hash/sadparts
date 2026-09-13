import { NextRequest } from "next/server";
import {
  patchOffer,
  removeClient,
  removeMoneyMovement,
  removeOrder,
  removeSupplier,
  removeSupplierBill,
  replaceOffers,
  resetStore,
  upsertClient,
  upsertMoneyMovement,
  upsertOrder,
  upsertSupplier,
  upsertSupplierBill,
} from "@/lib/server-store";
import type {
  Client,
  ImportMode,
  MoneyMovement,
  Offer,
  Order,
  Supplier,
  SupplierBill,
  SyncLog,
} from "@/lib/types";

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
    patch?: Partial<Pick<Offer, "displayName" | "crossOems" | "name" | "notes" | "applicability">>;
    movement?: MoneyMovement;
    movementId?: string;
    bill?: SupplierBill;
    billId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  try {
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
    if (body.action === "upsertMoneyMovement" && body.movement) {
      return Response.json(await upsertMoneyMovement(body.movement));
    }
    if (body.action === "removeMoneyMovement" && body.movementId) {
      return Response.json(await removeMoneyMovement(body.movementId));
    }
    if (body.action === "upsertSupplierBill" && body.bill) {
      return Response.json(await upsertSupplierBill(body.bill));
    }
    if (body.action === "removeSupplierBill" && body.billId) {
      return Response.json(await removeSupplierBill(body.billId));
    }
    if (body.action === "reset") {
      return Response.json(await resetStore());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить";
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
