import { attachClient, listStaffUsers, markNoticesRead, newAccessKey, updateUserStatus } from "@/lib/auth-store";
import { fail, requireUser } from "@/lib/session";
import { upsertClient, readStore } from "@/lib/server-store";
import { logActivity } from "@/lib/activity";

export async function GET(request: Request) {
  try {
    await requireUser(request, ["admin"]);
    return Response.json(await listStaffUsers());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireUser(request, ["admin"]);
    const body = (await request.json()) as {
      action?: string;
      userId?: string;
      status?: "active" | "blocked" | "pending_key";
      name?: string;
      discountPercent?: number;
      markupPercent?: number;
      noticesRead?: boolean;
    };
    if (body.noticesRead) {
      return Response.json({ notices: await markNoticesRead() });
    }
    if (!body.userId) throw new Error("Нет пользователя");
    if (body.action === "block" || body.status === "blocked") {
      return Response.json({ user: await updateUserStatus(body.userId, "blocked") });
    }
    if (body.action === "issue-key") {
      const staff = await listStaffUsers();
      const user = staff.users.find((item) => item.id === body.userId);
      if (!user) throw new Error("Пользователь не найден");
      const store = await readStore();
      const key = newAccessKey();
      const existing = store.clients.find((item) => item.email === user.email);
      const nextStore = await upsertClient({
        id: existing?.id ?? crypto.randomUUID(),
        name: body.name?.trim() || user.name,
        phone: existing?.phone ?? "",
        inn: existing?.inn ?? "",
        email: user.email,
        discountPercent: Number(body.discountPercent) || 0,
        markupPercent: Number.isFinite(Number(body.markupPercent)) ? Number(body.markupPercent) : 16,
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
      });
      const client = nextStore.clients.find((item) => item.email === user.email);
      if (!client) throw new Error("Клиент не создан");
      const attached = await attachClient(body.userId, client.id, key);
      await logActivity({
        userId: admin.id,
        email: admin.email,
        role: "admin",
        clientId: client.id,
        action: "issue_key",
        detail: `Ключ ${key} для ${user.email}, наценка ${client.markupPercent}%, скидка ${client.discountPercent}%`,
      });
      return Response.json({ user: attached, client, accessKey: key });
    }
    throw new Error("Неизвестное действие");
  } catch (error) {
    return fail(error);
  }
}
