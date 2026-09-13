import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export type AuthMode = "bearer" | "header" | "query";

export interface FetchFeedInput {
  url: string;
  apiKey?: string;
  apiKey2?: string;
  authMode?: AuthMode;
  authHeaderName?: string;
  authQueryParam?: string;
  origin: URL;
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

export async function resolveSafeUrl(raw: string, origin: URL) {
  let target: URL;
  try {
    target = raw.startsWith("/") ? new URL(raw, `${origin.protocol}//${origin.host}`) : new URL(raw);
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
  const sameHost = host === origin.hostname;
  if (!sameHost) {
    const addresses =
      isIP(host) > 0 ? [host] : (await lookup(host, { all: true })).map((item) => item.address);
    if (addresses.some(isPrivateAddress)) {
      throw new Error("Запросы к частным сетям запрещены");
    }
  }
  return target;
}

function buildHeaders(input: FetchFeedInput) {
  const headers = new Headers({
    Accept: "application/json, application/xml, text/csv, text/plain;q=0.8, */*;q=0.5",
  });
  const key = input.apiKey?.trim();
  const key2 = input.apiKey2?.trim();
  if (key) {
    if (input.authMode === "bearer") headers.set("Authorization", `Bearer ${key}`);
    else if (input.authMode === "header") headers.set(input.authHeaderName?.trim() || "X-Api-Key", key);
  }
  if (key2) headers.set("X-Api-Key-2", key2);
  return headers;
}

export async function fetchFeed(input: FetchFeedInput) {
  const target = await resolveSafeUrl(input.url.trim(), input.origin);
  if (input.authMode === "query" && input.apiKey?.trim()) {
    target.searchParams.set(input.authQueryParam?.trim() || "apikey", input.apiKey.trim());
  }
  if (input.authMode === "query" && input.apiKey2?.trim()) {
    target.searchParams.set("key2", input.apiKey2.trim());
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(target, {
      method: "GET",
      headers: buildHeaders(input),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`Источник вернул редирект (${response.status})`);
    }
    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_BYTES) throw new Error("Ответ слишком большой");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) throw new Error("Ответ слишком большой");
    const text = buffer.toString("utf8");
    if (!response.ok) {
      throw new Error(`Источник ответил ${response.status}`);
    }
    return {
      url: target.toString(),
      contentType: response.headers.get("content-type") ?? "",
      body: text,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Превышено время ожидания ответа");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
