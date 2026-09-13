import { registerUser } from "@/lib/auth-store";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const result = await registerUser({
      email: body.email ?? "",
      password: body.password ?? "",
      name: body.name ?? "",
    });
    await logActivity({
      email: result.email,
      role: "client",
      action: "register",
      detail: `Регистрация ${result.email}. Ожидает код с почты и ключ администратора.`,
      path: "/register",
    });
    return Response.json({
      ok: true,
      email: result.email,
      message: "Код отправлен на почту. Пока SMTP не настроен, письмо видно администратору в «Сотрудники».",
    });
  } catch (error) {
    return fail(error);
  }
}
