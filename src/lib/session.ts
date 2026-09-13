import { getUserBySession, sessionFromRequest, type PublicUser } from "@/lib/auth-store";
import type { UserRole } from "@/lib/types";

export async function currentUser(request: Request) {
  return getUserBySession(sessionFromRequest(request));
}

export async function requireUser(request: Request, roles?: UserRole[]) {
  const user = await currentUser(request);
  if (!user) {
    const error = new Error("Нужен вход");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  if (roles && !roles.includes(user.role)) {
    const error = new Error("Недостаточно прав");
    (error as Error & { status: number }).status = 403;
    throw error;
  }
  return user;
}

export function fail(error: unknown) {
  const status = (error as { status?: number }).status ?? 400;
  const message = error instanceof Error ? error.message : "Ошибка";
  return Response.json({ error: message }, { status });
}

export function jsonUser(user: PublicUser, extra?: Record<string, unknown>) {
  return Response.json({ user, ...extra });
}
