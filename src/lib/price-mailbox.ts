/** Официальный ящик проекта для прайсов. Меняется только через env, не из формы. */
export const PINNED_PRICE_MAILBOX = "prajsy@sadparts.ru";

export type PriceMailboxConfig = {
  address: string;
  localPart: string;
  domain: string;
  secret: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapTls: boolean;
};

export function priceMailboxConfig(): PriceMailboxConfig {
  const address = (process.env.PRICE_MAILBOX_ADDRESS?.trim() || PINNED_PRICE_MAILBOX).toLowerCase();
  const { local: localPart, domain } = splitMailbox(address);
  const port = Number.parseInt(process.env.PRICE_IMAP_PORT || "993", 10);
  return {
    address,
    localPart,
    domain,
    secret: process.env.PRICE_MAILBOX_SECRET?.trim() || "",
    imapHost: process.env.PRICE_IMAP_HOST?.trim() || "",
    imapPort: Number.isFinite(port) && port > 0 ? port : 993,
    imapUser: process.env.PRICE_IMAP_USER?.trim() || "",
    imapPass: process.env.PRICE_IMAP_PASS ?? "",
    imapTls: process.env.PRICE_IMAP_TLS !== "0",
  };
}

export function splitMailbox(address: string) {
  const trimmed = address.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return { local: "prajsy", domain: "sadparts.ru" } as const;
  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) };
}

/** Алиас поставщика: prajsy+armtek@sadparts.ru */
export function plusAliasFor(code: string, mailbox = PINNED_PRICE_MAILBOX) {
  const { local, domain } = splitMailbox(mailbox);
  const tag = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") || "price";
  return `${local}+${tag}@${domain}`;
}

export function plusTagFromAddress(to: string) {
  const local = (to.split("@")[0] ?? "").toLowerCase();
  const plus = local.indexOf("+");
  if (plus < 0) return "";
  return local.slice(plus + 1).replace(/[^a-z0-9]+/g, "");
}

export function mailboxPublicInfo() {
  const cfg = priceMailboxConfig();
  return {
    address: cfg.address,
    plusExample: plusAliasFor("armtek", cfg.address),
    inboundPath: "/api/prices/email/inbound",
    fetchPath: "/api/prices/email/fetch",
    secretConfigured: Boolean(cfg.secret),
    imapConfigured: Boolean(cfg.imapHost && cfg.imapUser && cfg.imapPass),
    hooked: Boolean(cfg.secret) || Boolean(cfg.imapHost && cfg.imapUser && cfg.imapPass),
  };
}

/** Адрес ящика всегда из кода/.env, не из формы настроек. IMAP из env перекрывает store. */
export function overlayMailboxSettings<T extends {
  priceMailboxAddress?: string;
  priceMailboxImapHost?: string;
  priceMailboxImapPort?: number;
  priceMailboxImapUser?: string;
}>(settings: T): T {
  const cfg = priceMailboxConfig();
  return {
    ...settings,
    priceMailboxAddress: cfg.address,
    priceMailboxImapHost: cfg.imapHost || settings.priceMailboxImapHost || "",
    priceMailboxImapPort: cfg.imapHost ? cfg.imapPort : settings.priceMailboxImapPort || 993,
    priceMailboxImapUser: cfg.imapUser || settings.priceMailboxImapUser || "",
  };
}

export function mailboxSecretOk(request: Request) {
  const secret = priceMailboxConfig().secret;
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.replace(/^Bearer\s+/i, "").trim();
  const query = new URL(request.url).searchParams.get("secret") || "";
  const custom = request.headers.get("x-mailbox-secret") || "";
  return [bearer, query, custom].some((value) => value && value === secret);
}
