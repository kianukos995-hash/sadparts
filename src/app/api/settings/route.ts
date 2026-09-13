import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { maskToken, readSettings, writeSettings } from "@/lib/server-store";
import { getBotProfile } from "@/lib/telegram";
import { sanitizeBands } from "@/lib/price-bands";
import type { PublicSettings } from "@/lib/types";

function toPublic(settings: Awaited<ReturnType<typeof readSettings>>): PublicSettings {
  return {
    telegramConfigured: Boolean(settings.telegramToken.trim()),
    telegramUsername: settings.telegramUsername,
    telegramPolling: settings.telegramPolling,
    telegramTokenMasked: maskToken(settings.telegramToken),
    markupPercent: settings.markupPercent,
    moscowHubNote: settings.moscowHubNote,
    priceBands: settings.priceBands,
  };
}

export async function GET() {
  return Response.json(toPublic(await readSettings()));
}

export async function POST(request: NextRequest) {
  let body: {
    token?: string;
    polling?: boolean;
    clear?: boolean;
    markupPercent?: number;
    moscowHubNote?: string;
    priceBands?: { id: string; min: number; max: number | null; markupPercent: number }[];
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
  if (Array.isArray(body.priceBands)) {
    tradePatch.priceBands = sanitizeBands(body.priceBands);
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
