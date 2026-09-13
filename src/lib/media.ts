import { stringifyCell } from "@/lib/json-path";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)(\?|#|$)/i;
const PHOTO_HEADER =
  /фото|картинк|изображен|image|img|photo|picture|picturl|thumbnail|thumb|рисунок|иллюстрац|mediaurl|photourl/i;
const IMAGE_PATH = /\/(photo|photos|image|images|img|pictures|media|preview)\//i;
function urlMatches(text: string) {
  return text.match(/(?:https?:)?\/\/[^\s<>"']+|www\.[^\s<>"']+/gi);
}

export function uniqueUrls(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function isPhotoHeader(header: string) {
  return PHOTO_HEADER.test(header);
}

export function isRemoteRef(value: string) {
  return /^(https?:)?\/\//i.test(value.trim()) || /^www\./i.test(value.trim());
}

export function normalizeRemote(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return trimmed;
}

export function isImageFilename(name: string) {
  return IMAGE_EXT.test(name.split(/[\\/]/).pop() ?? name);
}

export function isDisplayableImage(url: string) {
  const value = url.trim();
  if (!value) return false;
  if (value.startsWith("data:image/")) return true;
  if (value.startsWith("/api/media/") || value.startsWith("/samples/")) return true;
  if (isRemoteRef(value)) {
    const normalized = normalizeRemote(value);
    return IMAGE_EXT.test(normalized.split("?")[0] ?? "") || IMAGE_PATH.test(normalized);
  }
  return false;
}

export function looksLikeImageRef(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return true;
  if (isRemoteRef(trimmed)) return isDisplayableImage(normalizeRemote(trimmed));
  return isImageFilename(trimmed);
}

export function splitMediaRefs(value: string) {
  const chunks = value
    .split(/[\n|;]+/)
    .flatMap((part) => part.split(/,(?=\s*(https?:|www\.|\/\/))/i))
    .map((item) => item.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const chunk of chunks) {
    const urls = urlMatches(chunk);
    if (urls?.length) {
      out.push(...urls);
      const rest = chunk.replace(/(?:https?:)?\/\/[^\s<>"']+|www\.[^\s<>"']+/gi, "").trim();
      if (rest && looksLikeImageRef(rest)) out.push(rest);
    } else {
      out.push(chunk);
    }
  }
  return out;
}

export function collectRowImages(row: Record<string, unknown>) {
  const images: string[] = [];
  const links: string[] = [];
  for (const [header, raw] of Object.entries(row)) {
    const text = stringifyCell(raw).trim();
    if (!text) continue;
    const photoCol = isPhotoHeader(header);
    for (const part of splitMediaRefs(text)) {
      if (isRemoteRef(part)) {
        const url = normalizeRemote(part);
        if (isDisplayableImage(url) || photoCol) images.push(url);
        else if (photoCol || /^https?:/i.test(url)) links.push(url);
      } else if (looksLikeImageRef(part) || photoCol) {
        images.push(part);
      }
    }
  }
  return { images: uniqueUrls(images), links: uniqueUrls(links) };
}

export function mediaBasename(ref: string) {
  return ref.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
}
