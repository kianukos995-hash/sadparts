import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AccessKeyRecord, AccountStatus, PublicUser, UserRole } from "@/lib/types";
import { EXAMPLE_ORG_ID, EXAMPLE_ORG_USER_ID } from "@/lib/constants";
import { keyedUserIdsFor } from "@/lib/scope";

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
  };
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
    },
  ];
  for (const extra of needed) {
    if (!keys.some((item) => item.id === extra.id || item.key === extra.key)) {
      keys.push(extra);
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
  let users = auth.users.filter((item) => item.role !== "guest");
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
    scopedKeys = keys.filter(
      (key) =>
        key.issuedByUserId === actor.id ||
        (actor.organizationId && key.organizationId === actor.organizationId),
    );
  }
  return {
    users: users.map((item) => ({
      ...publicUser(item),
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt,
    })),
    notices,
    mailbox,
    accessKeys: scopedKeys,
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
}) {
  return enqueue(async () => {
    const auth = await readAuthFile();
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
    };
    auth.accessKeys.unshift(rec);
    await persist(auth);
    return rec;
  });
}

export function revokeAccessKey(actor: PublicUser, keyId: string) {
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
    if (rec.userId) {
      const user = auth.users.find((item) => item.id === rec.userId);
      if (user && user.role !== "admin") user.status = "blocked";
    }
    await persist(auth);
    return rec;
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
