import type { ColumnMap } from "@/lib/types";
import { stringifyCell } from "@/lib/json-path";
import { isPhotoHeader } from "@/lib/media";

const SKIP = new Set([
  "",
  "sku",
  "артикул",
  "partnumber",
  "brand",
  "бренд",
  "name",
  "описание",
  "наименование",
  "price",
  "цена",
  "ценаруб",
  "stock",
  "наличие",
  "count",
  "oem",
  "оемномер",
]);

export const SPEC_LABELS: Record<string, string> = {
  "Вес/Объем": "Вес / объём",
  Применимость: "Применимость",
  "Каталожный номер": "Каталожный номер",
  "Вендор-код": "Вендор-код",
  ТНВЭД: "ТН ВЭД",
  "ОКПД 2": "ОКПД 2",
  "Подключен к ЧЗ": "Честный знак",
  "Номер сертификата ЕАС": "Сертификат ЕАС",
  "Ссылка ФГИС": "Ссылка ФГИС",
  "Базовая цена, руб.": "Базовая цена",
  guid: "GUID",
  Номенклатура: "Номенклатура",
};

function headerKey(value: string) {
  return value.toLowerCase().replace(/[\s._"'-]+/g, "");
}

export function extractSpecs(row: Record<string, unknown>, columnMap: ColumnMap): Record<string, string> {
  const used = new Set(
    Object.values(columnMap)
      .filter(Boolean)
      .map((item) => headerKey(item)),
  );
  used.add("артикул");
  used.add("бренд");
  used.add("описание");
  used.add("ценаруб");
  used.add("наличие");
  used.add("кратностьотгрузки");
  used.add("срокпоставкидн");
  const specs: Record<string, string> = {};
  for (const [raw, value] of Object.entries(row)) {
    const key = headerKey(raw);
    if (!key || used.has(key) || SKIP.has(key) || isPhotoHeader(raw)) continue;
    const text = stringifyCell(value).trim();
    if (!text || text === "0") continue;
    specs[raw.replace(/^"|"$/g, "").trim()] = text;
  }
  return specs;
}

export function specEntries(specs?: Record<string, string>) {
  return Object.entries(specs ?? {}).filter(([, value]) => value.trim());
}
