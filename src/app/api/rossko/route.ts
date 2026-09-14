import { NextRequest } from "next/server";
import {
  ensureRosskoDelivery,
  filterRosskoLines,
  isRosskoSupplier,
  orderLinesToRosskoParts,
  rosskoCheckout,
  rosskoDetails,
  rosskoOrders,
  rosskoResolveLines,
  rosskoSearch,
} from "@/lib/rossko";
import { readStore, upsertOrder, upsertSupplier } from "@/lib/server-store";
import type { Order } from "@/lib/types";
import { fail, requireUser } from "@/lib/session";
import { canEditSupplier, supplierVisibleTo } from "@/lib/suppliers-scope";
import { isDeskRole } from "@/lib/scope";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  let body: {
    action?: string;
    supplierId?: string;
    query?: string;
    orderId?: string;
    deliveryId?: string;
    addressId?: string;
    paymentId?: number;
    contactName?: string;
    contactPhone?: string;
    comment?: string;
    deliveryParts?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  const store = await readStore();
  const supplier = store.suppliers.find((item) => item.id === (body.supplierId || "sup-rossko"));
  if (!supplier || !isRosskoSupplier(supplier)) {
    return Response.json({ error: "Поставщик Росско не найден" }, { status: 404 });
  }
  const orgs = store.organizations ?? [];
  if (!supplierVisibleTo(supplier, user) && user.role !== "admin") {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  try {
    if (body.action === "test" || body.action === "details") {
      if (!canEditSupplier(supplier, user, orgs)) {
        return Response.json({ error: "Ключи закреплены администратором" }, { status: 403 });
      }
      const next = await ensureRosskoDelivery(supplier);
      if (next.rosskoDeliveryId !== supplier.rosskoDeliveryId) {
        await upsertSupplier(next);
      }
      const details = await rosskoDetails(next);
      return Response.json({ details, supplier: next });
    }
    if (!isDeskRole(user.role)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    if (body.action === "search") {
      const result = await rosskoSearch(supplier, body.query || "");
      return Response.json(result);
    }
    if (body.action === "checkout") {
      const order = store.orders.find((item) => item.id === body.orderId);
      if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
      const lines = filterRosskoLines(order, supplier.id);
      if (lines.length === 0) {
        return Response.json({ error: "В заказе нет позиций Росско" }, { status: 400 });
      }
      const ready = await ensureRosskoDelivery(supplier);
      if (
        canEditSupplier(supplier, user, orgs) &&
        ready.rosskoDeliveryId !== supplier.rosskoDeliveryId
      ) {
        await upsertSupplier(ready);
      }
      const resolved = await rosskoResolveLines(ready, lines);
      const result = await rosskoCheckout(ready, {
        deliveryId: body.deliveryId || ready.rosskoDeliveryId || "",
        addressId: body.addressId || ready.rosskoAddressId,
        paymentId: body.paymentId || 1,
        contactName: body.contactName || "Менеджер",
        contactPhone: body.contactPhone || "+7",
        comment: body.comment || order.comment,
        deliveryParts: body.deliveryParts ?? true,
        parts: orderLinesToRosskoParts(resolved),
      });
      const updated: Order = {
        ...order,
        lines: order.lines.map((line) => resolved.find((item) => item.id === line.id) ?? line),
        status: result.success ? "sent" : order.status,
        externalIds: result.orderIds,
        externalStatus: result.success ? "отправлен в Росско" : "ошибка Росско",
        externalMessage: result.message || result.errors.map((item) => item.message).join("; "),
        updatedAt: new Date().toISOString(),
      };
      await upsertOrder(updated);
      return Response.json({ result, order: updated });
    }
    if (body.action === "orders") {
      const ids = store.orders.flatMap((item) => item.externalIds ?? []);
      const result = await rosskoOrders(supplier, ids);
      return Response.json(result);
    }
    return Response.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ошибка Росско" },
      { status: 502 },
    );
  }
}
