import type { KeyOwner, UserRole } from "@/lib/types";

export const KEY_OWNER_FIELDS = [
  "name",
  "fio",
  "phone",
  "email",
  "carMake",
  "carModel",
  "vin",
  "plate",
  "year",
  "color",
] as const;

export function normalizeAccessKey(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

export function emptyKeyOwner(): KeyOwner {
  return {
    name: "",
    fio: "",
    phone: "",
    email: "",
    carMake: "",
    carModel: "",
    vin: "",
    plate: "",
    year: "",
    color: "",
  };
}

export function mergeKeyOwner(base?: KeyOwner | null, patch?: KeyOwner | null): KeyOwner {
  const next = emptyKeyOwner();
  for (const field of KEY_OWNER_FIELDS) {
    const fromPatch = patch?.[field];
    const fromBase = base?.[field];
    next[field] = (typeof fromPatch === "string" ? fromPatch : fromBase ?? "").trim();
  }
  return next;
}

export function ownerHasData(owner?: KeyOwner | null) {
  if (!owner) return false;
  return KEY_OWNER_FIELDS.some((field) => Boolean(owner[field]?.trim()));
}

export function ownerLabel(owner?: KeyOwner | null, fallback = "без владельца") {
  const name = owner?.fio?.trim() || owner?.name?.trim();
  const phone = owner?.phone?.trim();
  if (name && phone) return `${name} · ${phone}`;
  return name || phone || owner?.email?.trim() || fallback;
}

export function ownerFromProfile(input: {
  name?: string;
  fio?: string;
  phone?: string;
  email?: string;
  carMake?: string;
  carModel?: string;
  vin?: string;
  plate?: string;
  year?: string;
  color?: string;
}): KeyOwner {
  return mergeKeyOwner(undefined, {
    name: input.name,
    fio: input.fio,
    phone: input.phone,
    email: input.email,
    carMake: input.carMake,
    carModel: input.carModel,
    vin: input.vin,
    plate: input.plate,
    year: input.year,
    color: input.color,
  });
}

export function carLine(owner?: KeyOwner | null) {
  return [owner?.carMake, owner?.carModel].filter((item) => item?.trim()).join(" ").trim();
}

export function keyNeedsCar(role?: UserRole) {
  return role === "client" || role === "guest";
}

/** Безопасный разбор тела запроса: только известные строковые поля. */
export function ownerFromUnknown(raw: unknown): KeyOwner {
  if (!raw || typeof raw !== "object") return emptyKeyOwner();
  const source = raw as Record<string, unknown>;
  const patch: KeyOwner = {};
  for (const field of KEY_OWNER_FIELDS) {
    const value = source[field];
    if (typeof value === "string") patch[field] = value;
  }
  return mergeKeyOwner(undefined, patch);
}

export function ownerForRole(role?: UserRole, owner?: KeyOwner | null): KeyOwner {
  const next = mergeKeyOwner(undefined, owner);
  if (keyNeedsCar(role)) return next;
  next.carMake = "";
  next.carModel = "";
  next.vin = "";
  next.plate = "";
  next.year = "";
  next.color = "";
  return next;
}
