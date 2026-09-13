import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AccountStatus, PublicUser, UserRole } from "@/lib/types";
import { GUEST_CLIENT_ID } from "@/lib/roles";

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
export const SESSION_COOKIE = "sadparts_sid";
const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  passwordHash: string;
  clientId?: string;
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
  kind: "register" | "verify" | "key" | "login";
  title: string;
  detail: string;
  userId?: string;
  read: boolean;
}

export interface MailItem {
  id: string;
  at: string;
  to: string;
  subject: string;
  body: string;
}

export interface AuthFile {
  users: AuthUser[];
  sessions: AuthSession[];
  notices: StaffNotice[];
  mailbox: MailItem[];
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

function publicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    clientId: user.clientId,
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
        id: "usr-manager",
        email: "manager@sadparts.local",
        name: "Менеджер склада",
        role: "manager",
        status: "active",
        passwordHash: hashPassword("Manager12345"),
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
  };
}

async function readAuthFile(): Promise<AuthFile> {
  try {
    const raw = await readFile(AUTH_FILE, "utf8");
    const parsed = JSON.parse(raw) as AuthFile;
    if (!Array.isArray(parsed.users)) throw new Error("bad auth");
    return {
      users: parsed.users,
      sessions: parsed.sessions ?? [],
      notices: parsed.notices ?? [],
      mailbox: parsed.mailbox ?? [],
    };
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

export function guestLogin() {
  return enqueue(async () => {
    const auth = await readAuthFile();
    let user = auth.users.find((item) => item.role === "guest");
    const now = new Date().toISOString();
    if (!user) {
      user = {
        id: "usr-guest",
        email: "guest@sadparts.local",
        name: "Гость",
        role: "guest",
        status: "active",
        passwordHash: hashPassword(randomBytes(12).toString("hex")),
        clientId: GUEST_CLIENT_ID,
        createdAt: now,
      };
      auth.users.push(user);
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
    return { sessionId: session.id, user: publicUser(user) };
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

export function listStaffUsers() {
  return enqueue(async () => {
    const auth = await readAuthFile();
    return {
      users: auth.users
        .filter((item) => item.role !== "guest")
        .map((item) => ({
          ...publicUser(item),
          createdAt: item.createdAt,
          lastLoginAt: item.lastLoginAt,
        })),
      notices: auth.notices,
      mailbox: auth.mailbox,
    };
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

export function attachClient(userId: string, clientId: string, accessKey?: string) {
  return enqueue(async () => {
    const auth = await readAuthFile();
    const user = auth.users.find((item) => item.id === userId);
    if (!user) throw new Error("Пользователь не найден");
    user.clientId = clientId;
    user.status = "active";
    auth.mailbox.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      to: user.email,
      subject: "Ключ доступа SadParts",
      body: accessKey
        ? `Доступ открыт. Ваш ключ: ${accessKey}. Войдите почтой и паролем. Ключ сохраните — по нему администратор видит ваши условия.`
        : `Доступ открыт. Войдите с вашей почтой и паролем.`,
    });
    auth.notices.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      kind: "key",
      title: "Ключ выдан",
      detail: `${user.email} активирован, клиент привязан.`,
      userId: user.id,
      read: false,
    });
    await persist(auth);
    return publicUser(user);
  });
}

export function markNoticesRead() {
  return enqueue(async () => {
    const auth = await readAuthFile();
    auth.notices = auth.notices.map((item) => ({ ...item, read: true }));
    await persist(auth);
    return auth.notices;
  });
}

export function cookieHeader(sessionId: string, clear = false) {
  if (clear) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function sessionFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}
