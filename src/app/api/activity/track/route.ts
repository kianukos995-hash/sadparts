import { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { currentUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    detail?: string;
    path?: string;
    sku?: string;
    brand?: string;
    offerId?: string;
    orderId?: string;
    buyPrice?: number;
    sellPrice?: number;
    stock?: number;
    deliveryDays?: number;
  };
  if (!body.action) return Response.json({ ok: false }, { status: 400 });
  await logActivity({
    userId: user?.id,
    email: user?.email,
    role: user?.role,
    clientId: user?.clientId,
    organizationId: user?.organizationId,
    issuedByUserId: user?.issuedByUserId,
    action: body.action,
    detail: body.detail ?? body.action,
    path: body.path,
    sku: body.sku,
    brand: body.brand,
    offerId: body.offerId,
    orderId: body.orderId,
    buyPrice: user?.role === "admin" ? body.buyPrice : undefined,
    sellPrice: body.sellPrice,
    stock: body.stock,
    deliveryDays: body.deliveryDays,
  });
  return Response.json({ ok: true });
}
