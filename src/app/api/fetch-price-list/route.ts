import { NextRequest } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

type AuthMode = "bearer" | "header" | "query";

interface FetchBody {
  url?: string;
  apiKey?: string;
  authMode?: AuthMode;
  authHeaderName?: string;
  authQueryParam?: string;
}

function isPrivateAddress(ip: string) {
  if (ip === "127.0.0.1" || ip === "::1") return false;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
    return true;
  }
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd")) return true;
  return false;
}

async function assertSafeUrl(raw: string, requestUrl: URL) {
  let target: URL;
  try {
    target = raw.startsWith("/")
      ? new URL(raw, `${requestUrl.protocol}//${requestUrl.host}`)
      : new URL(raw);
  } catch {
    throw new Error("Некорректный URL прайс-листа");
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Разрешены только HTTP и HTTPS");
  }

  const host = target.hostname.toLowerCase();
  if (host === "metadata.google.internal" || host.endsWith(".internal")) {
    throw new Error("Этот хост недоступен для загрузки");
  }

  const sameHost = host === requestUrl.hostname;
  if (!sameHost) {
    const addresses =
      isIP(host) > 0 ? [host] : (await lookup(host, { all: true })).map((item) => item.address);
    if (addresses.some(isPrivateAddress)) {
      throw new Error("Запросы к частным сетям запрещены");
    }
  }

  return target;
}

function buildHeaders(body: FetchBody) {
  const headers = new Headers({ Accept: "application/json, text/plain;q=0.8, */*;q=0.5" });
  const key = body.apiKey?.trim();
  if (!key) return headers;
  if (body.authMode === "bearer") {
    headers.set("Authorization", `Bearer ${key}`);
  } else if (body.authMode === "header") {
    headers.set(body.authHeaderName?.trim() || "X-Api-Key", key);
  }
  return headers;
}

export async function POST(request: NextRequest) {
  let body: FetchBody;
  try {
    body = (await request.json()) as FetchBody;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }

  if (!body.url?.trim()) {
    return Response.json({ error: "Укажите URL API поставщика" }, { status: 400 });
  }

  let target: URL;
  try {
    target = await assertSafeUrl(body.url.trim(), request.nextUrl);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Некорректный URL" },
      { status: 400 },
    );
  }

  if (body.authMode === "query" && body.apiKey?.trim()) {
    target.searchParams.set(body.authQueryParam?.trim() || "apikey", body.apiKey.trim());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      method: "GET",
      headers: buildHeaders(body),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return Response.json(
        { error: `Поставщик вернул редирект (${response.status})` },
        { status: 502 },
      );
    }

    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) {
      return Response.json({ error: "Ответ поставщика слишком большой" }, { status: 413 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return Response.json({ error: "Ответ поставщика слишком большой" }, { status: 413 });
    }

    const text = buffer.toString("utf8");
    if (!response.ok) {
      return Response.json(
        {
          error: `Поставщик ответил ${response.status}`,
          details: text.slice(0, 400),
        },
        { status: 502 },
      );
    }

    try {
      return Response.json({ payload: JSON.parse(text) as unknown });
    } catch {
      return Response.json(
        { error: "Ответ поставщика не является JSON" },
        { status: 502 },
      );
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Превышено время ожидания ответа поставщика"
        : "Не удалось связаться с API поставщика";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
