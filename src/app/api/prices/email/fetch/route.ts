import { NextRequest } from "next/server";
import { fail, requireUser } from "@/lib/session";
import { ingestPriceEmail, MAIL_ACTOR } from "@/lib/ingest-email";
import { fetchUnseenMail } from "@/lib/imap-fetch";
import { mailboxPublicInfo, mailboxSecretOk, priceMailboxConfig } from "@/lib/price-mailbox";
import { parseEml, priceAttachments } from "@/lib/email-price";
import { readStore } from "@/lib/server-store";
import { canManageSuppliers } from "@/lib/suppliers-scope";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Забрать непрочитанные письма из закреплённого ящика (IMAP из .env). */
export async function POST(request: NextRequest) {
  const bySecret = mailboxSecretOk(request);
  if (!bySecret) {
    try {
      const user = await requireUser(request);
      const store = await readStore();
      if (!canManageSuppliers(user, store.organizations ?? [])) {
        return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      }
    } catch (error) {
      return fail(error);
    }
  }
  const cfg = priceMailboxConfig();
  if (!cfg.imapHost || !cfg.imapUser || !cfg.imapPass) {
    return Response.json(
      {
        error: "IMAP не зацеплен. В .env: PRICE_IMAP_HOST, PRICE_IMAP_USER, PRICE_IMAP_PASS.",
        mailbox: mailboxPublicInfo(),
      },
      { status: 400 },
    );
  }
  try {
    const unseen = await fetchUnseenMail();
    const results = [];
    for (const message of unseen) {
      const email = parseEml(message.raw);
      const files = priceAttachments(email).map((item) => ({ filename: item.filename, data: item.data }));
      results.push(
        await ingestPriceEmail({
          email,
          files,
          actor: MAIL_ACTOR,
          extraText: files.map((item) => item.filename).join(" "),
        }),
      );
    }
    return Response.json({
      fetched: unseen.length,
      imported: results.filter((item) => item.ok).length,
      results,
      mailbox: mailboxPublicInfo(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "IMAP не ответил", mailbox: mailboxPublicInfo() },
      { status: 502 },
    );
  }
}
