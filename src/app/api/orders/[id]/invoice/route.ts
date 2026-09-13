import { NextRequest } from "next/server";
import { buildClientInvoice } from "@/lib/invoice";
import { readSettings, readStore } from "@/lib/server-store";

function disposition(filename: string) {
  const ascii = filename.replace(/[^\w.\-]+/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await readStore();
  const order = store.orders.find((item) => item.id === id);
  if (!order) return Response.json({ error: "Заказ не найден" }, { status: 404 });
  const client = store.clients.find((item) => item.id === order.clientId);
  const settings = await readSettings();
  const invoice = await buildClientInvoice(order, client, settings);
  return new Response(invoice.buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": disposition(invoice.filename),
      "Cache-Control": "no-store",
    },
  });
}
