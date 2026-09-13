import { normalizeSku } from "@/lib/format";

/** Local analog families (stand-in until TecDoc / Laximo / ABCP is connected). */
export const OEM_FAMILIES: string[][] = [
  ["4E0698151C", "4E0698151B"],
  ["8E0698451A", "8E0698451B"],
  ["06D115562", "06A115561B"],
  ["8E1955425", "8E1955425A"],
  ["06B109243C", "06B109119C"],
  ["8E0615301P", "4E0615301E"],
];

export function catalogCrosses(oem: string): string[] {
  const normalized = normalizeSku(oem);
  if (!normalized) return [];
  const family = OEM_FAMILIES.find((group) =>
    group.some((item) => normalizeSku(item) === normalized),
  );
  if (!family) return [];
  return family.map(normalizeSku).filter((item) => item !== normalized);
}

export function mergeCrosses(oem: string, extra: string[] = []): string[] {
  const merged = [...catalogCrosses(oem), ...extra.map(normalizeSku)].filter(Boolean);
  return Array.from(new Set(merged));
}
