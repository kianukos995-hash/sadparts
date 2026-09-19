import { NextRequest } from "next/server";
import { inspectOrderPrices, lineNeedsReprice, needsReprice, suggestFills } from "@/lib/reprice";
import { readSettings, readStore } from "@/lib/server-store";
import { fail, requireUser } from "@/lib/session";
import { bandsForRole } from "@/lib/roles";
import { canSeeCost, scopedOrders } from "@/lib/scope";
import { listAccessKeys } from "@/lib/auth-store";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return Response.json({ error: "Нет заказа" }, { status: 400 });
    const store = await readStore();
    const settings = await readSettings();
    const keys = await listAccessKeys();
    const allowed = scopedOrders(user, store.orders, store.clients, keys);
    const order = allowed.find((item) => item.id === id);
    if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
    const client = store.clients.find((item) => item.id === order.clientId);
    const bands = bandsForRole(
      user.role,
      settings.priceBands,
      settings.guestPriceBands,
      settings.managerPriceBands,
    );
    const seeCost = canSeeCost(user.role, user.seeCost);
    const changes = await inspectOrderPrices(
      order,
      store.suppliers,
      store.offers,
      bands,
      settings.markupPercent,
      client,
    );
    const fills = await suggestFills(
      order.lines,
      store.suppliers,
      store.offers,
      bands,
      settings.markupPercent,
      client,
    );
    return Response.json({
      needsReprice: needsReprice(changes),
      changes: changes.map((item) => ({
        ...item,
        current: item.current
          ? seeCost
            ? item.current
            : { ...item.current, price: item.currentSell ?? item.current.price, costPrice: undefined }
          : null,
        currentBuy: seeCost ? item.currentBuy : undefined,
        line: seeCost
          ? item.line
          : { ...item.line, buyPrice: item.line.snapshotSell ?? item.line.buyPrice },
        problem: lineNeedsReprice(item),
      })),
      fills: fills.map((fill) => ({
        ...fill,
        offers: fill.offers.map((part) => ({
          ...part,
          offer: seeCost ? part.offer : { ...part.offer, price: part.sell, costPrice: undefined },
        })),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}
