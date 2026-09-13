const moneyCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency = "RUB") {
  const key = currency || "RUB";
  let fmt = moneyCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: key,
      maximumFractionDigits: 2,
    });
    moneyCache.set(key, fmt);
  }
  return fmt.format(amount);
}

export function formatDateTime(iso?: string) {
  if (!iso) return "никогда";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
  }).format(new Date(iso));
}

export function toDateInput(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateInput(value: string) {
  if (!value) return new Date().toISOString();
  const local = new Date(`${value}T12:00:00`);
  if (Number.isNaN(local.getTime())) return new Date().toISOString();
  return local.toISOString();
}

export function formatSignedMoney(amount: number, currency = "RUB") {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatMoney(amount, currency)}`;
}

export function formatStock(stock: number) {
  if (stock <= 0) return "нет";
  if (stock < 5) return `${stock} шт.`;
  return `${stock} шт.`;
}

export function maskKey(key: string) {
  const value = key.trim();
  if (!value) return "не задан";
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

export function normalizeSku(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function offerKey(supplierId: string, sku: string, extra = "") {
  const base = `${supplierId}:${normalizeSku(sku)}`;
  return extra ? `${base}:${extra}` : base;
}

export function daysSince(iso?: string) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export function formatDays(days?: number) {
  const value = Math.round(days || 0);
  if (value <= 0) return "—";
  if (value === 1) return "1 день";
  if (value < 5) return `${value} дня`;
  return `${value} дней`;
}
