export type SpecField = { key: string; placeholder: string };

export const CORE_SPEC_FIELDS: SpecField[] = [
  { key: "Вес, кг", placeholder: "0.35" },
  { key: "Длина, мм", placeholder: "250" },
  { key: "Ширина, мм", placeholder: "80" },
  { key: "Высота, мм", placeholder: "60" },
  { key: "Материал", placeholder: "сталь / резина / пластик" },
  { key: "Страна", placeholder: "Германия" },
  { key: "EAN", placeholder: "штрихкод" },
  { key: "ТН ВЭД", placeholder: "8708…" },
  { key: "Ед. изм.", placeholder: "шт" },
  { key: "Гарантия", placeholder: "12 мес." },
];

export type PartKind =
  | "brake"
  | "filter"
  | "oil"
  | "bearing"
  | "belt"
  | "lamp"
  | "battery"
  | "wiper"
  | "general";

const KIND_LABEL: Record<PartKind, string> = {
  brake: "Тормоза",
  filter: "Фильтры",
  oil: "Масла и жидкости",
  bearing: "Подшипники",
  belt: "Ремни",
  lamp: "Лампы",
  battery: "Аккумуляторы",
  wiper: "Щётки",
  general: "Общие",
};

const EXTRA: Record<PartKind, SpecField[]> = {
  general: [
    { key: "Сторона", placeholder: "лев / прав / перед / зад" },
    { key: "Комплектация", placeholder: "что в коробке" },
  ],
  brake: [
    { key: "Ось", placeholder: "перед / зад" },
    { key: "Сторона", placeholder: "лев / прав" },
    { key: "Диаметр, мм", placeholder: "280" },
    { key: "Толщина, мм", placeholder: "22" },
    { key: "Мин. толщина, мм", placeholder: "20" },
    { key: "Датчик износа", placeholder: "есть / нет" },
  ],
  filter: [
    { key: "Тип фильтра", placeholder: "масляный / воздушный / салон" },
    { key: "Резьба", placeholder: "M20×1.5" },
    { key: "Диаметр, мм", placeholder: "76" },
    { key: "Высота фильтра, мм", placeholder: "90" },
  ],
  oil: [
    { key: "Вязкость SAE", placeholder: "5W-30" },
    { key: "Допуск", placeholder: "ACEA / API / OEM" },
    { key: "Объём, л", placeholder: "1 / 4 / 5" },
    { key: "Тип базы", placeholder: "синтетика / полусинтетика" },
  ],
  bearing: [
    { key: "Внутр. Ø, мм", placeholder: "35" },
    { key: "Наруж. Ø, мм", placeholder: "72" },
    { key: "Ширина подшипника, мм", placeholder: "17" },
    { key: "Тип подшипника", placeholder: "шариковый / ступичный" },
  ],
  belt: [
    { key: "Длина ремня, мм", placeholder: "1230" },
    { key: "Ширина ремня, мм", placeholder: "21" },
    { key: "Ручьи / зубья", placeholder: "6PK / 123z" },
    { key: "Профиль", placeholder: "поликлиновой / ГРМ" },
  ],
  lamp: [
    { key: "Цоколь", placeholder: "H7 / H4 / W5W" },
    { key: "Напряжение, В", placeholder: "12" },
    { key: "Мощность, Вт", placeholder: "55" },
    { key: "Тип лампы", placeholder: "галоген / LED / ксенон" },
  ],
  battery: [
    { key: "Ёмкость, А·ч", placeholder: "60" },
    { key: "Пусковой ток, А", placeholder: "540" },
    { key: "Полярность", placeholder: "прямая / обратная" },
    { key: "Напряжение, В", placeholder: "12" },
  ],
  wiper: [
    { key: "Длина щётки, мм", placeholder: "600" },
    { key: "Тип крепления", placeholder: "крючок / байонет" },
    { key: "Сторона", placeholder: "водитель / пассажир" },
  ],
};

export function partKindOf(name: string, category = "") {
  const text = `${name} ${category}`.toLowerCase();
  if (/колодк|диск торм|тормоз|суппорт|барабан/.test(text)) return "brake";
  if (/фильтр|filter|маслян|воздушн|салонн/.test(text)) return "filter";
  if (/масло|масл |жидкост|антифриз|тормозн. жидк|atf|масло /.test(text)) return "oil";
  if (/подшипник|ступиц|bearing/.test(text)) return "bearing";
  if (/ремень|грм|поликлин|зубчат/.test(text)) return "belt";
  if (/ламп|фара|led|ксенон|h[1-9]\b/.test(text)) return "lamp";
  if (/аккумулятор|акб|battery/.test(text)) return "battery";
  if (/щетк|дворник|стеклоочист/.test(text)) return "wiper";
  return "general";
}

export function partKindLabel(kind: PartKind) {
  return KIND_LABEL[kind];
}

export function specFieldsFor(name: string, category = "") {
  const kind = partKindOf(name, category);
  const extra = EXTRA[kind];
  const seen = new Set<string>();
  const out: SpecField[] = [];
  for (const field of [...CORE_SPEC_FIELDS, ...extra]) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    out.push(field);
  }
  return { kind, label: KIND_LABEL[kind], fields: out };
}
