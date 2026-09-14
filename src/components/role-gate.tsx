"use client";

import { useAuth } from "@/hooks/use-auth";
import { homeHref } from "@/lib/scope";
import type { UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RoleGate({
  allow,
  children,
}: {
  allow: UserRole[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const ok = Boolean(user && allow.includes(user.role));

  useEffect(() => {
    if (user && !ok) router.replace(homeHref(user.role));
  }, [ok, router, user]);

  if (!ok) {
    return <p className="text-sm text-muted-foreground">Недостаточно прав. Перенаправляю…</p>;
  }
  return <>{children}</>;
}
