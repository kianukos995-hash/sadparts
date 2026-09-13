import { NextRequest } from "next/server";
import { removeSupplier, replaceOffers, resetStore, upsertSupplier } from "@/lib/server-store";
import type { ImportMode, Offer, Supplier, SyncLog } from "@/lib/types";

export async function POST(request: NextRequest) {
  let body: {
    action?: string;
    supplier?: Supplier;
    supplierId?: string;
    offers?: Offer[];
    log?: SyncLog;
    mode?: ImportMode;
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
  if (body.action === "reset") {
    return Response.json(await resetStore());
  }
  return Response.json({ error: "Неизвестное действие" }, { status: 400 });
}
