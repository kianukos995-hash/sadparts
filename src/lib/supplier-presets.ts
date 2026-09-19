import { ROSSKO_API_BASE } from "@/lib/constants";
import { plusAliasFor, PINNED_PRICE_MAILBOX } from "@/lib/price-mailbox";
import type { AdapterKind, AuthMode, Supplier, SupplierSource } from "@/lib/types";
import { DEFAULT_COLUMN_MAP } from "@/lib/types";

/** Как подключается прайс: разные кабинеты просят разный набор полей. */
export type SupplierApiKind =
  | "file"
  | "email"
  | "generic-json"
  | "bearer"
  | "header"
  | "query"
  | "two-key"
  | "rossko-soap";

export const API_KIND_LABELS: Record<SupplierApiKind, string> = {
  file: "Файл прайса",
  email: "Прайс на почту",
  "generic-json": "Свой JSON API",
  bearer: "Bearer-токен",
  header: "Ключ в заголовке",
  query: "Ключ в URL",
  "two-key": "Логин + пароль / KEY1 + KEY2",
  "rossko-soap": "Росско SOAP KEY1 + KEY2",
};

export const API_KIND_HINTS: Record<SupplierApiKind, string> = {
  file: "CSV, XLSX, ZIP или XML. Название поставщика задаёте сами — колонки угадываются при загрузке.",
  email: "Пришлите прайс на адрес поставщика. Тема или имя файла должны содержать его название или код.",
  "generic-json": "URL, путь к массиву позиций и карта полей. Авторизация: Bearer, заголовок или query.",
  bearer: "Authorization: Bearer <токен>. URL отдаёт JSON с позициями.",
  header: "Ключ в произвольном заголовке (часто X-Api-Key или X-Auth-Token).",
  query: "Ключ в параметре URL (?key= / ?apikey=).",
  "two-key": "Два секрета из кабинета: логин/KEY1 и пароль/KEY2. URL — из документации поставщика.",
  "rossko-soap": "KEY1 и KEY2 из кабинета Росско. Базовый URL SOAP v2.1 подставляется сам.",
};

export interface SupplierPreset {
  id: string;
  name: string;
  code: string;
  logoUrl: string;
  apiKind: SupplierApiKind;
  source: SupplierSource;
  adapter: AdapterKind;
  authMode: AuthMode;
  authHeaderName: string;
  authQueryParam: string;
  apiUrl: string;
  itemsPath: string;
  deliveryDaysMoscow: number;
  deliveryNote: string;
  notes: string;
  aliases: string[];
}

export const CUSTOM_API_ID = "custom-api";
export const CUSTOM_FILE_ID = "custom-file";
export const CUSTOM_EMAIL_ID = "custom-email";

function filePreset(
  id: string,
  name: string,
  code: string,
  file: string,
  aliases: string[],
  extra: Partial<SupplierPreset> = {},
): SupplierPreset {
  return {
    id,
    name,
    code,
    logoUrl: `/suppliers/${file}`,
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: `${name}. Срок из прайса.`,
    notes: "Прайс файлом или письмом на plus-адрес. Свой API — вкладка API после создания.",
    aliases,
    ...extra,
  };
}

export const SUPPLIER_PRESETS: SupplierPreset[] = [
  {
    id: "ad-smartec",
    name: "AD SMARTEC",
    code: "SMARTEC",
    logoUrl: "/suppliers/ad-smartec.png",
    apiKind: "header",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "https://api.smartec.parts/v1/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "Склад AD SMARTEC. Срок до Москвы из прайса или 1–2 дня.",
    notes: "Ключ из кабинета SMARTEC — в заголовок X-Api-Key. Можно вместо API подгрузить файл.",
    aliases: ["ad smartec", "smartec", "ad-smartec"],
  },
  {
    id: "adeo-pro",
    name: "ADEO.PRO",
    code: "ADEO",
    logoUrl: "/suppliers/adeo-pro.png",
    apiKind: "bearer",
    source: "api",
    adapter: "generic",
    authMode: "bearer",
    authHeaderName: "Authorization",
    authQueryParam: "token",
    apiUrl: "https://adeo.pro/api/v1/prices",
    itemsPath: "data",
    deliveryDaysMoscow: 2,
    deliveryNote: "ADEO.PRO. Региональный склад, до Москвы обычно 1–3 дня.",
    notes: "Bearer-токен из кабинета ADEO.PRO. JSON-путь к позициям — data или items.",
    aliases: ["adeo", "adeo.pro", "adeopro"],
  },
  {
    id: "afd-parts",
    name: "AFD PARTS",
    code: "AFD",
    logoUrl: "/suppliers/afd-parts.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "AFD PARTS. Прайс файлом, срок из колонки или 2–4 дня до Москвы.",
    notes: "Типичный канал — Excel/CSV. Можно позже дописать свой API.",
    aliases: ["afd", "afd parts", "afd-parts"],
  },
  {
    id: "agant",
    name: "АГАНТ",
    code: "AGANT",
    logoUrl: "/suppliers/agant.png",
    apiKind: "two-key",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "https://api.agant.ru/v1/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "АГАНТ. До Москвы 1–3 рабочих дня.",
    notes: "KEY1 — логин кабинета, KEY2 — пароль или второй ключ.",
    aliases: ["аганt", "агант", "agant"],
  },
  {
    id: "ahrem",
    name: "AHREM",
    code: "AHREM",
    logoUrl: "/suppliers/ahrem.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "AHREM. Срок из прайса.",
    notes: "Загрузка файла или письмо на адрес поставщика.",
    aliases: ["ahrem", "ахрем"],
  },
  {
    id: "arkot",
    name: "ARKOT",
    code: "ARKOT",
    logoUrl: "/suppliers/arkot.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "ARKOT. До Москвы обычно 2 дня.",
    notes: "Прайс CSV/XLSX. Свой API можно указать на вкладке API.",
    aliases: ["arkot", "аркот"],
  },
  {
    id: "amb-parts",
    name: "AMB-Parts",
    code: "AMB",
    logoUrl: "/suppliers/amb-parts.png",
    apiKind: "header",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "https://api.amb-parts.ru/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "AMB-Parts. Склад и срок в ответе API.",
    notes: "Ключ кабинета в заголовке. Либо файл, если API ещё нет.",
    aliases: ["amb", "amb-parts", "amb parts"],
  },
  {
    id: "amyx",
    name: "Amyx.ru",
    code: "AMYX",
    logoUrl: "/suppliers/amyx.png",
    apiKind: "query",
    source: "api",
    adapter: "generic",
    authMode: "query",
    authHeaderName: "X-Api-Key",
    authQueryParam: "key",
    apiUrl: "https://amyx.ru/api/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "Amyx.ru. Региональная доставка, до Москвы 1–3 дня.",
    notes: "Ключ в параметре URL ?key=. JSON-путь к позициям уточните в кабинете.",
    aliases: ["amyx", "amyx.ru"],
  },
  {
    id: "anatomiya-avto",
    name: "Анатомия Авто",
    code: "ANATOM",
    logoUrl: "/suppliers/anatomiya-avto.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "Анатомия Авто. Срок из колонки прайса.",
    notes: "Файл или письмо. Карта колонок настраивается после первой загрузки.",
    aliases: ["анатомия авто", "анатомия", "anatomiya"],
  },
  {
    id: "armtek",
    name: "ARMTEK",
    code: "ARMTEK",
    logoUrl: "/suppliers/armtek.png",
    apiKind: "two-key",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "https://ws.armtek.ru/api",
    itemsPath: "items",
    deliveryDaysMoscow: 1,
    deliveryNote: "ARMTEK. Федеральные склады, до Москвы часто день в день / +1.",
    notes: "KEY1 — логин WS, KEY2 — пароль. URL веб-сервиса из кабинета Armtek.",
    aliases: ["armtek", "армтек"],
  },
  {
    id: "avtoflagman",
    name: "Автофлагман",
    code: "FLAGMAN",
    logoUrl: "/suppliers/avtoflagman.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "Автофлагман. Срок из прайса.",
    notes: "Прайс файлом или письмом. Свой JSON API можно добавить позже.",
    aliases: ["автофлагман", "флагман", "flagman", "avtoflagman"],
  },
  {
    id: "auger",
    name: "Auger GERMANY",
    code: "AUGER",
    logoUrl: "/suppliers/auger.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 4,
    deliveryNote: "Auger GERMANY. Грузовая номенклатура, срок из прайса дистрибьютора.",
    notes: "Бренд часто приходит файлом от дистрибьютора. Можно повесить свой API.",
    aliases: ["auger", "auger germany", "аугер"],
  },
  {
    id: "aura",
    name: "aura",
    code: "AURA",
    logoUrl: "/suppliers/aura.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "aura. Срок из прайса.",
    notes: "Файл CSV/XLSX или письмо на адрес поставщика.",
    aliases: ["aura", "аура"],
  },
  {
    id: "avto-alyans",
    name: "Авто Альянс",
    code: "ALYANS",
    logoUrl: "/suppliers/avto-alyans.png",
    apiKind: "header",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "https://api.autoalliance.ru/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "Авто Альянс. До Москвы 1–3 дня.",
    notes: "Ключ из кабинета в заголовке. Файл тоже принимается.",
    aliases: ["авто альянс", "автоальянс", "alliance", "alyans"],
  },
  {
    id: "auto-belka",
    name: "AUTO belka",
    code: "BELKA",
    logoUrl: "/suppliers/auto-belka.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "AUTO belka. Срок из прайса.",
    notes: "Загрузка файла с названием поставщика или письмо.",
    aliases: ["auto belka", "авто белка", "belka", "белка"],
  },
  {
    id: "avtokontinent",
    name: "АвтоКонтинент",
    code: "AKONT",
    logoUrl: "/suppliers/avtokontinent.png",
    apiKind: "two-key",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "https://api.autokontinent.ru/v1/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "АвтоКонтинент. Федеральная сеть, срок из ответа.",
    notes: "KEY1 и KEY2 из кабинета АвтоКонтинент.",
    aliases: ["автоконтинент", "autokontinent", "авто континент"],
  },
  {
    id: "autodoc",
    name: "autodoc.ru",
    code: "AUTODOC",
    logoUrl: "/suppliers/autodoc.png",
    apiKind: "bearer",
    source: "api",
    adapter: "generic",
    authMode: "bearer",
    authHeaderName: "Authorization",
    authQueryParam: "token",
    apiUrl: "https://api.autodoc.ru/prices",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "autodoc.ru. Срок и склад в выдаче.",
    notes: "Bearer-токен партнёрского API. Можно грузить выгрузку файлом.",
    aliases: ["autodoc", "autodoc.ru", "автодок"],
  },
  {
    id: "avtolider",
    name: "АвтоЛидер",
    code: "LIDER",
    logoUrl: "/suppliers/avtolider.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "АвтоЛидер. Срок из прайса.",
    notes: "Файл или почта. Свой API — вкладка API после создания.",
    aliases: ["автолидер", "авто лидер", "lider"],
  },
  {
    id: "avtoliga",
    name: "АВТОЛИГА",
    code: "LIGA",
    logoUrl: "/suppliers/avtoliga.png",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "АВТОЛИГА. До Москвы обычно 1–3 дня.",
    notes: "Прайс файлом. При наличии кабинета укажите URL и ключ.",
    aliases: ["автолига", "авто лига", "liga"],
  },
  filePreset("abstd", "absTD", "ABSTD", "abstd.png", ["abstd", "abs td", "абстд"]),
  filePreset("novy-avtomagazin", "Новый автомагазин", "NOVYMAG", "novy-avtomagazin.png", [
    "новый автомагазин",
    "новый магазин",
    "novy avtomagazin",
  ]),
  filePreset("da-detal", "DA DETAL", "DADETAL", "da-detal.png", [
    "da detal",
    "dadetal",
    "да деталь",
    "дадеталь",
  ]),
  filePreset("auto-pulse", "AUTO PULSE", "PULSE", "auto-pulse.png", [
    "auto pulse",
    "autopulse",
    "автопульс",
    "авто пульс",
  ]),
  filePreset("avtoray", "АвтоРай", "AVTORAY", "avtoray.png", [
    "авторай",
    "авто рай",
    "avtoray",
    "ap авторай",
  ]),
  filePreset("avtosoyuz", "Автосоюз", "SOYUZ", "avtosoyuz.png", [
    "автосоюз",
    "авто союз",
    "avtosoyuz",
  ]),
  filePreset("am-mark", "АМ", "AMARK", "am.png", ["ам лого", "amark", "а м поставщик"]),
  filePreset("avtotrade", "Автотрейд", "TRADE", "avtotrade.png", [
    "автотрейд",
    "авто трейд",
    "avtotrade",
    "autotrade",
  ]),
  filePreset("avtotrust", "Автотраст", "TRUST", "avtotrust.png", [
    "автотраст",
    "авто траст",
    "авто-траст",
    "avtotrust",
  ]),
  filePreset("autozest", "AutoZest.ru", "ZEST", "autozest.png", [
    "autozest",
    "autozest.ru",
    "автозест",
  ]),
  filePreset("avto-evro", "Авто-Евро", "EVRO", "avto-evro.png", [
    "авто-евро",
    "автоевро",
    "авто евро",
    "avto-evro",
  ]),
  filePreset("avtoimport", "Автоимпорт", "IMPORT", "avtoimport.png", [
    "автоимпорт",
    "авто импорт",
    "avtoimport",
  ]),
  filePreset("autokhadom", "AUTOKHADOM", "KHADOM", "autokhadom.png", [
    "autokhadom",
    "auto khadom",
    "автохадом",
  ]),
  filePreset("a-avto", "A-Авто", "AAVTO", "a-avto.png", ["a-авто", "a-avto", "аавто", "a avto"]),
  filePreset("avtooptima", "Автооптима", "OPTIMA", "avtooptima.png", [
    "автооптима",
    "авто оптима",
    "avtooptima",
    "новосибирск автооптима",
  ]),
  filePreset("avtorus", "Авторусь", "RUS", "avtorus.png", [
    "авторусь",
    "авто русь",
    "avtorus",
    "авторус",
  ]),
  filePreset("avtosputnik", "Автоспутник", "SPUTNIK", "avtosputnik.png", [
    "автоспутник",
    "авто спутник",
    "as автоспутник",
    "avtosputnik",
  ]),
  filePreset("avanta", "Аванта", "AVANTA", "avanta.png", ["аванта", "avanta", "ад аванта"]),
  filePreset("avtoformula", "АвтоФормула", "FORMULA", "avtoformula.png", [
    "автоформула",
    "авто формула",
    "avtoformula",
  ]),
  filePreset("avtogut", "Автогут", "GUT", "avtogut.png", ["автогут", "авто гут", "avtogut", "ag автогут"]),
  filePreset("autopriavok", "autopriavok.com", "PRIAVOK", "autopriavok.png", [
    "autopriavok",
    "autopriavok.com",
    "автоприавок",
  ]),
  filePreset("avto10", "AVTO10", "AVTO10", "avto10.png", ["avto10", "авто10", "авто 10"]),
  filePreset("baltkam", "Балткам", "BALTKAM", "baltkam.png", ["балткам", "baltkam", "балт кам"]),
  filePreset("berg", "BERG", "BERG", "berg.png", ["berg", "берг", "od berg"]),
  filePreset("berlin-motors", "BERLIN MOTORS", "BERLIN", "berlin-motors.png", [
    "berlin motors",
    "berlinmotors",
    "берлин моторс",
  ]),
  filePreset("big1", "BiG1.RU", "BIG1", "big1.png", ["big1", "big1.ru", "биг1"]),
  filePreset("binom-avto", "Бином Авто", "BINOM", "binom-avto.png", [
    "бином авто",
    "бином",
    "binom",
    "binom avto",
  ]),
  filePreset("carreta", "CARRETA", "CARRETA", "carreta.png", ["carreta", "каррета", "карета"]),
  filePreset("chel-parts", "Chel Parts", "CHEL", "chel-parts.png", [
    "chel parts",
    "chelparts",
    "чел партс",
    "челparts",
  ]),
  filePreset("cto-parts", "CTO.PARTS.RU", "CTOPARTS", "cto-parts.png", [
    "cto.parts.ru",
    "cto parts",
    "ctoparts",
    "сто партс",
  ]),
  filePreset("passion-for-cars", "Passion for Cars", "PFCARS", "passion-for-cars.png", [
    "passion for cars",
    "passion cars",
    "passionforcars",
  ]),
  filePreset("igraru", "IGRA RU", "IGRARU", "igraru.png", ["igra ru", "igraru", "игра ru", "игра ру"]),
  filePreset("discount-parts", "DP Discount Parts", "DPDISC", "discount-parts.png", [
    "discount parts",
    "dp discount",
    "dp parts",
    "discountparts",
  ]),
  filePreset("donavto", "DONAVTO PART.RU", "DONAVTO", "donavto.png", [
    "donavto",
    "donavto part",
    "donavto part.ru",
    "донавто",
  ]),
  filePreset("dromex", "DROMEX.RU", "DROMEX", "dromex.png", ["dromex", "dromex.ru", "дромекс"]),
  filePreset("elbrus", "Эльбрус", "ELBRUS", "elbrus.png", ["эльбрус", "elbrus"]),
  {
    id: "rossko",
    name: "Росско",
    code: "ROSSKO",
    logoUrl: "",
    apiKind: "rossko-soap",
    source: "api",
    adapter: "rossko",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: ROSSKO_API_BASE,
    itemsPath: "items",
    deliveryDaysMoscow: 1,
    deliveryNote: "Склад Подольск. До Москвы обычно на следующий рабочий день.",
    notes: "SOAP v2.1: KEY1 и KEY2 из кабинета. Полный прайс — ZIP/CSV в «Прайсы».",
    aliases: ["rossko", "росско"],
  },
  {
    id: "autopiter",
    name: "Автопитер",
    code: "APITER",
    logoUrl: "/suppliers/autopiter.png",
    apiKind: "bearer",
    source: "api",
    adapter: "generic",
    authMode: "bearer",
    authHeaderName: "Authorization",
    authQueryParam: "token",
    apiUrl: "https://api.autopiter.ru/v1/prices",
    itemsPath: "data.products",
    deliveryDaysMoscow: 2,
    deliveryNote: "Склад СПб. До Москвы 1–2 дня, экспресс — ночь.",
    notes: "Bearer-токен. Вложенный JSON data.products, поля article/producer/cost.",
    aliases: ["автопитер", "autopiter", "auto piter", "autopiter.ru"],
  },
  {
    id: "exist",
    name: "Exist Wholesale",
    code: "EXIST",
    logoUrl: "/suppliers/exist.png",
    apiKind: "query",
    source: "api",
    adapter: "generic",
    authMode: "query",
    authHeaderName: "X-Api-Key",
    authQueryParam: "key",
    apiUrl: "https://api.exist.ru/prices",
    itemsPath: "",
    deliveryDaysMoscow: 3,
    deliveryNote: "Региональный склад. До Москвы 2–4 дня.",
    notes: "Ключ в query ?key=. Корневой массив, русские заголовки колонок.",
    aliases: ["exist", "экзист", "exist.ru"],
  },
];

export const CUSTOM_PRESETS: SupplierPreset[] = [
  {
    id: CUSTOM_API_ID,
    name: "Свой API",
    code: "API",
    logoUrl: "",
    apiKind: "generic-json",
    source: "api",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 2,
    deliveryNote: "",
    notes: "Любой JSON: URL, авторизация, путь к позициям и карта полей.",
    aliases: ["свой api", "custom", "json"],
  },
  {
    id: CUSTOM_FILE_ID,
    name: "Файл с названием",
    code: "FILE",
    logoUrl: "",
    apiKind: "file",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "",
    notes: "Задайте имя поставщика и загрузите CSV, XLSX, ZIP или XML.",
    aliases: ["файл", "file"],
  },
  {
    id: CUSTOM_EMAIL_ID,
    name: "Прайс на почту",
    code: "MAIL",
    logoUrl: "",
    apiKind: "email",
    source: "file",
    adapter: "generic",
    authMode: "header",
    authHeaderName: "X-Api-Key",
    authQueryParam: "apikey",
    apiUrl: "",
    itemsPath: "items",
    deliveryDaysMoscow: 3,
    deliveryNote: "",
    notes: "Поставщик с plus-адресом prajsy+код@sadparts.ru. Письмо распознаётся по теме, алиасу и вложению.",
    aliases: ["почта", "email", "mail"],
  },
];

export const ALL_PRESETS = [...SUPPLIER_PRESETS, ...CUSTOM_PRESETS];

export function presetById(id: string | undefined) {
  if (!id) return undefined;
  return ALL_PRESETS.find((item) => item.id === id);
}

function normalizeNeedle(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/[^a-z0-9а-я]+/gi, " ");
}

export function matchPreset(text: string): SupplierPreset | undefined {
  const needle = normalizeNeedle(text);
  if (!needle) return undefined;
  const catalog = SUPPLIER_PRESETS;
  const exact = catalog.find(
    (item) =>
      normalizeNeedle(item.name) === needle ||
      normalizeNeedle(item.code) === needle ||
      item.aliases.some((alias) => normalizeNeedle(alias) === needle),
  );
  if (exact) return exact;
  return catalog.find((item) => {
    const hay = [item.name, item.code, ...item.aliases].map(normalizeNeedle);
    return hay.some((alias) => alias && (needle.includes(alias) || alias.includes(needle)));
  });
}

export function emailAliasFor(code: string, mailbox = PINNED_PRICE_MAILBOX) {
  return plusAliasFor(code, mailbox);
}

export function emptySupplierFromPreset(preset: SupplierPreset, mailbox = PINNED_PRICE_MAILBOX): Supplier {
  return {
    id: crypto.randomUUID(),
    name: preset.id.startsWith("custom-") ? "" : preset.name,
    code: preset.id.startsWith("custom-") ? "" : preset.code,
    source: preset.source,
    adapter: preset.adapter,
    apiUrl: preset.apiUrl,
    apiKey: "",
    apiKey2: "",
    authMode: preset.authMode,
    authHeaderName: preset.authHeaderName,
    authQueryParam: preset.authQueryParam,
    itemsPath: preset.itemsPath,
    columnMap: { ...DEFAULT_COLUMN_MAP },
    notes: preset.notes,
    active: true,
    createdAt: new Date().toISOString(),
    deliveryDaysMoscow: preset.deliveryDaysMoscow,
    deliveryNote: preset.deliveryNote,
    ownerRole: "admin",
    lockedByAdmin: false,
    sharedWithOrgIds: [],
    presetId: preset.id,
    logoUrl: preset.logoUrl,
    emailAlias: emailAliasFor(preset.code || preset.id, mailbox),
    apiKind: preset.apiKind,
  };
}

export function logoForSupplier(supplier: Pick<Supplier, "logoUrl" | "presetId" | "name" | "code">) {
  if (supplier.logoUrl) return supplier.logoUrl;
  const preset =
    presetById(supplier.presetId) ||
    matchPreset(supplier.name || "") ||
    matchPreset(supplier.code || "");
  return preset?.logoUrl || "";
}

export function attachPresetMeta(supplier: Supplier): Supplier {
  const preset =
    presetById(supplier.presetId) ||
    matchPreset(supplier.name || "") ||
    matchPreset(supplier.code || "");
  const stale = /@prajsy\.local$/i.test(supplier.emailAlias ?? "");
  const alias = stale || !supplier.emailAlias
    ? emailAliasFor(supplier.code || preset?.code || supplier.name || "price")
    : supplier.emailAlias;
  if (!preset) {
    return {
      ...supplier,
      logoUrl: supplier.logoUrl ?? "",
      emailAlias: alias,
      apiKind: supplier.apiKind,
    };
  }
  return {
    ...supplier,
    presetId: supplier.presetId || preset.id,
    logoUrl: supplier.logoUrl || preset.logoUrl,
    emailAlias: alias,
    apiKind: supplier.apiKind || preset.apiKind,
  };
}

export function isSupplierConnected(supplier: Supplier) {
  if (!supplier.active) return false;
  const rows = supplier.catalogCount ?? supplier.lastSyncCount ?? 0;
  if (rows > 0 && supplier.lastSyncStatus !== "error") return true;
  if (supplier.source === "api" || supplier.adapter === "rossko") {
    const hasKey = Boolean(supplier.apiKey.trim()) || Boolean(supplier.apiKey2.trim());
    return hasKey && supplier.lastSyncStatus === "ok";
  }
  return false;
}
