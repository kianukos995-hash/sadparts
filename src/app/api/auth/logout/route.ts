import { cookieHeader, logoutSession, sessionFromRequest } from "@/lib/auth-store";
import { currentUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export async function POST(request: Request) {
  const user = await currentUser(request);
  const sid = sessionFromRequest(request);
  if (user) {
    await logActivity({
      userId: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      action: "logout",
      detail: `Выход ${user.email}`,
    });
  }
  await logoutSession(sid);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookieHeader("", true) } });
}
