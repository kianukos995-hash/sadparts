import { NextRequest } from "next/server";
import {
  patchOffer,
  readSettings,
  readStore,
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
import { fail, requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { clientSellPrice } from "@/lib/pricing";
import { bandsForRole } from "@/lib/roles";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const desk = user.role === "admin" || user.role === "manager";
  const admin = user.role === "admin";

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
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json(await upsertSupplier(body.supplier));
    }
    if (body.action === "removeSupplier" && body.supplierId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json(await removeSupplier(body.supplierId));
    }
    if (body.action === "replaceOffers" && body.supplierId && body.offers && body.log) {
      if (!desk) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return Response.json(
        await replaceOffers(body.supplierId, body.offers, body.log, body.mode ?? "replace"),
      );
    }
    if (body.action === "patchOffer" && body.offerId && body.patch) {
      if (!desk) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return Response.json(await patchOffer(body.offerId, body.patch));
    }
    if (body.action === "upsertClient" && body.client) {
      if (!desk) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return Response.json(await upsertClient(body.client));
    }
    if (body.action === "removeClient" && body.clientId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json(await removeClient(body.clientId));
    }
    if (body.action === "upsertOrder" && body.order) {
      const store = await readStore();
      const settings = await readSettings();
      let order = body.order;
      if (!desk) {
        const clientId = user.clientId || "";
        if (order.clientId && order.clientId !== clientId) {
          return Response.json({ error: "Нельзя писать в чужой заказ" }, { status: 403 });
        }
        order = { ...order, clientId };
        const existing = store.orders.find((item) => item.id === order.id);
        if (existing && existing.clientId !== clientId) {
          return Response.json({ error: "Чужой заказ" }, { status: 403 });
        }
      }
      const client = store.clients.find((item) => item.id === order.clientId);
      const bands = bandsForRole(user.role, settings.priceBands, settings.guestPriceBands, settings.managerPriceBands);
      const now = new Date().toISOString();
      order = {
        ...order,
        lines: order.lines.map((line) => ({
          ...line,
          snapshotSell:
            line.snapshotSell ??
            clientSellPrice(line.buyPrice, bands, settings.markupPercent, client),
          snapshotStock: line.snapshotStock,
          snapshotAt: line.snapshotAt ?? now,
        })),
      };
      const saved = await upsertOrder(order);
      await logActivity({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: order.clientId,
        action: order.status === "draft" ? "cart" : "order",
        detail: `${order.status === "draft" ? "Корзина" : "Заказ"} ${order.number}, ${order.lines.length} поз., статус ${order.status}`,
        orderId: order.id,
      });
      return Response.json(saved);
    }
    if (body.action === "removeOrder" && body.orderId) {
      if (!desk) return Response.json({ error: "Клиент не удаляет заказ — он остаётся в списке" }, { status: 403 });
      return Response.json(await removeOrder(body.orderId));
    }
    if (body.action === "upsertMoneyMovement" && body.movement) {
      if (!desk) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return Response.json(await upsertMoneyMovement(body.movement));
    }
    if (body.action === "removeMoneyMovement" && body.movementId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json(await removeMoneyMovement(body.movementId));
    }
    if (body.action === "upsertSupplierBill" && body.bill) {
      if (!desk) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return Response.json(await upsertSupplierBill(body.bill));
    }
    if (body.action === "removeSupplierBill" && body.billId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json(await removeSupplierBill(body.billId));
    }
    if (body.action === "reset") {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json(await resetStore());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить";
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
