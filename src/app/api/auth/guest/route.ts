import { cookieHeader, guestLogin } from "@/lib/auth-store";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/session";

export async function POST() {
  try {
    const result = await guestLogin();
    await logActivity({
      userId: result.user.id,
      email: result.user.email,
      role: "guest",
      clientId: result.user.clientId,
      action: "guest",
      detail: "Вход как гость",
      path: "/login",
    });
    return Response.json(
      { user: result.user },
      { headers: { "Set-Cookie": cookieHeader(result.sessionId) } },
    );
  } catch (error) {
    return fail(error);
  }
}
