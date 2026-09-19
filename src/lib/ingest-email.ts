import { appendEmailInbox, readEmailInbox } from "@/lib/email-inbox";
import {
  matchSupplierFromEmail,
  parseEml,
  priceAttachments,
  type ParsedEmail,
} from "@/lib/email-price";
import { importCatalogFile } from "@/lib/import-catalog";
import { plusTagFromAddress, PINNED_PRICE_MAILBOX } from "@/lib/price-mailbox";
import { emptySupplierFromPreset, matchPreset } from "@/lib/supplier-presets";
import { canEditSupplier } from "@/lib/suppliers-scope";
import { readStore, touchSupplierSync, upsertSupplier } from "@/lib/server-store";
import type { EmailInboxItem, ImportMode, PublicUser, Supplier } from "@/lib/types";

export const MAIL_ACTOR: PublicUser = {
  id: "usr-admin",
  email: PINNED_PRICE_MAILBOX,
  name: "Почтовый ящик",
  role: "admin",
  status: "active",
};

function ownerPatch(user: PublicUser): Partial<Supplier> {
  if (user.role === "admin") {
    return { ownerRole: "admin", lockedByAdmin: true, sharedWithOrgIds: [] };
  }
  return {
    ownerRole: "organization",
    ownerId: user.organizationId,
    lockedByAdmin: false,
    sharedWithOrgIds: [],
  };
}

export function emailFromUpload(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  meta: { from?: string; to?: string; subject?: string },
): { email: ParsedEmail; files: { filename: string; data: Buffer }[] } {
  const looksEml = /\.eml$/i.test(fileName) || /message\/rfc822/i.test(contentType);
  if (looksEml) {
    const email = parseEml(buffer);
    if (meta.from) email.from = meta.from;
    if (meta.to) email.to = meta.to;
    if (meta.subject) email.subject = meta.subject;
    const files = priceAttachments(email).map((item) => ({ filename: item.filename, data: item.data }));
    return { email, files };
  }
  const email: ParsedEmail = {
    from: meta.from || "mailbox@local",
    to: meta.to || PINNED_PRICE_MAILBOX,
    subject: meta.subject || fileName,
    text: "",
    attachments: [{ filename: fileName, contentType: contentType || "application/octet-stream", data: buffer }],
  };
  return { email, files: [{ filename: fileName, data: buffer }] };
}

export async function ingestPriceEmail(input: {
  email: ParsedEmail;
  files: { filename: string; data: Buffer }[];
  actor: PublicUser;
  supplierId?: string;
  mode?: ImportMode;
  extraText?: string;
}) {
  const mode = input.mode ?? "replace";
  const store = await readStore();
  const orgs = store.organizations ?? [];
  const email = {
    ...input.email,
    to: input.email.to.trim() || PINNED_PRICE_MAILBOX,
  };
  const tag = plusTagFromAddress(email.to);
  const extra = [input.extraText, tag].filter(Boolean).join(" ");
  let supplier = input.supplierId
    ? store.suppliers.find((item) => item.id === input.supplierId)
    : undefined;
  if (!supplier && tag) {
    supplier = store.suppliers.find(
      (item) =>
        item.code.toLowerCase() === tag ||
        (item.emailAlias ?? "").toLowerCase().includes(`+${tag}@`),
    );
  }
  const matched = matchSupplierFromEmail(email, store.suppliers, extra);
  if (!supplier) supplier = matched.supplier;
  if (!supplier && tag) {
    const preset = matchPreset(tag);
    if (preset) {
      const existing = store.suppliers.find(
        (item) => item.presetId === preset.id || item.code === preset.code,
      );
      supplier = existing;
      if (!existing) {
        matched.preset = preset;
      }
    }
  }

  if (!supplier && matched.preset) {
    const created = {
      ...emptySupplierFromPreset(matched.preset),
      ...ownerPatch(input.actor),
    };
    const nextStore = await upsertSupplier(created);
    supplier = nextStore.suppliers.find((item) => item.id === created.id) ?? created;
  }

  const files = input.files.length ? input.files : priceAttachments(email).map((item) => ({ filename: item.filename, data: item.data }));
  const firstName = files[0]?.filename || "price.bin";
  const inboxBase: Omit<EmailInboxItem, "imported" | "status" | "error" | "skipped"> = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    from: email.from,
    to: email.to,
    subject: email.subject || firstName,
    fileName: firstName,
    supplierId: supplier?.id,
    supplierName: supplier?.name,
    presetId: matched.preset?.id,
  };

  if (!files.length) {
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "error",
      error: "Во вложении нет CSV, XLSX, ZIP или XML",
    });
    return { ok: false as const, status: 422, error: "Во вложении нет CSV, XLSX, ZIP или XML", items };
  }

  if (!supplier) {
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "unmatched",
      error: "Не распознал поставщика. Тема, plus-адрес или имя файла должны содержать его название.",
    });
    return {
      ok: false as const,
      status: 422,
      error: "Не распознал поставщика по теме, адресу или имени файла",
      items,
      match: matched.reason,
    };
  }
  if (!canEditSupplier(supplier, input.actor, orgs)) {
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "error",
      error: "Поставщика закрепил администратор",
    });
    return { ok: false as const, status: 403, error: "Поставщика закрепил администратор", items };
  }

  try {
    let imported = 0;
    let skipped = 0;
    let lastName = firstName;
    for (const [index, file] of files.entries()) {
      const result = await importCatalogFile(
        supplier,
        file.data,
        file.filename,
        index === 0 ? mode : "merge",
        email.subject,
      );
      imported += result.imported;
      skipped += result.skipped;
      lastName = file.filename;
      await touchSupplierSync(
        supplier.id,
        {
          id: result.history.id,
          supplierId: supplier.id,
          at: result.history.at,
          status: "ok",
          imported: result.imported,
          source: "email",
          fileName: file.filename,
          label: result.label,
          mode: index === 0 ? mode : "merge",
        },
        result.imported,
        { columnMap: result.map },
      );
    }
    const items = await appendEmailInbox({
      ...inboxBase,
      supplierId: supplier.id,
      supplierName: supplier.name,
      fileName: lastName,
      imported,
      skipped,
      status: "ok",
    });
    return {
      ok: true as const,
      imported,
      skipped,
      supplierId: supplier.id,
      supplierName: supplier.name,
      fileName: lastName,
      items,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не разобрать прайс";
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "error",
      error: message,
    });
    return { ok: false as const, status: 422, error: message, items };
  }
}

export async function inboxForActor() {
  return readEmailInbox();
}
