import { NextRequest } from "next/server";
import { fail, requireUser } from "@/lib/session";
import { emailFromUpload, ingestPriceEmail, inboxForActor } from "@/lib/ingest-email";
import { mailboxPublicInfo } from "@/lib/price-mailbox";
import { readStore } from "@/lib/server-store";
import { canManageSuppliers } from "@/lib/suppliers-scope";
import type { ImportMode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 80 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const store = await readStore();
    if (!canManageSuppliers(user, store.organizations ?? [])) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const items = await inboxForActor();
    return Response.json({ items, mailbox: mailboxPublicInfo() });
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
  if (!canManageSuppliers(user, store.organizations ?? [])) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "Прикрепите письмо .eml или файл прайса" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Файл больше 80 МБ" }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = emailFromUpload(buffer, file.name, file.type, {
    from: String(form.get("from") ?? "").trim(),
    to: String(form.get("to") ?? "").trim(),
    subject: String(form.get("subject") ?? "").trim(),
  });
  const mode = (String(form.get("mode") ?? "replace") === "merge" ? "merge" : "replace") as ImportMode;
  const result = await ingestPriceEmail({
    email: parsed.email,
    files: parsed.files,
    actor: user,
    supplierId: String(form.get("supplierId") ?? "").trim() || undefined,
    mode,
    extraText: file.name,
  });
  if (!result.ok) {
    return Response.json(
      { error: result.error, items: result.items, match: "match" in result ? result.match : undefined },
      { status: result.status },
    );
  }
  return Response.json(result);
}
