import { NextRequest } from "next/server";
import { inspectOrderPrices, needsReprice, suggestFills } from "@/lib/reprice";
import { readSettings, readStore } from "@/lib/server-store";
import { fail, requireUser } from "@/lib/session";
import { bandsForRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return Response.json({ error: "Нет заказа" }, { status: 400 });
    const store = await readStore();
    const settings = await readSettings();
    const order = store.orders.find((item) => item.id === id);
    if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
    if ((user.role === "client" || user.role === "guest") && user.clientId && order.clientId !== user.clientId) {
      return Response.json({ error: "Чужой заказ" }, { status: 403 });
    }
    const client = store.clients.find((item) => item.id === order.clientId);
    const bands = bandsForRole(
      user.role,
      settings.priceBands,
      settings.guestPriceBands,
      settings.managerPriceBands,
    );
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
      changes,
      fills,
    });
  } catch (error) {
    return fail(error);
  }
}
