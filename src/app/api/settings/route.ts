import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { maskToken, readSettings, writeSettings } from "@/lib/server-store";
import { getBotProfile } from "@/lib/telegram";
import type { PublicSettings } from "@/lib/types";

function toPublic(settings: Awaited<ReturnType<typeof readSettings>>): PublicSettings {
  return {
    telegramConfigured: Boolean(settings.telegramToken.trim()),
    telegramUsername: settings.telegramUsername,
    telegramPolling: settings.telegramPolling,
    telegramTokenMasked: maskToken(settings.telegramToken),
  };
}

export async function GET() {
  return Response.json(toPublic(await readSettings()));
}

export async function POST(request: NextRequest) {
  let body: { token?: string; polling?: boolean; clear?: boolean };
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
  let token = current.telegramToken;
  if (typeof body.token === "string" && body.token.trim() && !body.token.includes("…")) {
    token = body.token.trim();
    try {
      const me = await getBotProfile(token);
      const next = await writeSettings({
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
    telegramPolling: body.polling ?? current.telegramPolling,
  });
  return Response.json(toPublic(next));
}
