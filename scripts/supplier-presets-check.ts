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
  "absTD",
  "Новый автомагазин",
  "DA DETAL",
  "AUTO PULSE",
  "АвтоРай",
  "Автосоюз",
  "АМ",
  "Автотрейд",
  "Автотраст",
  "AutoZest.ru",
  "Авто-Евро",
  "Автоимпорт",
  "AUTOKHADOM",
  "A-Авто",
  "Автооптима",
  "Авторусь",
  "Автоспутник",
  "Аванта",
  "АвтоФормула",
  "Автогут",
  "autopriavok.com",
  "AVTO10",
  "Балткам",
  "BERG",
  "BERLIN MOTORS",
  "BiG1.RU",
  "Бином Авто",
  "CARRETA",
  "Chel Parts",
  "CTO.PARTS.RU",
  "Passion for Cars",
  "IGRA RU",
  "DP Discount Parts",
  "DONAVTO PART.RU",
  "DROMEX.RU",
  "Эльбрус",
  "EMEX",
  "euro auto",
  "Faeton37",
  "FAVORIT",
  "Феникс",
  "FIXAUTO",
  "Formula1",
  "FORUM-AUTO",
  "FROZA",
  "GENESIS-10F",
  "GEF PARTS",
  "GPI G'PARTS IMPORT",
  "Help-auto24.ru",
  "INPARTSGROUP",
  "Intercar",
  "IRONUNIT",
  "Gears",
  "IWC",
  "IXORA",
  "JA PARTS",
  "JLR DETALI",
  "JUST AUTO PARTS",
  "КА Моторс",
  "KM-H.RU",
  "Кокпит",
  "Колесо",
  "КореяПарт",
  "Leemancar",
  "Little Japan",
  "LYNX",
  "MParts",
  "MAN TRADE",
  "MB Parts",
  "MC auto",
  "MP73",
  "MEGA-ZAP-AUTO",
  "MEGAROS",
  "Микадо",
  "MosTeknorot",
  "Москворечье",
  "MoTexC",
  "MX group",
  "my-detal",
  "Myparts86",
  "Норд",
  "Новая логистика",
];

for (const name of names) {
  const preset = matchPreset(name);
  assert(preset, `нет пресета для ${name}`);
  assert(preset!.name === name, `имя «${preset!.name}» ≠ «${name}»`);
  if (preset!.id !== "rossko") {
    assert(preset!.logoUrl.startsWith("/suppliers/"), `${name} без логотипа`);
  }
}

assert(SUPPLIER_PRESETS.length >= 103, "мало пресетов");
assert(presetById("armtek")?.logoUrl === "/suppliers/armtek.png", "логотип ARMTEK");
assert(presetById("autopiter")?.logoUrl === "/suppliers/autopiter.png", "логотип Автопитер");
assert(presetById("exist")?.logoUrl === "/suppliers/exist.png", "логотип Exist");
assert(presetById("avtorus")?.logoUrl === "/suppliers/avtorus.png", "логотип Авторусь");
assert(presetById("da-detal")?.name === "DA DETAL", "DA DETAL");
assert(presetById("elbrus")?.name === "Эльбрус", "Эльбрус");
assert(matchPreset("ARMTEK прайс 19.09")?.id === "armtek", "тема письма");
assert(matchPreset("autodoc.ru.csv")?.id === "autodoc", "имя файла autodoc");
assert(matchPreset("prajsy+dadetal@sadparts.ru")?.id === "da-detal" || matchPreset("DA DETAL прайс")?.id === "da-detal", "DA DETAL по теме");
assert(matchPreset("Авторусь опт")?.id === "avtorus", "Авторусь");
assert(matchPreset("autopiter.ru")?.id === "autopiter", "autopiter.ru");
assert(matchPreset("dromex.ru.csv")?.id === "dromex", "dromex");
assert(matchPreset("Эльбрус прайс")?.id === "elbrus", "эльбрус тема");
assert(matchPreset("exist.ru")?.id === "exist", "exist.ru");
assert(matchPreset("emex прайс")?.id === "emex", "emex");
assert(matchPreset("FLAGMAN AUTO")?.id === "avtoflagman", "flagman auto");
assert(matchPreset("forum-auto.csv")?.id === "forum-auto", "forum-auto");
assert(matchPreset("ixora auto parts")?.id === "ixora", "ixora");
assert(matchPreset("mega-zap-auto.csv")?.id === "mega-zap-auto", "megazap");
assert(matchPreset("mx group")?.id === "mx-group", "mx group");
assert(matchPreset("Москворечье прайс")?.id === "moskvorechie", "москворечье");

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
