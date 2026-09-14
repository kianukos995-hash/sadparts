import { cookieHeader, guestCookieFromRequest, guestCookieHeader, guestLogin, requestIp } from "@/lib/auth-store";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/session";
import { ensureGuestClient } from "@/lib/server-store";

export async function POST(request: Request) {
  try {
    const result = await guestLogin({
      cookieId: guestCookieFromRequest(request),
      ip: requestIp(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });
    if (result.user.clientId) {
      await ensureGuestClient({
        clientId: result.user.clientId,
        userId: result.user.id,
        email: result.user.email,
      });
    }
    await logActivity({
      userId: result.user.id,
      email: result.user.email,
      role: "guest",
      clientId: result.user.clientId,
      action: "guest",
      detail: "Вход как гость",
      path: "/login",
    });
    const headers = new Headers();
    headers.append("Set-Cookie", cookieHeader(result.sessionId));
    headers.append("Set-Cookie", guestCookieHeader(result.guestCookieId));
    return Response.json({ user: result.user }, { headers });
  } catch (error) {
    return fail(error);
  }
}
