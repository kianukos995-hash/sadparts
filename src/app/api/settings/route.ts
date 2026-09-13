import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { maskToken, readSettings, writeSettings } from "@/lib/server-store";
import { getBotProfile } from "@/lib/telegram";
import { sanitizeBands } from "@/lib/price-bands";
import { defaultGuestBands } from "@/lib/roles";
import type { PublicSettings } from "@/lib/types";
import { fail, requireUser } from "@/lib/session";

function toPublic(settings: Awaited<ReturnType<typeof readSettings>>): PublicSettings {
  return {
    telegramConfigured: Boolean(settings.telegramToken.trim()),
    telegramUsername: settings.telegramUsername,
    telegramPolling: settings.telegramPolling,
    telegramTokenMasked: maskToken(settings.telegramToken),
    markupPercent: settings.markupPercent,
    moscowHubNote: settings.moscowHubNote,
    priceBands: settings.priceBands,
    guestPriceBands: settings.guestPriceBands?.length ? settings.guestPriceBands : defaultGuestBands(),
    managerPriceBands: settings.managerPriceBands?.length ? settings.managerPriceBands : settings.priceBands,
    sellerTitle: settings.sellerTitle,
    sellerAddress: settings.sellerAddress,
    vatPercent: settings.vatPercent,
    telegramNotifyChatId: settings.telegramNotifyChatId,
    telegramChats: settings.telegramChats ?? [],
  };
}

export async function GET() {
  return Response.json(toPublic(await readSettings()));
}

export async function POST(request: NextRequest) {
  try {
    await requireUser(request, ["admin"]);
  } catch (error) {
    return fail(error);
  }
  let body: {
    token?: string;
    polling?: boolean;
    clear?: boolean;
    markupPercent?: number;
    moscowHubNote?: string;
    priceBands?: { id: string; min: number; max: number | null; markupPercent: number }[];
    guestPriceBands?: { id: string; min: number; max: number | null; markupPercent: number }[];
    managerPriceBands?: { id: string; min: number; max: number | null; markupPercent: number }[];
    sellerTitle?: string;
    sellerAddress?: string;
    vatPercent?: number;
    telegramNotifyChatId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  if (body.clear) {
    const next = await writeSettings({
      telegramToken: "",
      telegramUsername: "",
      telegramOffset: 0,
    });
    return Response.json(toPublic(next));
  }

  const current = await readSettings();
  const tradePatch: Partial<typeof current> = {};
  if (typeof body.markupPercent === "number" && Number.isFinite(body.markupPercent)) {
    tradePatch.markupPercent = Math.min(500, Math.max(0, body.markupPercent));
  }
  if (typeof body.moscowHubNote === "string") {
    tradePatch.moscowHubNote = body.moscowHubNote;
  }
  if (typeof body.sellerTitle === "string") {
    tradePatch.sellerTitle = body.sellerTitle;
  }
  if (typeof body.sellerAddress === "string") {
    tradePatch.sellerAddress = body.sellerAddress;
  }
  if (typeof body.vatPercent === "number" && Number.isFinite(body.vatPercent)) {
    tradePatch.vatPercent = Math.min(22, Math.max(0, body.vatPercent));
  }
  if (typeof body.telegramNotifyChatId === "string") {
    tradePatch.telegramNotifyChatId = body.telegramNotifyChatId.trim();
  }
  if (Array.isArray(body.priceBands)) {
    tradePatch.priceBands = sanitizeBands(body.priceBands);
  }
  if (Array.isArray(body.guestPriceBands)) {
    tradePatch.guestPriceBands = sanitizeBands(body.guestPriceBands);
  }
  if (Array.isArray(body.managerPriceBands)) {
    tradePatch.managerPriceBands = sanitizeBands(body.managerPriceBands);
  }

  let token = current.telegramToken;
  if (typeof body.token === "string" && body.token.trim() && !body.token.includes("…")) {
    token = body.token.trim();
    try {
      const me = await getBotProfile(token);
      const next = await writeSettings({
        ...tradePatch,
        telegramToken: token,
        telegramUsername: me.username ?? "",
        telegramSecret: current.telegramSecret || randomBytes(16).toString("hex"),
        telegramPolling: body.polling ?? current.telegramPolling,
        telegramOffset: 0,
      });
      return Response.json(toPublic(next));
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Не удалось проверить бота" },
        { status: 400 },
      );
    }
  }

  const next = await writeSettings({
    ...tradePatch,
    telegramPolling: body.polling ?? current.telegramPolling,
  });
  return Response.json(toPublic(next));
}
