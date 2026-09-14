import { NextRequest } from "next/server";
import {
  patchOffer,
  readSettings,
  readStore,
  removeClient,
  removeMoneyMovement,
  removeOrder,
  removeOrganization,
  removeSupplier,
  removeSupplierBill,
  replaceOffers,
  resetStore,
  upsertClient,
  upsertMoneyMovement,
  upsertOrder,
  upsertOrganization,
  upsertSupplier,
  upsertSupplierBill,
} from "@/lib/server-store";
import type {
  Client,
  ImportMode,
  MoneyMovement,
  Offer,
  Order,
  Organization,
  Supplier,
  SupplierBill,
  SyncLog,
} from "@/lib/types";
import { fail, requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { listAccessKeys } from "@/lib/auth-store";
import { findPriceOffer } from "@/lib/catalog-query";
import { publicStoreFor } from "@/lib/public-store";
import {
  canSeeMoney,
  canSeeSuppliers,
  clientNavOnly,
  clientVisibleTo,
  isDeskRole,
} from "@/lib/scope";
import { sellForViewer, viewerPriceContext } from "@/lib/viewer-price";

async function respond(
  user: Awaited<ReturnType<typeof requireUser>>,
  store?: Awaited<ReturnType<typeof readStore>>,
) {
  const snapshot = store ?? (await readStore());
  const [settings, keys] = await Promise.all([readSettings(), listAccessKeys()]);
  return Response.json(publicStoreFor(user, snapshot, settings, keys));
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const desk = isDeskRole(user.role);
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
    organization?: Organization;
    organizationId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  try {
    if (body.action === "upsertSupplier" && body.supplier) {
      if (!canSeeSuppliers(user.role)) {
        return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      if (!admin && (body.supplier.apiKey || body.supplier.apiKey2)) {
        const current = (await readStore()).suppliers.find((item) => item.id === body.supplier!.id);
        body.supplier = {
          ...body.supplier,
          apiKey: current?.apiKey ?? "",
          apiKey2: current?.apiKey2 ?? "",
        };
      }
      return respond(user, await upsertSupplier(body.supplier));
    }
    if (body.action === "removeSupplier" && body.supplierId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return respond(user, await removeSupplier(body.supplierId));
    }
    if (body.action === "replaceOffers" && body.supplierId && body.offers && body.log) {
      if (!canSeeSuppliers(user.role)) {
        return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      return respond(
        user,
        await replaceOffers(body.supplierId, body.offers, body.log, body.mode ?? "replace"),
      );
    }
    if (body.action === "patchOffer" && body.offerId && body.patch) {
      if (!desk) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return respond(user, await patchOffer(body.offerId, body.patch));
    }
    if (body.action === "upsertOrganization" && body.organization) {
      const store = await readStore();
      if (admin) {
        return respond(user, await upsertOrganization(body.organization));
      }
      if (user.role === "organization" && body.organization.id === user.organizationId) {
        const current = store.organizations.find((item) => item.id === body.organization!.id);
        if (!current) return Response.json({ error: "Организация не найдена" }, { status: 404 });
        const maxMarkup = current.maxMarkup;
        const nextBands = (body.organization.priceBands ?? current.priceBands ?? []).map((band) => ({
          ...band,
          markupPercent:
            maxMarkup == null ? band.markupPercent : Math.min(band.markupPercent, maxMarkup),
        }));
        const markup =
          body.organization.markupPercent == null
            ? current.markupPercent
            : maxMarkup == null
              ? body.organization.markupPercent
              : Math.min(body.organization.markupPercent, maxMarkup);
        return respond(
          user,
          await upsertOrganization({
            ...current,
            name: body.organization.name || current.name,
            phone: body.organization.phone ?? current.phone,
            inn: body.organization.inn ?? current.inn,
            notes: body.organization.notes ?? current.notes,
            priceBands: nextBands,
            markupPercent: markup,
            bandMarkups: body.organization.bandMarkups ?? current.bandMarkups,
          }),
        );
      }
      return Response.json({ error: "Только администратор создаёт организации" }, { status: 403 });
    }
    if (body.action === "removeOrganization" && body.organizationId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return respond(user, await removeOrganization(body.organizationId));
    }
    if (body.action === "upsertClient" && body.client) {
      const store = await readStore();
      const keys = await listAccessKeys();
      const existing = store.clients.find((item) => item.id === body.client!.id);
      if (!desk && user.role !== "client") {
        return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      if (user.role === "client") {
        body.client = {
          ...body.client,
          ownerUserId: user.id,
          issuedByUserId: existing?.issuedByUserId || user.id,
          organizationId: existing?.organizationId,
          markupPercent: existing?.markupPercent,
          discountPercent: existing?.discountPercent ?? body.client.discountPercent,
          maxMarkup: existing?.maxMarkup,
          accessKey: existing?.accessKey,
        };
        if (existing && existing.ownerUserId !== user.id && existing.id !== user.clientId) {
          return Response.json({ error: "Чужая карточка" }, { status: 403 });
        }
      } else if (user.role === "organization" || user.role === "manager") {
        if (existing && !clientVisibleTo(user, existing, keys)) {
          return Response.json({ error: "Чужая карточка" }, { status: 403 });
        }
        const org = store.organizations.find((item) => item.id === user.organizationId);
        body.client = {
          ...body.client,
          ownerUserId: existing?.ownerUserId || user.id,
          issuedByUserId: existing?.issuedByUserId || user.id,
          organizationId: existing?.organizationId || user.organizationId,
          maxMarkup: existing?.maxMarkup ?? org?.maxMarkup,
        };
        if (org?.maxMarkup != null && body.client.markupPercent != null) {
          body.client.markupPercent = Math.min(body.client.markupPercent, org.maxMarkup);
        }
      } else if (!admin && existing && !clientVisibleTo(user, existing, keys)) {
        return Response.json({ error: "Чужая карточка" }, { status: 403 });
      }
      return respond(user, await upsertClient(body.client));
    }
    if (body.action === "removeClient" && body.clientId) {
      const store = await readStore();
      const keys = await listAccessKeys();
      const existing = store.clients.find((item) => item.id === body.clientId);
      if (!existing) return Response.json({ error: "Клиент не найден" }, { status: 404 });
      const allowed =
        admin ||
        existing.ownerUserId === user.id ||
        (user.role === "organization" && existing.organizationId === user.organizationId);
      if (!allowed) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      if (!clientVisibleTo(user, existing, keys) && !admin) {
        return Response.json({ error: "Чужая карточка" }, { status: 403 });
      }
      return respond(user, await removeClient(body.clientId));
    }
    if (body.action === "upsertOrder" && body.order) {
      const store = await readStore();
      const settings = await readSettings();
      const keys = await listAccessKeys();
      let order = body.order;
      if (clientNavOnly(user.role)) {
        const clientId = user.clientId || "";
        if (order.clientId && order.clientId !== clientId) {
          return Response.json({ error: "Нельзя писать в чужой заказ" }, { status: 403 });
        }
        order = { ...order, clientId };
        const existing = store.orders.find((item) => item.id === order.id);
        if (existing && existing.clientId !== clientId) {
          return Response.json({ error: "Чужой заказ" }, { status: 403 });
        }
      } else if (user.role === "organization" || user.role === "manager") {
        const client = store.clients.find((item) => item.id === order.clientId);
        if (client && !clientVisibleTo(user, client, keys)) {
          return Response.json({ error: "Чужой клиент" }, { status: 403 });
        }
      }
      const client = store.clients.find((item) => item.id === order.clientId);
      const ctx = viewerPriceContext(user, store, settings);
      const now = new Date().toISOString();
      const lines = [];
      for (const line of order.lines) {
        const real =
          store.offers.find((item) => item.id === line.offerId) ??
          (await findPriceOffer(store.suppliers, store.offers, line.offerId));
        const buy = real?.price ?? line.buyPrice;
        lines.push({
          ...line,
          buyPrice: buy,
          warehouse: line.warehouse || real?.warehouse || "",
          snapshotSell: sellForViewer(buy, ctx, client),
          snapshotStock: line.snapshotStock ?? real?.stock,
          snapshotAt: line.snapshotAt ?? now,
        });
      }
      order = {
        ...order,
        lines,
        createdByUserId: order.createdByUserId || user.id,
        organizationId: order.organizationId || user.organizationId || client?.organizationId,
      };
      const saved = await upsertOrder(order);
      await logActivity({
        userId: user.id,
        email: user.email,
        role: user.role,
        clientId: order.clientId,
        organizationId: order.organizationId,
        issuedByUserId: user.issuedByUserId,
        action: order.status === "draft" ? "cart" : "order",
        detail: `${order.status === "draft" ? "Корзина" : "Заказ"} ${order.number}, ${order.lines.length} поз., статус ${order.status}`,
        orderId: order.id,
      });
      return respond(user, saved);
    }
    if (body.action === "removeOrder" && body.orderId) {
      const store = await readStore();
      const existing = store.orders.find((item) => item.id === body.orderId);
      if (!existing) return Response.json({ error: "Заказ не найден" }, { status: 404 });
      if (clientNavOnly(user.role)) {
        if (existing.status !== "draft" || existing.clientId !== user.clientId) {
          return Response.json({ error: "Можно удалить только свой черновик" }, { status: 403 });
        }
      } else if (!desk) {
        return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      return respond(user, await removeOrder(body.orderId));
    }
    if (body.action === "upsertMoneyMovement" && body.movement) {
      if (!canSeeMoney(user.role)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return respond(user, await upsertMoneyMovement(body.movement));
    }
    if (body.action === "removeMoneyMovement" && body.movementId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return respond(user, await removeMoneyMovement(body.movementId));
    }
    if (body.action === "upsertSupplierBill" && body.bill) {
      if (!canSeeMoney(user.role)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return respond(user, await upsertSupplierBill(body.bill));
    }
    if (body.action === "removeSupplierBill" && body.billId) {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return respond(user, await removeSupplierBill(body.billId));
    }
    if (body.action === "reset") {
      if (!admin) return Response.json({ error: "Только администратор" }, { status: 403 });
      return respond(user, await resetStore());
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить";
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
