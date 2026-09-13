const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = [
  "",
  "",
  "двадцать",
  "тридцать",
  "сорок",
  "пятьдесят",
  "шестьдесят",
  "семьдесят",
  "восемьдесят",
  "девяносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двести",
  "триста",
  "четыреста",
  "пятьсот",
  "шестьсот",
  "семьсот",
  "восемьсот",
  "девятьсот",
];

function triad(value: number, female: boolean) {
  const ones = female ? ONES_F : ONES_M;
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  const parts: string[] = [];
  if (hundred) parts.push(HUNDREDS[hundred]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const ten = Math.floor(rest / 10);
    const one = rest % 10;
    if (ten) parts.push(TENS[ten]);
    if (one) parts.push(ones[one]);
  }
  return parts.join(" ");
}

function plural(n: number, one: string, few: string, many: string) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function group(value: number, female: boolean, one: string, few: string, many: string) {
  if (!value) return "";
  const words = triad(value, female);
  return `${words} ${plural(value, one, few, many)}`.trim();
}

export function rublesInWords(amount: number) {
  const safe = Math.max(0, Math.round(amount * 100) / 100);
  const rub = Math.floor(safe);
  const kop = Math.round((safe - rub) * 100);
  const millions = Math.floor(rub / 1_000_000);
  const thousands = Math.floor((rub % 1_000_000) / 1000);
  const rest = rub % 1000;
  const parts: string[] = [];
  const million = group(millions, false, "миллион", "миллиона", "миллионов");
  if (million) parts.push(million);
  const thousand = group(thousands, true, "тысяча", "тысячи", "тысяч");
  if (thousand) parts.push(thousand);
  const body = triad(rest, false);
  if (body) parts.push(body);
  if (!parts.length) parts.push("ноль");
  const rubWord = plural(rub, "рубль", "рубля", "рублей");
  const kopWord = plural(kop, "копейка", "копейки", "копеек");
  const kopStr = String(kop).padStart(2, "0");
  const text = `${parts.join(" ")} ${rubWord} ${kopStr} ${kopWord}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatRuDateLong(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatRuDateShort(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

export function invoiceTitle(number: string, iso?: string) {
  return `Заказ клиента № ${number} от ${formatRuDateLong(iso)}`;
}

export function invoiceFileName(number: string, iso?: string) {
  return `Заказ клиента ${number} от ${formatRuDateShort(iso)}.xlsx`;
}
