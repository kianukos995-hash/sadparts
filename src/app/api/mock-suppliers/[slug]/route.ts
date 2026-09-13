import { NextRequest } from "next/server";
import { DEMO_KEYS } from "@/lib/constants";
import { autopiterPayload, existPayload, rosskoPayload } from "@/lib/seed";

const PAYLOADS = {
  rossko: rosskoPayload,
  autopiter: autopiterPayload,
  exist: existPayload,
} as const;

function readKey(request: NextRequest) {
  const headerKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const queryKey =
    request.nextUrl.searchParams.get("key") ??
    request.nextUrl.searchParams.get("apikey") ??
    request.nextUrl.searchParams.get("token") ??
    "";
  return (headerKey || queryKey).trim();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const payloadFactory = PAYLOADS[slug as keyof typeof PAYLOADS];
  if (!payloadFactory) {
    return Response.json({ error: "Неизвестный демо-поставщик" }, { status: 404 });
  }

  const expected = DEMO_KEYS[slug as keyof typeof DEMO_KEYS];
  const provided = readKey(request);
  if (!provided) {
    return Response.json({ error: "API-ключ не передан" }, { status: 401 });
  }
  if (provided !== expected) {
    return Response.json({ error: "Неверный API-ключ" }, { status: 403 });
  }

  return Response.json(payloadFactory());
}
