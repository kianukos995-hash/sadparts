import { cookieHeader, loginUser } from "@/lib/auth-store";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const result = await loginUser(body.email ?? "", body.password ?? "");
    await logActivity({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
      clientId: result.user.clientId,
      organizationId: result.user.organizationId,
      issuedByUserId: result.user.issuedByUserId,
      action: "login",
      detail: `Вход ${result.user.email}`,
      path: "/login",
    });
    return Response.json(
      { user: result.user },
      { headers: { "Set-Cookie": cookieHeader(result.sessionId) } },
    );
  } catch (error) {
    await logActivity({
      action: "login_fail",
      detail: error instanceof Error ? error.message : "Ошибка входа",
      path: "/login",
    });
    return fail(error);
  }
}
