import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeSku } from "@/lib/format";
import { isDisplayableImage, isImageFilename, isRemoteRef, mediaBasename, uniqueUrls } from "@/lib/media";
import type { ZipEntry } from "@/lib/zip";

const ROOT = path.join(process.cwd(), "data", "media");
const MAX_FILES = 8_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export function sanitizeRelative(relative: string) {
  return (
    relative
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .split("/")
      .filter((part) => part && part !== "." && part !== "..")
      .join("/") || "file.bin"
  );
}

export function publicMediaPrefix(supplierId: string) {
  return `/api/media/${encodeURIComponent(supplierId)}`;
}

export function publicMediaUrl(supplierId: string, relative: string) {
  const safe = sanitizeRelative(relative);
  return `${publicMediaPrefix(supplierId)}/${safe.split("/").map(encodeURIComponent).join("/")}`;
}

export async function writeMediaFile(supplierId: string, relative: string, body: Buffer) {
  const safe = sanitizeRelative(relative);
  const dest = path.join(ROOT, supplierId, safe);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
  return publicMediaUrl(supplierId, safe);
}

export async function readMediaFile(supplierId: string, relative: string) {
  const root = path.resolve(ROOT, supplierId);
  const dest = path.resolve(root, sanitizeRelative(relative));
  if (dest !== root && !dest.startsWith(`${root}${path.sep}`)) {
    throw new Error("Некорректный путь");
  }
  return readFile(dest);
}

export function mediaContentType(relative: string) {
  const ext = (relative.split(".").pop() ?? "").toLowerCase();
  return MIME[ext] || "application/octet-stream";
}

export interface MediaIndex {
  byName: Map<string, string>;
  bySku: Map<string, string>;
  saved: number;
  fonts: number;
}

export async function saveZipMedia(supplierId: string, entries: ZipEntry[]): Promise<MediaIndex> {
  const byName = new Map<string, string>();
  const bySku = new Map<string, string>();
  let saved = 0;
  let fonts = 0;
  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (/\.(ttf|otf|woff2?|eot)$/i.test(lower)) {
      fonts += 1;
      continue;
    }
    if (!isImageFilename(entry.name) || entry.body.length === 0 || entry.body.length > MAX_FILE_BYTES) {
      continue;
    }
    if (saved >= MAX_FILES) break;
    const url = await writeMediaFile(supplierId, entry.name, entry.body);
    const base = mediaBasename(entry.name);
    byName.set(base, url);
    byName.set(base.replace(/\.[^.]+$/, ""), url);
    const sku = normalizeSku(base.replace(/\.[^.]+$/, ""));
    if (sku.length >= 3) bySku.set(sku, url);
    saved += 1;
  }
  return { byName, bySku, saved, fonts };
}

export function resolveMediaRef(ref: string, index: MediaIndex) {
  const trimmed = ref.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("/api/media/") ||
    trimmed.startsWith("/samples/") ||
    trimmed.startsWith("data:image/") ||
    /^(https?:)?\/\//i.test(trimmed)
  ) {
    return trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  }
  const base = mediaBasename(trimmed);
  return index.byName.get(base) || index.byName.get(base.replace(/\.[^.]+$/, "")) || trimmed;
}

export function attachOfferMedia(
  images: string[] | undefined,
  sku: string,
  index: MediaIndex | undefined,
) {
  const resolved = (images ?? []).map((ref) => (index ? resolveMediaRef(ref, index) : ref));
  const fromSku = index?.bySku.get(normalizeSku(sku.split("@")[0]));
  return uniqueUrls(fromSku ? [...resolved, fromSku] : resolved).filter(
    (url) => isDisplayableImage(url) || isRemoteRef(url),
  );
}
