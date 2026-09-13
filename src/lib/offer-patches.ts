import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Offer } from "@/lib/types";

const DIR = path.join(process.cwd(), "data", "patches");

export type OfferPatch = Partial<
  Pick<Offer, "displayName" | "crossOems" | "notes" | "applicability" | "name" | "brand" | "oem" | "category">
>;

type PatchFile = Record<string, OfferPatch>;

const cache = new Map<string, PatchFile>();

function filePath(supplierId: string) {
  return path.join(DIR, `${supplierId}.json`);
}

export async function readPatches(supplierId: string): Promise<PatchFile> {
  const hit = cache.get(supplierId);
  if (hit) return hit;
  try {
    const parsed = JSON.parse(await readFile(filePath(supplierId), "utf8")) as PatchFile;
    cache.set(supplierId, parsed);
    return parsed;
  } catch {
    const empty = {};
    cache.set(supplierId, empty);
    return empty;
  }
}

export async function writeOfferPatch(supplierId: string, offerId: string, patch: OfferPatch) {
  const current = { ...(await readPatches(supplierId)) };
  current[offerId] = { ...(current[offerId] ?? {}), ...patch };
  cache.set(supplierId, current);
  await mkdir(DIR, { recursive: true });
  await writeFile(filePath(supplierId), JSON.stringify(current), "utf8");
  return current[offerId];
}

export function applyPatch<T extends { id: string }>(offer: T, patches: PatchFile): T {
  const patch = patches[offer.id];
  return patch ? { ...offer, ...patch } : offer;
}
