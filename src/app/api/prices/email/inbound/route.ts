import { NextRequest } from "next/server";
import { emailFromUpload, ingestPriceEmail, MAIL_ACTOR } from "@/lib/ingest-email";
import { mailboxPublicInfo, mailboxSecretOk } from "@/lib/price-mailbox";
import { parseEml, priceAttachments } from "@/lib/email-price";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 80 * 1024 * 1024;

/**
 * Сюда почтовый провайдер (Cloudflare Email Routing, Mailgun Inbound, свой forwarder)
 * кладёт сырое письмо. Секрет — PRICE_MAILBOX_SECRET в .env.
 */
export async function GET() {
  return Response.json({
    ok: true,
    mailbox: mailboxPublicInfo(),
    accept: "POST сырое RFC822, multipart file/body-mime или JSON { raw }",
    auth: "Authorization: Bearer PRICE_MAILBOX_SECRET",
  });
}

export async function POST(request: NextRequest) {
  if (!mailboxSecretOk(request)) {
    return Response.json(
      { error: "Нет PRICE_MAILBOX_SECRET или секрет не совпал. Ящик ещё не зацеплен." },
      { status: 401 },
    );
  }
  try {
    const { email, files } = await readInbound(request);
    const result = await ingestPriceEmail({
      email,
      files,
      actor: MAIL_ACTOR,
      extraText: files.map((item) => item.filename).join(" "),
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error, items: result.items, match: "match" in result ? result.match : undefined },
        { status: result.status },
      );
    }
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не принять входящее письмо" },
      { status: 422 },
    );
  }
}

async function readInbound(request: NextRequest) {
  const type = request.headers.get("content-type") || "";
  if (/multipart\/form-data/i.test(type)) {
    const form = await request.formData();
    const file =
      form.get("file") ||
      form.get("message") ||
      form.get("raw") ||
      form.get("mail") ||
      form.get("body-mime");
    if (file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES) throw new Error("Письмо больше 80 МБ");
      return emailFromUpload(buffer, file.name || "letter.eml", file.type, {
        from: String(form.get("from") ?? "").trim(),
        to: String(form.get("to") ?? form.get("recipient") ?? "").trim(),
        subject: String(form.get("subject") ?? "").trim(),
      });
    }
    const mime = form.get("body-mime");
    if (typeof mime === "string" && mime.trim()) {
      const parsed = parseEml(Buffer.from(mime, "utf8"));
      return { email: parsed, files: priceAttachments(parsed).map((item) => ({ filename: item.filename, data: item.data })) };
    }
    throw new Error("В form-data нет письма (file / body-mime)");
  }
  const raw = Buffer.from(await request.arrayBuffer());
  if (!raw.byteLength) throw new Error("Пустое тело письма");
  if (raw.byteLength > MAX_BYTES) throw new Error("Письмо больше 80 МБ");
  if (/json/i.test(type)) {
    const body = JSON.parse(raw.toString("utf8")) as { raw?: string; from?: string; to?: string; subject?: string };
    if (!body.raw) throw new Error("JSON: нужен raw (RFC822)");
    const parsed = parseEml(Buffer.from(body.raw, body.raw.includes("MIME-Version") ? "utf8" : "base64"));
    if (body.from) parsed.from = body.from;
    if (body.to) parsed.to = body.to;
    if (body.subject) parsed.subject = body.subject;
    return { email: parsed, files: priceAttachments(parsed).map((item) => ({ filename: item.filename, data: item.data })) };
  }
  const parsed = parseEml(raw);
  return { email: parsed, files: priceAttachments(parsed).map((item) => ({ filename: item.filename, data: item.data })) };
}
