import { NextRequest } from "next/server";
import { appendEmailInbox, readEmailInbox } from "@/lib/email-inbox";
import {
  matchSupplierFromEmail,
  parseEml,
  priceAttachments,
  type ParsedEmail,
} from "@/lib/email-price";
import { importCatalogFile } from "@/lib/import-catalog";
import { fail, requireUser } from "@/lib/session";
import { readStore, touchSupplierSync, upsertSupplier } from "@/lib/server-store";
import { emptySupplierFromPreset } from "@/lib/supplier-presets";
import { canEditSupplier, canManageSuppliers } from "@/lib/suppliers-scope";
import type { EmailInboxItem, ImportMode, Supplier } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 80 * 1024 * 1024;

function ownerPatch(user: { role: string; organizationId?: string }): Partial<Supplier> {
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const store = await readStore();
    if (!canManageSuppliers(user, store.organizations ?? [])) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const items = await readEmailInbox();
    return Response.json({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const store = await readStore();
  const orgs = store.organizations ?? [];
  if (!canManageSuppliers(user, orgs)) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const from = String(form.get("from") ?? "").trim();
  const to = String(form.get("to") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();
  const supplierIdHint = String(form.get("supplierId") ?? "").trim();
  const mode = (String(form.get("mode") ?? "replace") === "merge" ? "merge" : "replace") as ImportMode;
  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "Прикрепите письмо .eml или файл прайса" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Файл больше 80 МБ" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const looksEml = /\.eml$/i.test(file.name) || /message\/rfc822/i.test(file.type);
  let email: ParsedEmail;
  let priceFile: { filename: string; data: Buffer };
  if (looksEml) {
    email = parseEml(buffer);
    if (from) email.from = from;
    if (to) email.to = to;
    if (subject) email.subject = subject;
    const attach = priceAttachments(email)[0];
    if (!attach) {
      return Response.json({ error: "Во вложении нет CSV, XLSX, ZIP или XML" }, { status: 422 });
    }
    priceFile = { filename: attach.filename, data: attach.data };
  } else {
    email = {
      from: from || "mailbox@local",
      to: to || "",
      subject: subject || file.name,
      text: "",
      attachments: [{ filename: file.name, contentType: file.type, data: buffer }],
    };
    priceFile = { filename: file.name, data: buffer };
  }

  let supplier = supplierIdHint
    ? store.suppliers.find((item) => item.id === supplierIdHint)
    : undefined;
  const matched = matchSupplierFromEmail(email, store.suppliers, file.name);
  if (!supplier) supplier = matched.supplier;

  if (!supplier && matched.preset) {
    const created = {
      ...emptySupplierFromPreset(matched.preset),
      ...ownerPatch(user),
    };
    const nextStore = await upsertSupplier(created);
    supplier = nextStore.suppliers.find((item) => item.id === created.id) ?? created;
  }

  const inboxBase: Omit<EmailInboxItem, "imported" | "status" | "error" | "skipped"> = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    from: email.from,
    to: email.to,
    subject: email.subject || file.name,
    fileName: priceFile.filename,
    supplierId: supplier?.id,
    supplierName: supplier?.name,
    presetId: matched.preset?.id,
  };

  if (!supplier) {
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "unmatched",
      error: "Не распознал поставщика. Укажите вручную или дайте имя в теме письма.",
    });
    return Response.json(
      { error: "Не распознал поставщика по теме, адресу или имени файла", items, match: matched.reason },
      { status: 422 },
    );
  }
  if (!canEditSupplier(supplier, user, orgs) && supplierIdHint) {
    return Response.json({ error: "Поставщика закрепил администратор" }, { status: 403 });
  }
  if (!canEditSupplier(supplier, user, orgs) && supplier.ownerRole === "admin" && user.role !== "admin") {
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "error",
      error: "Этот поставщик закреплён администратором",
    });
    return Response.json({ error: "Поставщика закрепил администратор", items }, { status: 403 });
  }

  try {
    const result = await importCatalogFile(supplier, priceFile.data, priceFile.filename, mode, email.subject);
    await touchSupplierSync(
      supplier.id,
      {
        id: result.history.id,
        supplierId: supplier.id,
        at: result.history.at,
        status: "ok",
        imported: result.imported,
        source: "email",
        fileName: priceFile.filename,
        label: result.label,
        mode,
      },
      result.imported,
      { columnMap: result.map },
    );
    const items = await appendEmailInbox({
      ...inboxBase,
      supplierId: supplier.id,
      supplierName: supplier.name,
      imported: result.imported,
      skipped: result.skipped,
      status: "ok",
    });
    return Response.json({
      imported: result.imported,
      skipped: result.skipped,
      supplierId: supplier.id,
      supplierName: supplier.name,
      fileName: priceFile.filename,
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не разобрать прайс";
    const items = await appendEmailInbox({
      ...inboxBase,
      imported: 0,
      status: "error",
      error: message,
    });
    return Response.json({ error: message, items }, { status: 422 });
  }
}
