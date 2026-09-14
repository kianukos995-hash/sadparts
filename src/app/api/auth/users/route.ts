import {
  attachClient,
  createDeskUser,
  issueBlankAccessKey,
  listStaffUsers,
  markNoticesRead,
  newAccessKey,
  recordIssuedKey,
  requestAccessKey,
  revokeAccessKey,
  setUserSeeCost,
  takeOrganizationDeskKeys,
  updateKeyOwner,
  updateUserStatus,
} from "@/lib/auth-store";
import { fail, requireUser } from "@/lib/session";
import { ensureKeyClient, readStore, upsertClient, upsertManagerMembership, upsertOrganization } from "@/lib/server-store";
import { logActivity } from "@/lib/activity";
import { ownerFromProfile, ownerFromUnknown } from "@/lib/access-keys";
import { orgAllowsClientKeys } from "@/lib/org-policy";
import { canIssueKeys, canManageStaff } from "@/lib/scope";
import type { PublicUser, UserRole } from "@/lib/types";

async function assertOrgMayIssue(actor: PublicUser) {
  if (actor.role === "admin") return;
  if (actor.role !== "organization" && actor.role !== "manager") return;
  const store = await readStore();
  const org = store.organizations.find((item) => item.id === actor.organizationId);
  if (!orgAllowsClientKeys(org)) {
    throw new Error("Администратор забрал ключ организации. Клиентами управляет админ.");
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!canIssueKeys(user.role) && !canManageStaff(user.role)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    return Response.json(await listStaffUsers(user.role === "admin" ? undefined : user));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser(request);
    if (!canIssueKeys(actor.role) && actor.role !== "client") {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const body = (await request.json()) as {
      action?: string;
      userId?: string;
      status?: "active" | "blocked" | "pending_key";
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      discountPercent?: number;
      markupPercent?: number;
      maxMarkup?: number;
      noticesRead?: boolean;
      keyId?: string;
      organizationId?: string;
      target?: "admin" | "organization";
      seeCost?: boolean;
      incomePercent?: number;
      incomeFixed?: number;
      shiftRate?: number;
      owner?: unknown;
    };
    if (body.noticesRead) {
      if (!canIssueKeys(actor.role)) return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      return Response.json({ notices: await markNoticesRead(actor.role === "admin" ? undefined : actor) });
    }
    if (body.action === "request-key") {
      const rec = await requestAccessKey({
        actor,
        target: body.target === "organization" ? "organization" : "admin",
        organizationId: body.organizationId || actor.organizationId,
        role: actor.role,
        detail: `${actor.email} запрашивает ключ`,
      });
      await logActivity({
        userId: actor.id,
        email: actor.email,
        role: actor.role,
        organizationId: rec.organizationId,
        action: "request_key",
        detail: `Запрос ключа ${rec.role}`,
      });
      return Response.json({ key: rec });
    }
    if (body.action === "revoke" && body.keyId) {
      const rec = await revokeAccessKey(actor, body.keyId);
      await logActivity({
        userId: actor.id,
        email: actor.email,
        role: actor.role,
        organizationId: rec.organizationId,
        action: "revoke_key",
        detail: `Ключ ${rec.key} отозван`,
      });
      return Response.json({ key: rec });
    }
    if (body.action === "take-org-key" && body.organizationId) {
      if (actor.role !== "admin") {
        return Response.json({ error: "Только администратор забирает ключ организации" }, { status: 403 });
      }
      const taken = await takeOrganizationDeskKeys(actor, body.organizationId);
      const store = await readStore();
      const org = store.organizations.find((item) => item.id === body.organizationId);
      if (!org) throw new Error("Организация не найдена");
      await upsertOrganization({
        ...org,
        accessKey: undefined,
        adminControlsClients: true,
        accountStatus: org.accountStatus === "blocked" ? "blocked" : "pending_key",
      });
      await logActivity({
        userId: actor.id,
        email: actor.email,
        role: actor.role,
        organizationId: org.id,
        action: "take_org_key",
        detail: `Ключ организации «${org.name}» забран, клиентами управляет администратор`,
      });
      return Response.json({ keys: taken, organizationId: org.id });
    }
    if (!canIssueKeys(actor.role)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    if (body.action === "set-see-cost" && body.userId) {
      if (actor.role !== "admin") {
        return Response.json({ error: "Только администратор включает закуп" }, { status: 403 });
      }
      const updated = await setUserSeeCost(body.userId, Boolean(body.seeCost));
      await logActivity({
        userId: actor.id,
        email: actor.email,
        role: actor.role,
        action: "see_cost",
        detail: `${updated.email}: ${updated.seeCost ? "видит закуп" : "закуп скрыт"}`,
      });
      return Response.json({ user: updated });
    }
    if (body.action === "issue-blank-key") {
      await assertOrgMayIssue(actor);
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
    }
    if (body.action === "update-key-owner" && body.keyId) {
      const rec = await updateKeyOwner(actor, body.keyId, ownerFromUnknown(body.owner), {
        markupPercent: Number(body.markupPercent),
        discountPercent: Number(body.discountPercent),
        maxMarkup: Number(body.maxMarkup),
      });
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
      await logActivity({
        userId: actor.id,
        email: actor.email,
        role: actor.role,
        organizationId: rec.organizationId,
        clientId: rec.clientId,
        action: "key_owner",
        detail: "Обновлён владелец ключа",
      });
      return Response.json({ key: rec });
    }
    if (body.action === "create-user") {
      await assertOrgMayIssue(actor);
      if (actor.role === "manager") {
        body.role = "client";
      }
      if (actor.role !== "admin" && body.role === "admin") {
        return Response.json({ error: "Нельзя создать администратора" }, { status: 403 });
      }
      if (actor.role === "organization" && body.role !== "manager" && body.role !== "client") {
        return Response.json({ error: "Организация выдаёт ключи менеджерам и клиентам" }, { status: 403 });
      }
      const created = await createDeskUser({
        email: body.email ?? "",
        name: body.name ?? "",
        password: body.password || "Client12345",
        role: body.role || "client",
        organizationId: actor.role === "admin" ? body.organizationId : actor.organizationId,
        issuedByUserId: actor.id,
      });
      return Response.json({ user: created });
    }
    if (!body.userId) throw new Error("Нет пользователя");
    if (body.action === "block" || body.status === "blocked") {
      if (actor.role !== "admin") return Response.json({ error: "Только администратор" }, { status: 403 });
      return Response.json({ user: await updateUserStatus(body.userId, "blocked") });
    }
    if (body.action === "issue-key") {
      await assertOrgMayIssue(actor);
      const staff = await listStaffUsers(actor.role === "admin" ? undefined : actor);
      const target = staff.users.find((item) => item.id === body.userId);
      if (!target) throw new Error("Пользователь не найден");
      if (target.role === "admin") throw new Error("Администратору ключ не нужен");
      if (actor.role === "manager" && target.role !== "client") {
        throw new Error("Менеджер выдаёт ключи только клиентам");
      }
      const store = await readStore();
      const orgId =
        actor.role === "admin"
          ? body.organizationId || target.organizationId
          : actor.organizationId;
      const org = store.organizations.find((item) => item.id === orgId);
      const key = newAccessKey();
      const existing = store.clients.find((item) => item.email === target.email);
      const markup = Number.isFinite(Number(body.markupPercent)) ? Number(body.markupPercent) : 16;
      const capped =
        org?.maxMarkup != null ? Math.min(markup, org.maxMarkup) : markup;
      if (target.role === "organization") {
        const orgRow = store.organizations.find((item) => item.email === target.email) ?? org;
        if (orgRow) {
          await upsertOrganization({
            ...orgRow,
            accessKey: key,
            accountStatus: "active",
            adminControlsClients: false,
            markupPercent: capped,
            discountPercent: Number(body.discountPercent) || orgRow.discountPercent,
            maxMarkup: body.maxMarkup ?? orgRow.maxMarkup,
          });
        }
        const attached = await attachClient(body.userId, existing?.id ?? "", key, {
          organizationId: orgRow?.id || orgId,
          issuedByUserId: actor.id,
          role: "organization",
        });
        await recordIssuedKey({
          key,
          role: "organization",
          issuedBy: actor,
          userId: body.userId,
          organizationId: orgRow?.id || orgId,
          owner: ownerFromProfile(target),
          markupPercent: capped,
          discountPercent: Number(body.discountPercent) || 0,
          maxMarkup: body.maxMarkup,
        });
        await logActivity({
          userId: actor.id,
          email: actor.email,
          role: actor.role,
          organizationId: orgRow?.id || orgId,
          action: "issue_key",
          detail: `Ключ организации ${key} для ${target.email}`,
        });
        return Response.json({ user: attached, accessKey: key });
      }
      const nextStore = await upsertClient({
        id: existing?.id ?? crypto.randomUUID(),
        name: body.name?.trim() || target.name,
        fio: existing?.fio,
        phone: existing?.phone ?? "",
        inn: existing?.inn ?? "",
        email: target.email,
        discountPercent: Number(body.discountPercent) || 0,
        markupPercent: capped,
        bandMarkups: existing?.bandMarkups,
        accessKey: key,
        accountStatus: "active",
        priceView: "clean",
        notes: existing?.notes ?? `Ключ ${key}`,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        telegramChatId: existing?.telegramChatId,
        car: existing?.car,
        vin: existing?.vin,
        plate: existing?.plate,
        year: existing?.year,
        color: existing?.color,
        ownerUserId: existing?.ownerUserId || actor.id,
        organizationId: orgId,
        issuedByUserId: actor.id,
        maxMarkup: body.maxMarkup ?? existing?.maxMarkup ?? org?.maxMarkup,
      });
      const client = nextStore.clients.find((item) => item.email === target.email);
      if (!client) throw new Error("Клиент не создан");
      const attached = await attachClient(body.userId, client.id, key, {
        organizationId: orgId,
        issuedByUserId: actor.id,
        role: target.role === "manager" ? "manager" : "client",
      });
      if (target.role === "manager" && orgId) {
        await upsertManagerMembership({
          id: `mem-${orgId}-${body.userId}`,
          userId: body.userId,
          organizationId: orgId,
          incomePercent: Number(body.incomePercent) || 0,
          incomeFixed: Number(body.incomeFixed) || 0,
          shiftRate: Number(body.shiftRate) || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      await recordIssuedKey({
        key,
        role: target.role === "manager" ? "manager" : "client",
        issuedBy: actor,
        userId: body.userId,
        clientId: client.id,
        organizationId: orgId,
        incomePercent: Number(body.incomePercent) || 0,
        incomeFixed: Number(body.incomeFixed) || 0,
        shiftRate: Number(body.shiftRate) || 0,
        owner: ownerFromProfile(target),
        markupPercent: capped,
        discountPercent: Number(body.discountPercent) || 0,
        maxMarkup: body.maxMarkup,
      });
      await logActivity({
        userId: actor.id,
        email: actor.email,
        role: actor.role,
        clientId: client.id,
        organizationId: orgId,
        action: "issue_key",
        detail: `Ключ ${key} для ${target.email}, наценка ${client.markupPercent}%, скидка ${client.discountPercent}%`,
      });
      return Response.json({ user: attached, client, accessKey: key });
    }
    throw new Error("Неизвестное действие");
  } catch (error) {
    return fail(error);
  }
}
