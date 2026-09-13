export interface BrandProfile {
  name: string;
  country: string;
  founded: string;
  about: string;
  color: string;
  initials: string;
  domain?: string;
}

const COLORS = [
  "#1d4ed8",
  "#b45309",
  "#0f766e",
  "#7c3aed",
  "#be123c",
  "#365314",
  "#1e3a8a",
  "#9a3412",
  "#334155",
  "#0e7490",
];

const BRANDS: Record<string, Omit<BrandProfile, "initials" | "name"> & { name?: string }> = {
  lynxauto: {
    country: "Южная Корея / глобальный aftermarket",
    founded: "2000-е",
    about: "LYNXauto — корейский aftermarket: подвеска, тормоза, фильтры и электрика для азиатских и европейских машин. На рынке массового ремонта больше двадцати лет.",
    color: "#c2410c",
    domain: "lynxauto.com",
  },
  sufix: {
    country: "Китай / поставки в РФ и СНГ",
    founded: "2010-е",
    about: "SUFIX — бюджетный aftermarket сайлентблоков, опор и мелкой подвески. Широко представлен в оптовых прайсах Росско и региональных складах.",
    color: "#1e3a8a",
  },
  tatsumi: {
    country: "Япония / производство в Азии",
    founded: "1990-е",
    about: "Tatsumi — японский бренд запчастей подвески и двигателя для азиатских авто. На рынке Японии и экспорта — несколько десятилетий.",
    color: "#b91c1c",
    domain: "tatsumi.parts",
  },
  trialli: {
    country: "Россия / Китай (контракт)",
    founded: "2008",
    about: "Trialli — российский бренд электрики, тормозов и охлаждения. На рынке с конца 2000-х, ориентирован на СТО и опт.",
    color: "#1d4ed8",
    domain: "trialli.ru",
  },
  metaco: {
    country: "Тайвань / Азия",
    founded: "1990-е",
    about: "METACO — тайваньский производитель деталей подвески и рулевого. Экспортирует в Европу и СНГ больше двадцати лет.",
    color: "#0f766e",
  },
  febest: {
    country: "Германия / производство в Азии",
    founded: "1990",
    about: "Febest — немецкий aftermarket сайлентблоков, опор и шаровых. Основан в 1990 году, один из самых узнаваемых брендов подвески.",
    color: "#1e40af",
    domain: "febest.eu",
  },
  "master kit": {
    country: "Россия",
    founded: "2000-е",
    about: "Master KiT — российский бренд ремкомплектов подвески и сайлентблоков. Закрывает ремонтные наборы под популярные OEM.",
    color: "#9a3412",
  },
  startvolt: {
    country: "Россия",
    founded: "2010-е",
    about: "STARTVOLT — российская электрика: генераторы, стартеры, датчики. Бренд группы компаний для стоечного ремонта.",
    color: "#ca8a04",
    domain: "startvolt.com",
  },
  luzar: {
    country: "Россия",
    founded: "2000",
    about: "Luzar — радиаторы, печки, вентиляторы и помпы. На рынке с 2000 года, сильные позиции по ВАЗ и иномаркам.",
    color: "#0369a1",
    domain: "luzar.ru",
  },
  ngn: {
    country: "Нидерланды / Азия",
    founded: "2000-е",
    about: "NGN — масла, фильтры и химия. Европейский бренд с азиатским производством, в прайсах СНГ с 2000-х.",
    color: "#14532d",
  },
  stellox: {
    country: "Германия / ЕС",
    founded: "1990-е",
    about: "Stellox — европейский aftermarket тормозов, фильтров и подвески. Долго присутствует в оптовых каталогах.",
    color: "#44403c",
  },
  ctr: {
    country: "Южная Корея",
    founded: "1971",
    about: "CTR (Central Corporation) — корейский OEM/OES рулевых и шаровых с 1971 года. Поставляет на конвейеры Hyundai, Kia и aftermarket.",
    color: "#1d4ed8",
    domain: "ctr.co.kr",
  },
  marshall: {
    country: "Великобритания / глобальный aftermarket",
    founded: "1900-е (бренд); автозапчасти — 1990-е",
    about: "Marshall в автозапчастях — тормоза, фильтры и подвеска для массового ремонта. Европейский aftermarket с широкой линейкой.",
    color: "#111827",
  },
  airline: {
    country: "Россия",
    founded: "2000-е",
    about: "AIRLINE — российский бренд автоаксессуаров, электрики и расходников. Массовый ритейл и опт.",
    color: "#0ea5e9",
    domain: "airline.su",
  },
  japanparts: {
    country: "Италия / Япония (ассортимент)",
    founded: "1992",
    about: "Japanparts — итальянская компания с 1992 года: запчасти для японских и корейских авто на европейский aftermarket.",
    color: "#b91c1c",
    domain: "japanparts.it",
  },
  toyota: {
    country: "Япония",
    founded: "1937",
    about: "Toyota Motor Corporation основана в 1937 году. Оригинальные запчасти и конвейерная номенклатура для Toyota/Lexus.",
    color: "#eb0a1e",
    domain: "toyota.com",
  },
  jikiu: {
    country: "Япония / Китай",
    founded: "2000-е",
    about: "JIKIU — aftermarket фильтров и расходников для азиатских авто, широко представлен в опте СНГ.",
    color: "#1e3a8a",
  },
  frenkit: {
    country: "Испания",
    founded: "1982",
    about: "Frenkit — испанский производитель ремкомплектов тормозных цилиндров с 1982 года. Специализация — уплотнения тормозов.",
    color: "#dc2626",
    domain: "frenkit.es",
  },
  vag: {
    country: "Германия",
    founded: "1937 (Volkswagen); концерн VAG",
    about: "VAG — концерн Volkswagen: VW, Audi, Škoda, SEAT. Оригинал и конвейерные номера с 1930-х (VW).",
    color: "#1a1a1a",
    domain: "volkswagen.com",
  },
  "hyundai/kia": {
    country: "Южная Корея",
    founded: "Hyundai 1967, Kia 1944",
    about: "Hyundai (1967) и Kia (1944) — корейский концерн. В прайсе оригинальные и конвейерные номера группы.",
    color: "#002c5f",
    domain: "hyundai.com",
  },
  gates: {
    country: "США",
    founded: "1911",
    about: "Gates — ремни, ролики, патрубки. Американская компания с 1911 года, OEM для многих конвейеров.",
    color: "#000000",
    domain: "gates.com",
  },
  fenox: {
    country: "Беларусь / Германия (бренд)",
    founded: "1989",
    about: "Fenox — тормоза, подвеска, электрика. Корни в Беларуси, бренд на рынке с конца 1980-х.",
    color: "#1e40af",
    domain: "fenox.com",
  },
  transmaster: {
    country: "Россия / Китай",
    founded: "2000-е",
    about: "TRANSMASTER — aftermarket трансмиссии и ходовой для коммерческого и легкового ремонта.",
    color: "#334155",
  },
  brave: {
    country: "Россия / Азия",
    founded: "2010-е",
    about: "Brave — бюджетный aftermarket расходников и подвески в российских оптовых прайсах.",
    color: "#7c2d12",
  },
  "victor reinz": {
    country: "Германия",
    founded: "1920-е (Reinz); Dana / Victor Reinz",
    about: "Victor Reinz — прокладки и уплотнения двигателя. Немецкая школа уплотнений, бренд группы Dana, на рынке почти век.",
    color: "#1e3a8a",
    domain: "victorreinz.com",
  },
  krauf: {
    country: "Германия / производство в Азии",
    founded: "1990-е",
    about: "Krauf — стартеры, генераторы, электрика. Европейский aftermarket с азиатским производством.",
    color: "#0f172a",
  },
  sidem: {
    country: "Бельгия",
    founded: "1933",
    about: "Sidem — рулевые тяги и шаровые. Бельгийский производитель с 1933 года, сильный европейский OEM/aftermarket.",
    color: "#dc2626",
    domain: "sidem.be",
  },
  "united motors": {
    country: "Италия / глобальный aftermarket",
    founded: "1990-е",
    about: "United Motors — итальянский aftermarket двигателя и ходовой для европейских и азиатских авто.",
    color: "#111827",
  },
  "точка опоры": {
    country: "Россия",
    founded: "1990-е",
    about: "«Точка опоры» — российский бренд сайлентблоков и полиуретана подвески. На рынке с 1990-х.",
    color: "#b45309",
  },
  elring: {
    country: "Германия",
    founded: "1879",
    about: "ElringKlinger / Elring — прокладки, ГБЦ, уплотнения. Немецкая компания с 1879 года, конвейер и aftermarket.",
    color: "#0f766e",
    domain: "elring.com",
  },
  asva: {
    country: "Тайвань / Япония (ассортимент)",
    founded: "1980-е",
    about: "Asva — шаровые, рычаги, сайлентблоки для японских авто. Типичный азиатский aftermarket с 1980-х.",
    color: "#1d4ed8",
  },
  pilenga: {
    country: "Италия",
    founded: "1970-е",
    about: "Pilenga — итальянские тормоза и диски. Европейский aftermarket, десятилетия на рынке.",
    color: "#b91c1c",
  },
  nissan: {
    country: "Япония",
    founded: "1933",
    about: "Nissan Motor Co. основана в 1933 году. Оригинальные запчасти и конвейерные номера Nissan/Infiniti.",
    color: "#c3002f",
    domain: "nissan.com",
  },
  fiestroco: {
    country: "Китай / aftermarket",
    founded: "2010-е",
    about: "FIESTROCO — бюджетный aftermarket в оптовых прайсах: подвеска и расходники.",
    color: "#334155",
  },
  goodwill: {
    country: "Южная Корея / Китай",
    founded: "2000-е",
    about: "GoodWill — фильтры и расходники. Азиатский aftermarket, массово идёт в опт СНГ.",
    color: "#15803d",
  },
  mitsubishi: {
    country: "Япония",
    founded: "1870 (концерн); авто — 1917",
    about: "Mitsubishi — японский концерн. Автомобильное направление с 1917 года, оригинал и конвейер.",
    color: "#e60012",
    domain: "mitsubishi-motors.com",
  },
  arnezi: {
    country: "Россия",
    founded: "2000-е",
    about: "ARNEZI — инструмент, электрика и расходники. Российский ритейл-бренд.",
    color: "#f59e0b",
  },
  "parts-mall": {
    country: "Южная Корея",
    founded: "1987",
    about: "Parts-Mall — корейский aftermarket фильтров и расходников с 1987 года.",
    color: "#1e3a8a",
    domain: "parts-mall.com",
  },
  amd: {
    country: "Россия / Азия",
    founded: "2000-е",
    about: "AMD — aftermarket подвески и тормозов в российских прайсах.",
    color: "#7c3aed",
  },
  torr: {
    country: "Россия / Китай",
    founded: "2010-е",
    about: "TORR — бюджетные детали подвески и расходники для стоечного ремонта.",
    color: "#44403c",
  },
  kyb: {
    country: "Япония",
    founded: "1919",
    about: "KYB (Kayaba) — амортизаторы и гидравлика. Японская компания с 1919 года, мировой OEM.",
    color: "#c8102e",
    domain: "kyb.com",
  },
  ajusa: {
    country: "Испания",
    founded: "1972",
    about: "Ajusa — прокладки и болты ГБЦ. Испанский производитель с 1972 года.",
    color: "#b45309",
    domain: "ajusa.es",
  },
  bosch: {
    country: "Германия",
    founded: "1886",
    about: "Robert Bosch GmbH основана в 1886 году. Зажигание, тормоза, фильтры, электрика — один из старейших автобрендов мира.",
    color: "#ea0016",
    domain: "bosch.com",
  },
  fixar: {
    country: "Россия / Азия",
    founded: "2010-е",
    about: "FIXAR — aftermarket крепежа и мелкой механики в оптовых прайсах.",
    color: "#334155",
  },
  blitz: {
    country: "Япония / aftermarket",
    founded: "1980",
    about: "Blitz — японский тюнинг и aftermarket с 1980 года; в прайсах также встречается как расходный бренд.",
    color: "#111827",
    domain: "blitz.co.jp",
  },
  "sb nagamochi": {
    country: "Япония / Азия",
    founded: "1990-е",
    about: "SB Nagamochi — азиатский aftermarket подвески и сайлентблоков.",
    color: "#1e40af",
  },
  lemforder: {
    country: "Германия",
    founded: "1947",
    about: "Lemförder (ZF Aftermarket) — рулевые и рычаги. Немецкий бренд с 1947 года, конвейер премиум-марок.",
    color: "#005587",
    domain: "zf.com",
  },
  partra: {
    country: "Тайвань",
    founded: "1980-е",
    about: "PARTRA — тайваньский aftermarket подвески и рулевого.",
    color: "#0f766e",
  },
  mando: {
    country: "Южная Корея",
    founded: "1962",
    about: "Mando — тормоза и подвеска. Корейский OEM с 1962 года, конвейер Hyundai/Kia.",
    color: "#0033a0",
    domain: "halla.com",
  },
  gm: {
    country: "США",
    founded: "1908",
    about: "General Motors основана в 1908 году. Оригинал Chevrolet, Opel, Cadillac и совместных платформ.",
    color: "#003da5",
    domain: "gm.com",
  },
  azumi: {
    country: "Япония / Азия",
    founded: "1990-е",
    about: "Azumi — фильтры и расходники азиатского aftermarket.",
    color: "#0e7490",
  },
  mecafilter: {
    country: "Франция / ЕС",
    founded: "1970-е",
    about: "Mecafilter — европейские фильтры, бренд группы Sogefi / aftermarket ЕС.",
    color: "#1d4ed8",
  },
  "green filter": {
    country: "Украина / ЕС",
    founded: "1990-е",
    about: "GREEN FILTER — фильтры салона, воздуха и топлива. Восточноевропейский aftermarket.",
    color: "#15803d",
  },
  bmw: {
    country: "Германия",
    founded: "1916",
    about: "BMW основана в 1916 году. Оригинальные запчасти и конвейерные номера BMW/MINI.",
    color: "#1c69d4",
    domain: "bmw.com",
  },
  mercedes: {
    country: "Германия",
    founded: "1926 (Mercedes-Benz); Daimler 1890",
    about: "Mercedes-Benz — с 1926 года (корни Daimler/Benz XIX век). Оригинал и конвейер.",
    color: "#333333",
    domain: "mercedes-benz.com",
  },
  brembo: {
    country: "Италия",
    founded: "1961",
    about: "Brembo основана в 1961 году в Италии. Тормозные системы — конвейер суперкаров и aftermarket.",
    color: "#e10600",
    domain: "brembo.com",
  },
  "mann-filter": {
    country: "Германия",
    founded: "1941",
    about: "MANN+HUMMEL / MANN-FILTER — фильтры с 1941 года. Немецкий OEM и aftermarket.",
    color: "#009640",
    domain: "mann-filter.com",
  },
  mahle: {
    country: "Германия",
    founded: "1920",
    about: "MAHLE — поршневая, фильтры, термостаты. Основана в 1920 году в Штутгарте.",
    color: "#e30613",
    domain: "mahle.com",
  },
  skf: {
    country: "Швеция",
    founded: "1907",
    about: "SKF — подшипники с 1907 года. Шведский мировой OEM ступиц и промышленной механики.",
    color: "#005eb8",
    domain: "skf.com",
  },
  trw: {
    country: "США / Германия (ZF)",
    founded: "1901",
    about: "TRW — тормоза и рулевое. С 1901 года, сейчас в ZF Aftermarket.",
    color: "#003366",
    domain: "zf.com",
  },
  valeo: {
    country: "Франция",
    founded: "1923",
    about: "Valeo — сцепление, оптика, щётки, термостаты. Французский концерн с 1923 года.",
    color: "#e30613",
    domain: "valeo.com",
  },
  "16f": {
    country: "Китай / aftermarket",
    founded: "2010-е",
    about: "16F — бюджетные сайлентблоки и подвеска, часто в оптовых прайсах Росско.",
    color: "#57534e",
  },
};

function initials(name: string) {
  const parts = name.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, " ").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function keyOf(name: string) {
  return name.trim().toLowerCase().replace(/ё/g, "е");
}

export function resolveBrand(name: string): BrandProfile {
  const raw = name.trim() || "—";
  const direct = BRANDS[keyOf(raw)];
  if (direct) {
    return { name: direct.name ?? raw, initials: initials(direct.name ?? raw), ...direct };
  }
  const compact = keyOf(raw).replace(/[^a-zа-я0-9]+/g, " ").trim();
  const alt = BRANDS[compact];
  if (alt) return { name: alt.name ?? raw, initials: initials(alt.name ?? raw), ...alt };
  const hash = [...raw].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    name: raw,
    country: "международный aftermarket",
    founded: "данные уточняются",
    about: `${raw} — бренд из прайса поставщика. Карточка собрана по открытым данным рынка запчастей: страна и возраст выводятся из справочника, если бренд известен; иначе показываем нейтральное описание. Нажмите логотип, чтобы открыть справку.`,
    color: COLORS[hash % COLORS.length],
    initials: initials(raw),
  };
}

export function brandLogoUrl(profile: BrandProfile) {
  if (!profile.domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(profile.domain)}&sz=64`;
}
