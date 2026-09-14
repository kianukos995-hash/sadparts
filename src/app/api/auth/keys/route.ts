import { issueBlankAccessKey, updateKeyOwner } from "@/lib/auth-store";
import { ownerFromUnknown } from "@/lib/access-keys";
import { fail, requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { canIssueKeys } from "@/lib/scope";
import { ensureKeyClient, readStore, upsertOrganization } from "@/lib/server-store";
import type { AccessKeyRecord, UserRole } from "@/lib/types";

async function syncOwnerSide(rec: AccessKeyRecord) {
  if ((rec.role === "client" || rec.role === "guest") && rec.clientId && rec.userId) {
    await ensureKeyClient({
      clientId: rec.clientId,
      userId: rec.userId,
      accessKey: rec.key,
      owner: rec.owner,
      organizationId: rec.organizationId,
      issuedByUserId: rec.issuedByUserId,
      markupPercent: rec.markupPercent,
      discountPercent: rec.discountPercent,
      maxMarkup: rec.maxMarkup,
      guest: rec.role === "guest",
    });
  }
  if (rec.role === "organization" && rec.organizationId) {
    const store = await readStore();
    const org = store.organizations.find((item) => item.id === rec.organizationId);
    if (org) {
      await upsertOrganization({
        ...org,
        name: rec.owner?.name?.trim() || rec.owner?.fio?.trim() || org.name,
        phone: rec.owner?.phone?.trim() || org.phone,
        email: rec.owner?.email?.trim() || org.email,
      });
    }
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireUser(request);
    if (!canIssueKeys(actor.role)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const body = (await request.json()) as {
      keyId?: string;
      owner?: unknown;
      markupPercent?: number;
      discountPercent?: number;
      maxMarkup?: number;
    };
    if (!body.keyId) throw new Error("Нет ключа");
    const rec = await updateKeyOwner(actor, body.keyId, ownerFromUnknown(body.owner), {
      markupPercent: body.markupPercent,
      discountPercent: body.discountPercent,
      maxMarkup: body.maxMarkup,
    });
    await syncOwnerSide(rec);
    await logActivity({
      userId: actor.id,
      email: actor.email,
      role: actor.role,
      organizationId: rec.organizationId,
      clientId: rec.clientId,
      issuedByUserId: rec.issuedByUserId,
      action: "key_owner",
      detail: "Обновлён владелец ключа",
    });
    return Response.json({ key: rec });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    if (!canIssueKeys(actor.role)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const body = (await request.json()) as {
      role?: UserRole;
      organizationId?: string;
      owner?: unknown;
      markupPercent?: number;
      discountPercent?: number;
      maxMarkup?: number;
      incomePercent?: number;
      incomeFixed?: number;
      shiftRate?: number;
    };
    const rec = await issueBlankAccessKey({
      actor,
      role: body.role || "client",
      organizationId: body.organizationId,
      owner: ownerFromUnknown(body.owner),
      markupPercent: Number(body.markupPercent),
      discountPercent: Number(body.discountPercent),
      maxMarkup: Number(body.maxMarkup),
      incomePercent: Number(body.incomePercent) || 0,
      incomeFixed: Number(body.incomeFixed) || 0,
      shiftRate: Number(body.shiftRate) || 0,
    });
    await logActivity({
      userId: actor.id,
      email: actor.email,
      role: actor.role,
      organizationId: rec.organizationId,
      action: "issue_blank_key",
      detail: `Выдан ключ без пользователя (${rec.role})`,
    });
    return Response.json({ key: rec, accessKey: rec.key });
  } catch (error) {
    return fail(error);
  }
}
