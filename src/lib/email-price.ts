import { plusTagFromAddress } from "@/lib/price-mailbox";
import { matchPreset, type SupplierPreset } from "@/lib/supplier-presets";
import type { Supplier } from "@/lib/types";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: EmailAttachment[];
}

const PRICE_EXT = /\.(csv|tsv|txt|xlsx|xls|xml|zip|json|yml|yaml)$/i;

function headerValue(headers: string, name: string) {
  const match = headers.match(new RegExp(`^${name}:\\s*(.*)$`, "im"));
  if (!match) return "";
  let value = match[1].trim();
  const start = headers.indexOf(match[0]) + match[0].length;
  const rest = headers.slice(start);
  const cont = rest.match(/^(?:\r?\n[ \t].*)+/);
  if (cont) value += cont[0].replace(/\r?\n[ \t]+/g, " ");
  return value.replace(/\s+/g, " ").trim();
}

function decodeMimeWord(value: string) {
  return value.replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, (_all, _charset, enc, payload) => {
    if (String(enc).toLowerCase() === "b") {
      return Buffer.from(payload, "base64").toString("utf8");
    }
    const bytes = payload.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m: string, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
    return bytes;
  });
}

function decodePartBody(body: Buffer, encoding: string) {
  const enc = encoding.toLowerCase();
  if (enc === "base64") {
    return Buffer.from(body.toString("latin1").replace(/\s+/g, ""), "base64");
  }
  if (enc === "quoted-printable") {
    const text = body.toString("latin1").replace(/=\r?\n/g, "");
    const bytes = text.replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
    return Buffer.from(bytes, "latin1");
  }
  return body;
}

function splitMultipart(raw: Buffer, boundary: string): Buffer[] {
  const marker = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let cursor = raw.indexOf(marker);
  while (cursor >= 0) {
    const start = cursor + marker.length;
    const next = raw.indexOf(marker, start);
    if (next < 0) break;
    let chunk = raw.subarray(start, next);
    if (chunk[0] === 13 && chunk[1] === 10) chunk = chunk.subarray(2);
    else if (chunk[0] === 10) chunk = chunk.subarray(1);
    if (chunk.toString("latin1").trim() === "--") break;
    parts.push(chunk);
    cursor = next;
  }
  return parts;
}

function parsePart(raw: Buffer): { headers: string; body: Buffer } {
  const text = raw.toString("latin1");
  const split = text.search(/\r?\n\r?\n/);
  if (split < 0) return { headers: "", body: raw };
  const headers = text.slice(0, split);
  const bodyStart = raw.length - Buffer.from(text.slice(split)).length;
  let skip = 2;
  if (text.slice(split, split + 4) === "\r\n\r\n") skip = 4;
  else if (text.slice(split, split + 2) === "\n\n") skip = 2;
  return { headers, body: raw.subarray(bodyStart + skip) };
}

function filenameFromDisposition(headers: string) {
  const disp = headerValue(headers, "Content-Disposition");
  const star = disp.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return star[1];
    }
  }
  const plain = disp.match(/filename="?([^";]+)"?/i);
  return plain ? decodeMimeWord(plain[1].trim()) : "";
}

function collectParts(raw: Buffer, headers: string, into: EmailAttachment[], texts: string[]) {
  const type = headerValue(headers, "Content-Type");
  const encoding = headerValue(headers, "Content-Transfer-Encoding");
  const boundary = type.match(/boundary="?([^";]+)"?/i)?.[1];
  if (/multipart\//i.test(type) && boundary) {
    for (const part of splitMultipart(raw, boundary)) {
      const parsed = parsePart(part);
      collectParts(parsed.body, parsed.headers, into, texts);
    }
    return;
  }
  const data = decodePartBody(raw, encoding);
  const filename = filenameFromDisposition(headers);
  const disp = headerValue(headers, "Content-Disposition");
  const isAttach = /attachment/i.test(disp) || Boolean(filename);
  if (isAttach && filename) {
    into.push({
      filename,
      contentType: type.split(";")[0]?.trim() || "application/octet-stream",
      data,
    });
    return;
  }
  if (/text\/plain/i.test(type) || (!type && !isAttach)) {
    texts.push(data.toString("utf8"));
  }
}

export function parseEml(raw: Buffer): ParsedEmail {
  const parsed = parsePart(raw);
  const attachments: EmailAttachment[] = [];
  const texts: string[] = [];
  collectParts(parsed.body, parsed.headers, attachments, texts);
  return {
    from: decodeMimeWord(headerValue(parsed.headers, "From")),
    to: decodeMimeWord(headerValue(parsed.headers, "To")),
    subject: decodeMimeWord(headerValue(parsed.headers, "Subject")),
    text: texts.join("\n").trim(),
    attachments,
  };
}

export function priceAttachments(email: ParsedEmail) {
  return email.attachments.filter((item) => PRICE_EXT.test(item.filename));
}

export function matchSupplierFromEmail(
  email: Pick<ParsedEmail, "to" | "subject" | "from" | "attachments">,
  suppliers: Supplier[],
  extraText = "",
): { supplier?: Supplier; preset?: SupplierPreset; reason: string } {
  const toLocal = (email.to.split("@")[0] ?? "").toLowerCase();
  const plus = plusTagFromAddress(email.to);
  const hay = [email.to, email.subject, email.from, extraText, plus, ...email.attachments.map((item) => item.filename)]
    .join(" ")
    .toLowerCase();

  const byAlias = suppliers.find((item) => {
    const alias = (item.emailAlias ?? "").toLowerCase();
    const to = email.to.toLowerCase();
    if (alias && (to.includes(alias) || alias.includes(to))) return true;
    const code = item.code.trim().toLowerCase();
    if (plus && (plus === code || alias.includes(`+${plus}@`))) return true;
    return Boolean(code) && (toLocal === code || toLocal.endsWith(`+${code}`));
  });
  if (byAlias) return { supplier: byAlias, reason: "адрес" };

  const byName = suppliers.find((item) => {
    const name = item.name.trim().toLowerCase();
    const code = item.code.trim().toLowerCase();
    return (name.length > 2 && hay.includes(name)) || (code.length > 2 && hay.includes(code));
  });
  if (byName) return { supplier: byName, reason: "название" };

  const preset =
    (plus ? matchPreset(plus) : undefined) ||
    matchPreset(email.subject) ||
    matchPreset(email.to) ||
    matchPreset(extraText) ||
    email.attachments.map((item) => matchPreset(item.filename)).find(Boolean);
  if (preset) {
    const existing = suppliers.find(
      (item) =>
        item.presetId === preset.id ||
        item.code.toUpperCase() === preset.code ||
        item.name.toLowerCase() === preset.name.toLowerCase(),
    );
    return { supplier: existing, preset, reason: existing ? "пресет" : "новый пресет" };
  }
  return { reason: "не распознано" };
}

export function buildSimpleEml(input: {
  from: string;
  to: string;
  subject: string;
  filename: string;
  data: Buffer;
  contentType?: string;
}) {
  const boundary = "----=_SadPartsPrice";
  const encoded = input.data.toString("base64").replace(/(.{76})/g, "$1\r\n");
  const type = input.contentType || "application/octet-stream";
  return Buffer.from(
    [
      `From: ${input.from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Прайс во вложении.",
      `--${boundary}`,
      `Content-Type: ${type}; name="${input.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${input.filename}"`,
      "",
      encoded,
      `--${boundary}--`,
      "",
    ].join("\r\n"),
    "utf8",
  );
}
