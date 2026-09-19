import { emptySupplierFromPreset, matchPreset, presetById, SUPPLIER_PRESETS } from "../src/lib/supplier-presets";
import { buildSimpleEml, matchSupplierFromEmail, parseEml, priceAttachments } from "../src/lib/email-price";
import { DEFAULT_COLUMN_MAP, type Supplier } from "../src/lib/types";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const names = [
  "AD SMARTEC",
  "ADEO.PRO",
  "AFD PARTS",
  "АГАНТ",
  "AHREM",
  "ARKOT",
  "AMB-Parts",
  "Amyx.ru",
  "Анатомия Авто",
  "ARMTEK",
  "Автофлагман",
  "Auger GERMANY",
  "aura",
  "Авто Альянс",
  "AUTO belka",
  "АвтоКонтинент",
  "autodoc.ru",
  "АвтоЛидер",
  "АВТОЛИГА",
];

for (const name of names) {
  const preset = matchPreset(name);
  assert(preset, `нет пресета для ${name}`);
  assert(preset!.name === name, `имя «${preset!.name}» ≠ «${name}»`);
  if (preset!.id !== "rossko" && preset!.id !== "autopiter" && preset!.id !== "exist") {
    assert(preset!.logoUrl.startsWith("/suppliers/"), `${name} без логотипа`);
  }
}

assert(SUPPLIER_PRESETS.length >= 19, "мало пресетов");
assert(presetById("armtek")?.logoUrl === "/suppliers/armtek.png", "логотип ARMTEK");
assert(matchPreset("ARMTEK прайс 19.09")?.id === "armtek", "тема письма");
assert(matchPreset("autodoc.ru.csv")?.id === "autodoc", "имя файла autodoc");

const stub: Supplier = {
  ...emptySupplierFromPreset(presetById("armtek")!),
  id: "sup-armtek",
  apiKey: "",
  columnMap: { ...DEFAULT_COLUMN_MAP },
};

const csv = Buffer.from("Артикул;Бренд;Цена\nW7008;MANN;1200\n", "utf8");
const eml = buildSimpleEml({
  from: "opt@armtek.ru",
  to: "prajsy+armtek@sadparts.ru",
  subject: "Прайс ARMTEK",
  filename: "armtek.csv",
  data: csv,
  contentType: "text/csv",
});
const parsed = parseEml(eml);
assert(parsed.subject.includes("ARMTEK"), `тема: ${parsed.subject}`);
assert(priceAttachments(parsed).length === 1, "нет вложения");
const hit = matchSupplierFromEmail(parsed, [stub]);
assert(hit.supplier?.id === "sup-armtek", `не сопоставил ARMTEK: ${hit.reason}`);

const unknown = matchSupplierFromEmail(
  { from: "a@b.c", to: "x@y.z", subject: "без имени", attachments: [{ filename: "price.csv", contentType: "text/csv", data: csv }] },
  [stub],
);
assert(!unknown.supplier, "ложное срабатывание");

console.log(`ok ${names.length} поставщиков, письмо ARMTEK распознано`);
