import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AccessKeyRecord, AccountStatus, KeyOwner, PriceView, PublicUser, UserRole } from "@/lib/types";
import {
  DEMO_LOGIN_KEY,
  DEMO_LOGIN_KEY_CLIENT_ID,
  DEMO_LOGIN_KEY_USER_ID,
  EXAMPLE_ORG_ID,
  EXAMPLE_ORG_USER_ID,
} from "@/lib/constants";
import { keyedUserIdsFor, canEditAccessKey, visibleAccessKeys } from "@/lib/scope";
import {
  mergeKeyOwner,
  normalizeAccessKey,
  ownerFromProfile,
  ownerForRole,
  ownerHasData,
} from "@/lib/access-keys";

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
export const SESSION_COOKIE = "sadparts_sid";
export const GUEST_COOKIE = "sadparts_gid";
const SESSION_DAYS = 30;
const GUEST_DAYS = 400;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  passwordHash: string;
  clientId?: string;
  organizationId?: string;
  issuedByUserId?: string;
  guestCookieId?: string;
  guestFingerprint?: string;
  emailCode?: string;
  emailCodeExpires?: string;
  lastLoginAt?: string;
  createdAt: string;
  seeCost?: boolean;
  avatarUrl?: string;
  phone?: string;
  fio?: string;
  carMake?: string;
  carModel?: string;
  vin?: string;
  plate?: string;
  year?: string;
  color?: string;
  priceView?: PriceView;
}

export interface AuthSession {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StaffNotice {
  id: string;
  at: string;
  kind: "register" | "verify" | "key" | "login" | "org";
  title: string;
  detail: string;
  userId?: string;
  organizationId?: string;
  read: boolean;
}

export interface MailItem {
  id: string;
  at: string;
  to: string;
  subject: string;
  body: string;
}

export interface GuestDevice {
  id: string;
  userId: string;
  clientId: string;
  fingerprint: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthFile {
  users: AuthUser[];
  sessions: AuthSession[];
  notices: StaffNotice[];
  mailbox: MailItem[];
  guests: GuestDevice[];
  accessKeys: AccessKeyRecord[];
}

export type { PublicUser };

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>) {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function emailCode() {
  return String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000));
}

export function newAccessKey() {
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `SP-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function publicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    clientId: user.clientId,
    organizationId: user.organizationId,
    issuedByUserId: user.issuedByUserId,
    seeCost: user.seeCost,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    fio: user.fio,
    carMake: user.carMake,
    carModel: user.carModel,
    vin: user.vin,
    plate: user.plate,
    year: user.year,
    color: user.color,
    priceView: user.priceView,
  };
}

function applyOwnerToUser(
  user: AuthUser,
  owner: KeyOwner | null | undefined,
  users: AuthUser[],
  clearEmpty = false,
) {
  if (!owner) return;
  if (owner.name?.trim()) user.name = owner.name.trim();
  if (owner.fio?.trim()) user.fio = owner.fio.trim();
  else if (clearEmpty && typeof owner.fio === "string") user.fio = "";
  if (owner.phone?.trim()) user.phone = owner.phone.trim();
  else if (clearEmpty && typeof owner.phone === "string") user.phone = "";
  const email = owner.email?.trim().toLowerCase();
  if (email?.includes("@") && user.role !== "admin") {
    const taken = users.some((item) => item.id !== user.id && item.email === email);
    if (!taken) user.email = email;
  }
  const car = (field: "carMake" | "carModel" | "vin" | "plate" | "year" | "color", value?: string) => {
    if (typeof value !== "string") return;
    if (value.trim()) user[field] = value.trim();
    else if (clearEmpty) user[field] = "";
  };
  car("carMake", owner.carMake);
  car("carModel", owner.carModel);
  car("vin", owner.vin);
  car("plate", owner.plate);
  car("year", owner.year);
  car("color", owner.color);
}

function decorateKey(rec: AccessKeyRecord, users: AuthUser[]): AccessKeyRecord {
  const user = rec.userId ? users.find((item) => item.id === rec.userId) : undefined;
  const fromUser = user ? ownerFromProfile(user) : undefined;
  const owner = ownerForRole(rec.role, mergeKeyOwner(fromUser, rec.owner));
  return { ...rec, owner };
}

function statusError(message: string, status: number) {
  const error = new Error(message);
  (error as Error & { status: number }).status = status;
  return error;
}

function invalidKeyError() {
  const error = new Error("Ключ не подходит или отозван");
  (error as Error & { status: number }).status = 401;
  return error;
}

function emptyAuth(): AuthFile {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "usr-admin",
        email: "admin@sadparts.local",
        name: "Администратор",
        role: "admin",
        status: "active",
        passwordHash: hashPassword("Admin12345"),
        createdAt: now,
      },
      {
        id: EXAMPLE_ORG_USER_ID,
        email: "org@sadparts.local",
        name: "Пример организации",
        role: "organization",
        status: "active",
        passwordHash: hashPassword("Org12345"),
        organizationId: EXAMPLE_ORG_ID,
        issuedByUserId: "usr-admin",
        createdAt: now,
      },
      {
        id: "usr-manager",
        email: "manager@sadparts.local",
        name: "Менеджер организации",
        role: "manager",
        status: "active",
        passwordHash: hashPassword("Manager12345"),
        organizationId: EXAMPLE_ORG_ID,
        issuedByUserId: EXAMPLE_ORG_USER_ID,
        createdAt: now,
      },
      {
        id: "usr-sto",
        email: "sto@sadparts.local",
        name: "СТО Север",
        role: "client",
        status: "active",
        passwordHash: hashPassword("Client12345"),
        clientId: "cli-sto",
        issuedByUserId: "usr-admin",
        createdAt: now,
        lastLoginAt: now,
        fio: "Иванов Сергей Петрович",
        phone: "+7 495 120-40-18",
        carMake: "Audi",
        carModel: "A4",
        vin: "WAUZZZ8K9BA123456",
        plate: "А123АА777",
        year: "2012",
        color: "чёрный",
      },
      {
        id: DEMO_LOGIN_KEY_USER_ID,
        email: "keydemo@sadparts.local",
        name: "Ключ-демо",
        fio: "Клюева Дарья Игоревна",
        phone: "+7 495 000-11-22",
        role: "client",
        status: "active",
        passwordHash: hashPassword("KeyDemo12345"),
        clientId: DEMO_LOGIN_KEY_CLIENT_ID,
        issuedByUserId: "usr-admin",
        createdAt: now,
        carMake: "Kia",
        carModel: "Rio",
        vin: "XWEPH81ABD0001234",
        plate: "К001КК777",
        year: "2019",
        color: "белый",
      },
      {
        id: "usr-nova",
        email: "nova@sadparts.local",
        name: "ИП Новикова",
        role: "client",
        status: "pending_key",
        passwordHash: hashPassword("Client12345"),
        createdAt: now,
      },
    ],
    sessions: [],
    notices: [
      {
        id: crypto.randomUUID(),
        at: now,
        kind: "register",
        title: "Тестовая заявка на ключ",
        detail: "nova@sadparts.local подтвердила почту. Нужно выдать ключ, наценку и скидку.",
        userId: "usr-nova",
        read: false,
      },
    ],
    mailbox: [
      {
        id: crypto.randomUUID(),
        at: now,
        to: "nova@sadparts.local",
        subject: "Код регистрации SadParts",
        body: "Тестовый аккаунт уже подтверждён. Для новых регистраций код придёт в это письмо и в админку.",
      },
    ],
    guests: [],
    accessKeys: [
      {
        id: "key-org-demo",
        key: "SP-ORG-DEMO1",
        role: "organization",
        status: "active",
        issuedByUserId: "usr-admin",
        issuedByRole: "admin",
        organizationId: EXAMPLE_ORG_ID,
        userId: EXAMPLE_ORG_USER_ID,
        createdAt: now,
        owner: {
          name: "Пример организации",
          fio: "Пример организации",
          email: "org@sadparts.local",
        },
      },
      {
        id: "key-sto",
        key: "SP-TEST-4812",
        role: "client",
        status: "active",
        issuedByUserId: "usr-admin",
        issuedByRole: "admin",
        userId: "usr-sto",
        clientId: "cli-sto",
        createdAt: now,
        markupPercent: 16,
        discountPercent: 8,
        owner: {
          name: "СТО Север",
          fio: "Иванов Сергей Петрович",
          phone: "+7 495 120-40-18",
          email: "sto@sadparts.local",
          carMake: "Audi",
          carModel: "A4",
          vin: "WAUZZZ8K9BA123456",
          plate: "А123АА777",
          year: "2012",
          color: "чёрный",
        },
      },
      {
        id: "key-manager",
        key: "SP-MGR-DEMO1",
        role: "manager",
        status: "active",
        issuedByUserId: EXAMPLE_ORG_USER_ID,
        issuedByRole: "organization",
        organizationId: EXAMPLE_ORG_ID,
        userId: "usr-manager",
        createdAt: now,
        incomePercent: 5,
        incomeFixed: 50,
        shiftRate: 2500,
        owner: {
          name: "Менеджер организации",
          email: "manager@sadparts.local",
        },
      },
      {
        id: "key-demo-login",
        key: DEMO_LOGIN_KEY,
        role: "client",
        status: "active",
        issuedByUserId: "usr-admin",
        issuedByRole: "admin",
        userId: DEMO_LOGIN_KEY_USER_ID,
        clientId: DEMO_LOGIN_KEY_CLIENT_ID,
        createdAt: now,
        markupPercent: 16,
        discountPercent: 5,
        owner: {
          name: "Ключ-демо",
          fio: "Клюева Дарья Игоревна",
          phone: "+7 495 000-11-22",
          email: "keydemo@sadparts.local",
          carMake: "Kia",
          carModel: "Rio",
          vin: "XWEPH81ABD0001234",
          plate: "К001КК777",
          year: "2019",
          color: "белый",
        },
      },
    ],
  };
}

function migrateAuth(auth: AuthFile): { next: AuthFile; changed: boolean } {
  let changed = false;
  const users = [...auth.users];
  if (!users.some((item) => item.id === EXAMPLE_ORG_USER_ID)) {
    const seed = emptyAuth();
    const extra = seed.users.find((item) => item.id === EXAMPLE_ORG_USER_ID);
    if (extra) {
      users.push(extra);
      changed = true;
    }
  }
  const manager = users.find((item) => item.id === "usr-manager");
  if (manager) {
    if (!manager.organizationId) {
      manager.organizationId = EXAMPLE_ORG_ID;
      changed = true;
    }
    if (!manager.issuedByUserId) {
      manager.issuedByUserId = EXAMPLE_ORG_USER_ID;
      changed = true;
    }
  }
  const sto = users.find((item) => item.id === "usr-sto");
  if (sto && !sto.issuedByUserId) {
    sto.issuedByUserId = "usr-admin";
    changed = true;
  }
  if (!users.some((item) => item.id === DEMO_LOGIN_KEY_USER_ID)) {
    const seed = emptyAuth();
    const extra = seed.users.find((item) => item.id === DEMO_LOGIN_KEY_USER_ID);
    if (extra) {
      users.push(extra);
      changed = true;
    }
  }
  const keyDemo = users.find((item) => item.id === DEMO_LOGIN_KEY_USER_ID);
  if (keyDemo) {
    if (keyDemo.role !== "client") {
      keyDemo.role = "client";
      changed = true;
    }
    if (keyDemo.clientId !== DEMO_LOGIN_KEY_CLIENT_ID) {
      keyDemo.clientId = DEMO_LOGIN_KEY_CLIENT_ID;
      changed = true;
    }
    if (keyDemo.status !== "active") {
      keyDemo.status = "active";
      changed = true;
    }
  }
  const org = users.find((item) => item.id === EXAMPLE_ORG_USER_ID);
  if (org) {
    if (org.role !== "organization") {
      org.role = "organization";
      changed = true;
    }
    if (org.organizationId !== EXAMPLE_ORG_ID) {
      org.organizationId = EXAMPLE_ORG_ID;
      changed = true;
    }
    if (!org.issuedByUserId) {
      org.issuedByUserId = "usr-admin";
      changed = true;
    }
  }
  const keys = Array.isArray(auth.accessKeys) ? [...auth.accessKeys] : [];
  if (!Array.isArray(auth.accessKeys)) changed = true;
  const needed = [
    {
      id: "key-org-demo",
      key: "SP-ORG-DEMO1",
      role: "organization" as const,
      status: "active" as const,
      issuedByUserId: "usr-admin",
      issuedByRole: "admin" as const,
      organizationId: EXAMPLE_ORG_ID,
      userId: EXAMPLE_ORG_USER_ID,
      createdAt: org?.createdAt || new Date().toISOString(),
      owner: {
        name: "Пример организации",
        fio: "Пример организации",
        email: "org@sadparts.local",
      },
    },
    {
      id: "key-sto",
      key: "SP-TEST-4812",
      role: "client" as const,
      status: "active" as const,
      issuedByUserId: "usr-admin",
      issuedByRole: "admin" as const,
      userId: "usr-sto",
      clientId: "cli-sto",
      createdAt: sto?.createdAt || new Date().toISOString(),
      markupPercent: 16,
      discountPercent: 8,
      owner: {
        name: "СТО Север",
        fio: "Иванов Сергей Петрович",
        phone: "+7 495 120-40-18",
        email: "sto@sadparts.local",
        carMake: "Audi",
        carModel: "A4",
        vin: "WAUZZZ8K9BA123456",
        plate: "А123АА777",
        year: "2012",
        color: "чёрный",
      },
    },
    {
      id: "key-manager",
      key: "SP-MGR-DEMO1",
      role: "manager" as const,
      status: "active" as const,
      issuedByUserId: EXAMPLE_ORG_USER_ID,
      issuedByRole: "organization" as const,
      organizationId: EXAMPLE_ORG_ID,
      userId: "usr-manager",
      createdAt: manager?.createdAt || new Date().toISOString(),
      incomePercent: 5,
      incomeFixed: 50,
      shiftRate: 2500,
      owner: {
        name: "Менеджер организации",
        email: "manager@sadparts.local",
      },
    },
    {
      id: "key-demo-login",
      key: DEMO_LOGIN_KEY,
      role: "client" as const,
      status: "active" as const,
      issuedByUserId: "usr-admin",
      issuedByRole: "admin" as const,
      userId: DEMO_LOGIN_KEY_USER_ID,
      clientId: DEMO_LOGIN_KEY_CLIENT_ID,
      createdAt: keyDemo?.createdAt || new Date().toISOString(),
      markupPercent: 16,
      discountPercent: 5,
      owner: {
        name: "Ключ-демо",
        fio: "Клюева Дарья Игоревна",
        phone: "+7 495 000-11-22",
        email: "keydemo@sadparts.local",
        carMake: "Kia",
        carModel: "Rio",
        vin: "XWEPH81ABD0001234",
        plate: "К001КК777",
        year: "2019",
        color: "белый",
      },
    },
  ];
  for (const extra of needed) {
    const found = keys.find((item) => item.id === extra.id || item.key === extra.key);
    if (!found) {
      keys.push(extra);
      changed = true;
    } else if (!ownerHasData(found.owner) && extra.owner) {
      found.owner = extra.owner;
      changed = true;
    }
  }
  return {
    next: {
      users,
      sessions: auth.sessions ?? [],
      notices: auth.notices ?? [],
      mailbox: auth.mailbox ?? [],
      guests: Array.isArray(auth.guests) ? auth.guests : [],
      accessKeys: keys,
    },
    changed: changed || !Array.isArray(auth.guests),
  };
}

async function readAuthFile(): Promise<AuthFile> {
  try {
    const raw = await readFile(AUTH_FILE, "utf8");
    const parsed = JSON.parse(raw) as AuthFile;
    if (!Array.isArray(parsed.users)) throw new Error("bad auth");
    const migrated = migrateAuth({
      users: parsed.users,
      sessions: parsed.sessions ?? [],
      notices: parsed.notices ?? [],
      mailbox: parsed.mailbox ?? [],
      guests: parsed.guests ?? [],
      accessKeys: parsed.accessKeys ?? [],
    });
    if (migrated.changed) {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(AUTH_FILE, JSON.stringify(migrated.next, null, 2), "utf8");
    }
    return migrated.next;
  } catch {
    const initial = emptyAuth();
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(AUTH_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function persist(auth: AuthFile) {
  await mkdir(DATA_DIR, { recursive: true });
  const next: AuthFile = {
    ...auth,
    sessions: auth.sessions.filter((item) => Date.parse(item.expiresAt) > Date.now()).slice(-400),
    notices: auth.notices.slice(0, 200),
    mailbox: auth.mailbox.slice(0, 200),
    guests: (auth.guests ?? []).slice(-400),
    accessKeys: auth.accessKeys ?? [],
  };
  await writeFile(AUTH_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function expireDate() {
  return new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
}

export function readAuth() {
  return enqueue(() => readAuthFile());
}

export function getUserBySession(sessionId: string | undefined) {
  return enqueue(async () => {
    if (!sessionId) return null;
    const auth = await readAuthFile();
    const session = auth.sessions.find(
      (item) => item.id === sessionId && Date.parse(item.expiresAt) > Date.now(),
    );
    if (!session) return null;
    const user = auth.users.find((item) => item.id === session.userId);
    if (!user || user.status === "blocked") return null;
    return publicUser(user);
  });
}

export function loginUser(email: string, password: string) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("Неверный email или пароль");
    }
    if (user.status === "blocked") throw new Error("Аккаунт заблокирован");
    if (user.status === "pending_email") throw new Error("Сначала подтвердите почту кодом из письма");
    const session: AuthSession = {
      id: randomBytes(24).toString("hex"),
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: expireDate(),
    };
    user.lastLoginAt = session.createdAt;
    auth.sessions.push(session);
    await persist(auth);
    return { sessionId: session.id, user: publicUser(user) };
  });
}

export function loginByAccessKey(rawKey: string) {
  return enqueue(async () => {
    const needle = normalizeAccessKey(rawKey);
    if (needle.length < 6) throw invalidKeyError();
    const auth = await readAuthFile();
    const rec = (auth.accessKeys ?? []).find(
      (item) => normalizeAccessKey(item.key) === needle,
    );
    if (!rec || rec.status !== "active") throw invalidKeyError();
    if (rec.role === "admin") throw invalidKeyError();

    let user = rec.userId ? auth.users.find((item) => item.id === rec.userId) : undefined;
    const ownerEmail = rec.owner?.email?.trim().toLowerCase();
    if (!user && ownerEmail) {
      const byEmail = auth.users.find((item) => item.email === ownerEmail);
      if (byEmail && byEmail.role !== "admin" && (byEmail.role === rec.role || byEmail.status === "pending_key")) {
        user = byEmail;
        rec.userId = byEmail.id;
      }
    }
    const now = new Date().toISOString();
    if (!user) {
      const local = rec.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase() || randomBytes(4).toString("hex");
      const email =
        ownerEmail && ownerEmail.includes("@") && !auth.users.some((item) => item.email === ownerEmail)
          ? ownerEmail
          : `key-${local}@sadparts.local`;
      const fallbackName =
        rec.role === "guest"
          ? "Гость по ключу"
          : rec.role === "manager"
            ? "Менеджер"
            : rec.role === "organization"
              ? "Организация"
              : "Клиент";
      user = {
        id: crypto.randomUUID(),
        email,
        name: rec.owner?.name?.trim() || rec.owner?.fio?.trim() || fallbackName,
        fio: rec.owner?.fio,
        phone: rec.owner?.phone,
        role: rec.role,
        status: "active",
        passwordHash: hashPassword(randomBytes(12).toString("hex")),
        organizationId: rec.organizationId,
        issuedByUserId: rec.issuedByUserId,
        createdAt: now,
      };
      applyOwnerToUser(user, rec.owner, auth.users);
      auth.users.push(user);
      rec.userId = user.id;
    }
    if (user.status === "blocked") throw statusError("Аккаунт заблокирован", 403);
    applyOwnerToUser(user, rec.owner, auth.users);
    user.role = rec.role === "guest" || rec.role === "client" || rec.role === "manager" || rec.role === "organization"
      ? rec.role
      : user.role;
    user.status = "active";
    if (rec.organizationId) user.organizationId = rec.organizationId;
    if (rec.issuedByUserId) user.issuedByUserId = user.issuedByUserId || rec.issuedByUserId;
    rec.owner = mergeKeyOwner(ownerFromProfile(user), rec.owner);

    if (rec.role === "client" || rec.role === "guest") {
      const clientId = rec.clientId || user.clientId || `cli-key-${rec.id.slice(0, 8)}`;
      rec.clientId = clientId;
      user.clientId = clientId;
    }

    const session: AuthSession = {
      id: randomBytes(24).toString("hex"),
      userId: user.id,
      createdAt: now,
      expiresAt: expireDate(),
    };
    user.lastLoginAt = now;
    auth.sessions.push(session);
    await persist(auth);
    return {
      sessionId: session.id,
      user: publicUser(user),
      key: decorateKey(rec, auth.users),
    };
  });
}

function guestFingerprint(cookieId: string, ip: string, userAgent: string) {
  return createHash("sha256").update(`${cookieId}|${ip}|${userAgent}`).digest("hex");
}

export function guestLogin(input: { cookieId?: string; ip?: string; userAgent?: string }) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const now = new Date().toISOString();
    const ip = (input.ip || "local").slice(0, 80);
    const userAgent = (input.userAgent || "unknown").slice(0, 240);
    let device = auth.guests.find((item) => input.cookieId && item.id === input.cookieId);
    if (!device) {
      device = auth.guests.find((item) => item.ip === ip && item.userAgent === userAgent);
    }
    let user: AuthUser | undefined = device
      ? auth.users.find((item) => item.id === device!.userId)
      : undefined;
    if (!device || !user) {
      const cookieId = input.cookieId || randomBytes(18).toString("hex");
      const clientId = `cli-guest-${cookieId.slice(0, 12)}`;
      const userId = `usr-guest-${cookieId.slice(0, 12)}`;
      user = {
        id: userId,
        email: `guest-${cookieId.slice(0, 8)}@sadparts.local`,
        name: "Гость",
        role: "guest",
        status: "active",
        passwordHash: hashPassword(randomBytes(12).toString("hex")),
        clientId,
        guestCookieId: cookieId,
        guestFingerprint: guestFingerprint(cookieId, ip, userAgent),
        createdAt: now,
      };
      device = {
        id: cookieId,
        userId,
        clientId,
        fingerprint: user.guestFingerprint!,
        ip,
        userAgent,
        createdAt: now,
        lastSeenAt: now,
      };
      auth.users.push(user);
      auth.guests.push(device);
    } else {
      device.lastSeenAt = now;
      device.ip = ip;
      device.userAgent = userAgent;
      user.guestCookieId = device.id;
      user.clientId = user.clientId || device.clientId;
    }
    user.lastLoginAt = now;
    const session: AuthSession = {
      id: randomBytes(24).toString("hex"),
      userId: user.id,
      createdAt: now,
      expiresAt: expireDate(),
    };
    auth.sessions.push(session);
    await persist(auth);
    return { sessionId: session.id, user: publicUser(user), guestCookieId: device.id };
  });
}

export function logoutSession(sessionId: string | undefined) {
  return enqueue(async () => {
    if (!sessionId) return;
    const auth = await readAuthFile();
    auth.sessions = auth.sessions.filter((item) => item.id !== sessionId);
    await persist(auth);
  });
}

export function registerUser(input: { email: string; password: string; name: string }) {
  return enqueue(async () => {
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim();
    if (!email.includes("@") || input.password.length < 8) {
      throw new Error("Укажите почту и пароль не короче 8 символов");
    }
    const auth = await readAuthFile();
    if (auth.users.some((item) => item.email === email)) {
      throw new Error("Этот email уже зарегистрирован");
    }
    const code = emailCode();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email,
      name: name || email,
      role: "client",
      status: "pending_email",
      passwordHash: hashPassword(input.password),
      emailCode: code,
      emailCodeExpires: new Date(Date.now() + 24 * 3600000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    auth.users.push(user);
    auth.mailbox.unshift({
      id: crypto.randomUUID(),
      at: user.createdAt,
      to: email,
      subject: "Код регистрации SadParts",
      body: `Здравствуйте, ${user.name}. Код подтверждения: ${code}. Введите его на сайте в течение суток.`,
    });
    auth.notices.unshift({
      id: crypto.randomUUID(),
      at: user.createdAt,
      kind: "register",
      title: "Новая регистрация",
      detail: `${user.name} (${email}) запросила доступ. После подтверждения почты выдайте ключ.`,
      userId: user.id,
      read: false,
    });
    await persist(auth);
    return { userId: user.id, email };
  });
}

export function verifyEmail(email: string, code: string) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new Error("Пользователь не найден");
    if (user.status !== "pending_email") throw new Error("Почта уже подтверждена");
    if (!user.emailCode || user.emailCode !== code.trim()) throw new Error("Неверный код");
    if (user.emailCodeExpires && Date.parse(user.emailCodeExpires) < Date.now()) {
      throw new Error("Код устарел, зарегистрируйтесь снова");
    }
    user.status = "pending_key";
    user.emailCode = undefined;
    user.emailCodeExpires = undefined;
    auth.notices.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      kind: "key",
      title: "Нужен ключ доступа",
      detail: `${user.name} (${user.email}) подтвердила почту. Выдайте ключ, наценку и скидку.`,
      userId: user.id,
      read: false,
    });
    await persist(auth);
    return publicUser(user);
  });
}

function staffPayload(auth: AuthFile, actor?: PublicUser) {
  const keys = auth.accessKeys ?? [];
  let users = auth.users;
  if (actor && actor.role !== "admin") {
    users = users.filter((item) => item.role !== "guest");
  }
  let notices = auth.notices;
  let mailbox = auth.mailbox;
  let scopedKeys = keys;
  if (actor && actor.role !== "admin") {
    const keyed = keyedUserIdsFor(actor, keys, users);
    keyed.add(actor.id);
    users = users.filter((item) => {
      if (item.role === "admin") return false;
      if (item.id === actor.id) return true;
      if (keyed.has(item.id)) return true;
      if (actor.organizationId && item.organizationId === actor.organizationId) return true;
      if (item.issuedByUserId === actor.id) return true;
      return false;
    });
    const allowed = new Set(users.map((item) => item.id));
    notices = notices.filter(
      (item) =>
        (item.userId && allowed.has(item.userId)) ||
        (actor.organizationId && item.organizationId === actor.organizationId),
    );
    mailbox = mailbox.filter((item) => users.some((user) => user.email === item.to));
    scopedKeys = visibleAccessKeys(actor, keys);
  }
  return {
    users: users.map((item) => ({
      ...publicUser(item),
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt,
    })),
    notices,
    mailbox,
    accessKeys: scopedKeys.map((item) => decorateKey(item, auth.users)),
  };
}

export function listStaffUsers(actor?: PublicUser) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    return staffPayload(auth, actor);
  });
}

export function updateUserStatus(userId: string, status: AccountStatus) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.id === userId);
    if (!user) throw new Error("Пользователь не найден");
    user.status = status;
    await persist(auth);
    return publicUser(user);
  });
}

export function attachClient(
  userId: string,
  clientId: string,
  accessKey?: string,
  extra?: { organizationId?: string; issuedByUserId?: string; role?: UserRole },
) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.id === userId);
    if (!user) throw new Error("Пользователь не найден");
    user.clientId = clientId;
    user.status = "active";
    if (extra?.organizationId) user.organizationId = extra.organizationId;
    if (extra?.issuedByUserId) user.issuedByUserId = extra.issuedByUserId;
    if (extra?.role) user.role = extra.role;
    auth.mailbox.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      to: user.email,
      subject: "Ключ доступа SadParts",
      body: accessKey
        ? `Доступ открыт. Ваш ключ: ${accessKey}. Войдите почтой и паролем. Ключ сохраните — по нему видно ваши условия.`
        : `Доступ открыт. Войдите с вашей почтой и паролем.`,
    });
    auth.notices.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      kind: "key",
      title: "Ключ выдан",
      detail: `${user.email} активирован, клиент привязан.`,
      userId: user.id,
      organizationId: user.organizationId,
      read: false,
    });
    await persist(auth);
    return publicUser(user);
  });
}

export function requestAccessKey(input: {
  actor: PublicUser;
  target: "admin" | "organization";
  organizationId?: string;
  role?: UserRole;
  detail?: string;
}) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const now = new Date().toISOString();
    const orgId =
      input.organizationId ||
      (input.target === "organization" ? input.actor.organizationId : undefined);
    const orgOwner = orgId
      ? auth.users.find((item) => item.role === "organization" && item.organizationId === orgId)
      : undefined;
    const rec: AccessKeyRecord = {
      id: crypto.randomUUID(),
      key: newAccessKey(),
      role: input.role || (input.actor.role === "organization" ? "organization" : "client"),
      status: "pending",
      issuedByUserId:
        input.target === "admin" ? "usr-admin" : orgOwner?.id || input.actor.id,
      issuedByRole: input.target === "admin" ? "admin" : "organization",
      organizationId: orgId,
      userId: input.actor.id,
      clientId: input.actor.clientId,
      requestedByUserId: input.actor.id,
      requestedByEmail: input.actor.email,
      createdAt: now,
    };
    auth.accessKeys.unshift(rec);
    auth.notices.unshift({
      id: crypto.randomUUID(),
      at: now,
      kind: "key",
      title: input.target === "admin" ? "Запрос ключа администратору" : "Запрос ключа организации",
      detail: input.detail || `${input.actor.email} просит ключ (${ROLE_REQUEST[rec.role]}).`,
      userId: input.actor.id,
      organizationId: orgId,
      read: false,
    });
    await persist(auth);
    return rec;
  });
}

const ROLE_REQUEST: Record<UserRole, string> = {
  admin: "админ",
  organization: "организация",
  manager: "менеджер",
  client: "клиент",
  guest: "гость",
};

export function recordIssuedKey(input: {
  key: string;
  role: UserRole;
  issuedBy: PublicUser;
  userId?: string;
  clientId?: string;
  organizationId?: string;
  incomePercent?: number;
  incomeFixed?: number;
  shiftRate?: number;
  markupPercent?: number;
  discountPercent?: number;
  maxMarkup?: number;
  owner?: KeyOwner | null;
}) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const bound = input.userId ? auth.users.find((item) => item.id === input.userId) : undefined;
    const rec: AccessKeyRecord = {
      id: crypto.randomUUID(),
      key: input.key,
      role: input.role,
      status: "active",
      issuedByUserId: input.issuedBy.id,
      issuedByRole: input.issuedBy.role,
      organizationId: input.organizationId || input.issuedBy.organizationId,
      userId: input.userId,
      clientId: input.clientId,
      createdAt: new Date().toISOString(),
      incomePercent: input.incomePercent,
      incomeFixed: input.incomeFixed,
      shiftRate: input.shiftRate,
      markupPercent: input.markupPercent,
      discountPercent: input.discountPercent,
      maxMarkup: input.maxMarkup,
      owner: ownerForRole(
        input.role,
        mergeKeyOwner(bound ? ownerFromProfile(bound) : undefined, input.owner),
      ),
    };
    auth.accessKeys.unshift(rec);
    await persist(auth);
    return decorateKey(rec, auth.users);
  });
}

function assertCanIssueRole(actor: PublicUser, role: UserRole) {
  if (role === "admin") throw statusError("Администратору ключ не выдают", 403);
  if (actor.role === "manager" && role !== "client" && role !== "guest") {
    throw statusError("Менеджер выдаёт ключи только клиентам и гостям", 403);
  }
  if (actor.role === "organization" && role !== "manager" && role !== "client" && role !== "guest") {
    throw statusError("Организация выдаёт ключи менеджерам, клиентам и гостям", 403);
  }
}

/** Ключ без пользователя: владельца можно дозаполнить позже. */
export function issueBlankAccessKey(input: {
  actor: PublicUser;
  role: UserRole;
  organizationId?: string;
  owner?: KeyOwner | null;
  markupPercent?: number;
  discountPercent?: number;
  maxMarkup?: number;
  incomePercent?: number;
  incomeFixed?: number;
  shiftRate?: number;
}) {
  return enqueue(async () => {
    assertCanIssueRole(input.actor, input.role);
    const auth = await readAuthFile();
    const now = new Date().toISOString();
    const rec: AccessKeyRecord = {
      id: crypto.randomUUID(),
      key: newAccessKey(),
      role: input.role,
      status: "active",
      issuedByUserId: input.actor.id,
      issuedByRole: input.actor.role,
      organizationId:
        input.actor.role === "admin" ? input.organizationId : input.actor.organizationId,
      createdAt: now,
      markupPercent: Number.isFinite(input.markupPercent) ? input.markupPercent : undefined,
      discountPercent: Number.isFinite(input.discountPercent) ? input.discountPercent : undefined,
      maxMarkup: Number.isFinite(input.maxMarkup) ? input.maxMarkup : undefined,
      incomePercent: input.incomePercent,
      incomeFixed: input.incomeFixed,
      shiftRate: input.shiftRate,
      owner: ownerForRole(input.role, input.owner),
    };
    auth.accessKeys.unshift(rec);
    auth.notices.unshift({
      id: crypto.randomUUID(),
      at: now,
      kind: "key",
      title: "Выдан ключ без пользователя",
      detail: `${ROLE_REQUEST[input.role]} · владельца можно дописать на карточке.`,
      userId: input.actor.id,
      organizationId: rec.organizationId,
      read: false,
    });
    await persist(auth);
    return decorateKey(rec, auth.users);
  });
}

export function updateKeyOwner(
  actor: PublicUser,
  keyId: string,
  ownerPatch: KeyOwner | null | undefined,
  extras?: {
    markupPercent?: number;
    discountPercent?: number;
    maxMarkup?: number;
  },
) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const rec = auth.accessKeys.find((item) => item.id === keyId || item.key === keyId);
    if (!rec) throw statusError("Ключ не найден", 404);
    if (!canEditAccessKey(actor, rec)) throw statusError("Нельзя править чужой ключ", 403);
    rec.owner = ownerForRole(rec.role, mergeKeyOwner(rec.owner, ownerPatch));
    if (typeof extras?.markupPercent === "number" && Number.isFinite(extras.markupPercent)) {
      rec.markupPercent = extras.markupPercent;
    }
    if (typeof extras?.discountPercent === "number" && Number.isFinite(extras.discountPercent)) {
      rec.discountPercent = extras.discountPercent;
    }
    if (typeof extras?.maxMarkup === "number" && Number.isFinite(extras.maxMarkup)) {
      rec.maxMarkup = extras.maxMarkup;
    }
    const user = rec.userId ? auth.users.find((item) => item.id === rec.userId) : undefined;
    if (user) {
      applyOwnerToUser(user, rec.owner, auth.users, true);
      rec.owner = ownerForRole(rec.role, mergeKeyOwner(ownerFromProfile(user), rec.owner));
    }
    if (rec.role === "client" || rec.role === "guest") {
      const clientId = rec.clientId || user?.clientId || `cli-key-${rec.id.slice(0, 8)}`;
      rec.clientId = clientId;
      if (user) user.clientId = clientId;
    }
    await persist(auth);
    return decorateKey(rec, auth.users);
  });
}

export function revokeAccessKey(actor: PublicUser, keyId: string, options?: { blockUser?: boolean }) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const rec = auth.accessKeys.find((item) => item.id === keyId || item.key === keyId);
    if (!rec) throw new Error("Ключ не найден");
    const can =
      actor.role === "admin" ||
      rec.issuedByUserId === actor.id ||
      (actor.role === "organization" &&
        actor.organizationId &&
        rec.organizationId === actor.organizationId);
    if (!can) throw new Error("Нельзя отозвать чужой ключ");
    rec.status = "revoked";
    rec.revokedAt = new Date().toISOString();
    rec.revokedByUserId = actor.id;
    if (options?.blockUser !== false && rec.userId) {
      const user = auth.users.find((item) => item.id === rec.userId);
      if (user && user.role !== "admin") user.status = "blocked";
    }
    await persist(auth);
    return rec;
  });
}

/** Забрать ключ организации: кабинет по паролю остаётся, клиентами управляет админ. */
export function takeOrganizationDeskKeys(actor: PublicUser, organizationId: string) {
  return enqueue(async () => {
    if (actor.role !== "admin") throw new Error("Только администратор забирает ключ организации");
    const auth = await readAuthFile();
    const now = new Date().toISOString();
    const taken: AccessKeyRecord[] = [];
    for (const rec of auth.accessKeys) {
      const orgDesk =
        rec.organizationId === organizationId &&
        rec.role === "organization" &&
        rec.status !== "revoked";
      if (!orgDesk) continue;
      rec.status = "revoked";
      rec.revokedAt = now;
      rec.revokedByUserId = actor.id;
      taken.push(rec);
    }
    await persist(auth);
    return taken;
  });
}

export function createDeskUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  organizationId?: string;
  issuedByUserId?: string;
}) {
  return enqueue(async () => {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@") || input.password.length < 8) {
      throw new Error("Укажите почту и пароль не короче 8 символов");
    }
    const auth = await readAuthFile();
    if (auth.users.some((item) => item.email === email)) {
      throw new Error("Этот email уже зарегистрирован");
    }
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email,
      name: input.name.trim() || email,
      role: input.role,
      status: "pending_key",
      passwordHash: hashPassword(input.password),
      organizationId: input.organizationId,
      issuedByUserId: input.issuedByUserId,
      createdAt: new Date().toISOString(),
    };
    auth.users.push(user);
    await persist(auth);
    return publicUser(user);
  });
}

export function markNoticesRead(actor?: PublicUser) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    if (!actor || actor.role === "admin") {
      auth.notices = auth.notices.map((item) => ({ ...item, read: true }));
    } else {
      const allowed = new Set(
        staffPayload(auth, actor).notices.map((item) => item.id),
      );
      auth.notices = auth.notices.map((item) =>
        allowed.has(item.id) ? { ...item, read: true } : item,
      );
    }
    await persist(auth);
    return staffPayload(auth, actor).notices;
  });
}

export function cookieHeader(sessionId: string, clear = false) {
  if (clear) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function guestCookieHeader(guestId: string) {
  return `${GUEST_COOKIE}=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_DAYS * 86400}`;
}

export function sessionFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}

export function guestCookieFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|; )${GUEST_COOKIE}=([^;]+)`));
  return match?.[1];
}

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return ip.slice(0, 80);
}

export function getAuthUserRecord(userId: string) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    return auth.users.find((item) => item.id === userId) ?? null;
  });
}

export function listAccessKeys() {
  return enqueue(async () => {
    const auth = await readAuthFile();
    return auth.accessKeys ?? [];
  });
}

export function updateProfile(
  userId: string,
  patch: {
    name?: string;
    email?: string;
    fio?: string;
    phone?: string;
    avatarUrl?: string;
    carMake?: string;
    carModel?: string;
    vin?: string;
    plate?: string;
    year?: string;
    color?: string;
    priceView?: PriceView;
  },
) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.id === userId);
    if (!user) throw new Error("Пользователь не найден");
    if (typeof patch.name === "string" && patch.name.trim()) user.name = patch.name.trim();
    if (typeof patch.email === "string" && patch.email.includes("@") && user.role !== "guest") {
      const email = patch.email.trim().toLowerCase();
      if (auth.users.some((item) => item.id !== userId && item.email === email)) {
        throw new Error("Этот email уже занят");
      }
      user.email = email;
    }
    if (typeof patch.fio === "string") user.fio = patch.fio.trim();
    if (typeof patch.phone === "string") user.phone = patch.phone.trim();
    if (typeof patch.avatarUrl === "string") user.avatarUrl = patch.avatarUrl;
    if (typeof patch.carMake === "string") user.carMake = patch.carMake.trim();
    if (typeof patch.carModel === "string") user.carModel = patch.carModel.trim();
    if (typeof patch.vin === "string") user.vin = patch.vin.trim();
    if (typeof patch.plate === "string") user.plate = patch.plate.trim();
    if (typeof patch.year === "string") user.year = patch.year.trim();
    if (typeof patch.color === "string") user.color = patch.color.trim();
    if (patch.priceView === "clean" || patch.priceView === "retail") user.priceView = patch.priceView;
    for (const rec of auth.accessKeys ?? []) {
      if (rec.userId === user.id) {
        rec.owner = ownerForRole(rec.role, mergeKeyOwner(rec.owner, ownerFromProfile(user)));
      }
    }
    await persist(auth);
    return publicUser(user);
  });
}

export function setUserSeeCost(userId: string, seeCost: boolean) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.id === userId);
    if (!user) throw new Error("Пользователь не найден");
    user.seeCost = seeCost;
    await persist(auth);
    return publicUser(user);
  });
}
