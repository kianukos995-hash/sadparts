import type { Client, PriceBand } from "@/lib/types";

export const DEFAULT_PRICE_BANDS: PriceBand[] = [
  { id: "band-0-300", min: 0, max: 300, markupPercent: 32 },
  { id: "band-300-550", min: 300, max: 550, markupPercent: 26 },
  { id: "band-550-1000", min: 550, max: 1000, markupPercent: 20 },
  { id: "band-1000-2750", min: 1000, max: 2750, markupPercent: 16 },
  { id: "band-2750-plus", min: 2750, max: null, markupPercent: 12 },
];

export function sanitizeBands(bands: PriceBand[] | undefined): PriceBand[] {
  const list = (bands ?? [])
    .map((band, index) => ({
      id: band.id?.trim() || `band-${index + 1}`,
      min: Math.max(0, Number(band.min) || 0),
      max:
        band.max == null || (band.max as unknown) === ""
          ? null
          : Math.max(0, Number(band.max) || 0),
      markupPercent: Math.min(500, Math.max(0, Number(band.markupPercent) || 0)),
    }))
    .sort((a, b) => a.min - b.min || (a.max ?? Infinity) - (b.max ?? Infinity));
  return list.length ? list : DEFAULT_PRICE_BANDS;
}

export function findBand(buy: number, bands: PriceBand[]) {
  const price = Number.isFinite(buy) ? buy : 0;
  const list = sanitizeBands(bands);
  return (
    list.find((band) => price >= band.min && (band.max == null || price < band.max)) ??
    list[list.length - 1] ??
    DEFAULT_PRICE_BANDS[DEFAULT_PRICE_BANDS.length - 1]
  );
}

export function markupForPrice(
  buy: number,
  bands: PriceBand[],
  fallback: number,
  client?: Client | null,
) {
  const band = findBand(buy, bands);
  const override = client?.bandMarkups?.[band.id];
  if (typeof override === "number" && Number.isFinite(override)) return override;
  return band.markupPercent || fallback;
}

export function formatBandLabel(band: PriceBand) {
  const min = Math.round(band.min);
  if (band.max == null) return `${min}+ ₽`;
  return `${min}–${Math.round(band.max)} ₽`;
}

export function guessPriceTitle(filename: string) {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || "Прайс";
}
