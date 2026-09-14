import { cookieHeader, loginByAccessKey } from "@/lib/auth-store";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/session";
import { ensureKeyClient, readStore, upsertManagerMembership, upsertOrganization } from "@/lib/server-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { key?: string };
    const result = await loginByAccessKey(body.key ?? "");
    const rec = result.key;
    // Карточка клиента/гостя по ключу — не устройство и не анонимный гость.
    if ((result.user.role === "client" || result.user.role === "guest") && result.user.clientId) {
      await ensureKeyClient({
        clientId: result.user.clientId,
        userId: result.user.id,
        accessKey: rec.key,
        owner: rec.owner,
        organizationId: rec.organizationId,
        issuedByUserId: rec.issuedByUserId,
        markupPercent: rec.markupPercent,
        discountPercent: rec.discountPercent,
        maxMarkup: rec.maxMarkup,
        guest: result.user.role === "guest",
      });
    }
    if (result.user.role === "manager" && result.user.organizationId) {
      const store = await readStore();
      const exists = store.managerMemberships?.some((item) => item.userId === result.user.id);
      if (!exists) {
        const now = new Date().toISOString();
        await upsertManagerMembership({
          id: `mem-${result.user.organizationId}-${result.user.id}`,
          userId: result.user.id,
          organizationId: result.user.organizationId,
          incomePercent: rec.incomePercent || 0,
          incomeFixed: rec.incomeFixed || 0,
          shiftRate: rec.shiftRate || 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    if (result.user.role === "organization") {
      const store = await readStore();
      const orgId = result.user.organizationId;
      const existing = store.organizations.find(
        (item) => item.id === orgId || item.email === result.user.email,
      );
      if (existing) {
        await upsertOrganization({
          ...existing,
          name: rec.owner?.name?.trim() || rec.owner?.fio?.trim() || existing.name,
          phone: rec.owner?.phone?.trim() || existing.phone,
          email: rec.owner?.email?.trim() || existing.email,
          accessKey: rec.key,
          accountStatus: "active",
        });
      }
    }
    await logActivity({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      clientId: result.user.clientId,
      organizationId: result.user.organizationId,
      issuedByUserId: result.user.issuedByUserId,
      action: "login_key",
      detail: "Вход по ключу",
      path: "/login",
    });
    return Response.json(
      { user: result.user },
      { headers: { "Set-Cookie": cookieHeader(result.sessionId) } },
    );
  } catch (error) {
    await logActivity({
      action: "login_key_fail",
      detail: "Ключ не подошёл",
      path: "/login",
    });
    return fail(error);
  }
}
