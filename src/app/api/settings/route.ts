import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { readSettings, writeSettings } from "@/lib/server-store";
import { getBotProfile } from "@/lib/telegram";
import { sanitizeBands } from "@/lib/price-bands";
import { fail, requireUser } from "@/lib/session";
import { readStore } from "@/lib/server-store";
import { organizationOf, publicSettingsFor } from "@/lib/viewer-price";
import { canSeeSettings } from "@/lib/scope";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const [settings, store] = await Promise.all([readSettings(), readStore()]);
    const org = organizationOf(user, store);
    return Response.json(publicSettingsFor(user, settings, org));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!canSeeSettings(user.role)) {
      return fail(Object.assign(new Error("Недостаточно прав"), { status: 403 }));
    }
    if (user.role !== "admin") {
      return fail(Object.assign(new Error("Глобальные настройки только у администратора"), { status: 403 }));
    }
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
    priceMailboxImapHost?: string;
    priceMailboxImapPort?: number;
    priceMailboxImapUser?: string;
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
    const store = await readStore();
    return Response.json(publicSettingsFor({ id: "usr-admin", email: "", name: "", role: "admin", status: "active" }, next, organizationOf(null, store)));
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
  if (typeof body.priceMailboxImapHost === "string") {
    tradePatch.priceMailboxImapHost = body.priceMailboxImapHost.trim();
  }
  if (typeof body.priceMailboxImapUser === "string") {
    tradePatch.priceMailboxImapUser = body.priceMailboxImapUser.trim();
  }
  if (typeof body.priceMailboxImapPort === "number" && Number.isFinite(body.priceMailboxImapPort)) {
    tradePatch.priceMailboxImapPort = body.priceMailboxImapPort;
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

  const user = await requireUser(request);
  const store = await readStore();
  const org = organizationOf(user, store);

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
      return Response.json(publicSettingsFor(user, next, org));
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
  return Response.json(publicSettingsFor(user, next, org));
}
