import { verifyEmail } from "@/lib/auth-store";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; code?: string };
    const user = await verifyEmail(body.email ?? "", body.code ?? "");
    await logActivity({
      userId: user.id,
      email: user.email,
      role: user.role,
      action: "verify_email",
      detail: `${user.email} подтвердила почту, ждёт ключ`,
      path: "/register",
    });
    return Response.json({ user });
  } catch (error) {
    return fail(error);
  }
}
