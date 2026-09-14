"use client";

import { useAuth } from "@/hooks/use-auth";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { homeHref } from "@/lib/scope";
import { canManageSuppliers } from "@/lib/suppliers-scope";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function SuppliersGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { organizations, ready } = useAvtoPrice();
  const router = useRouter();
  const ok = canManageSuppliers(user, organizations);

  useEffect(() => {
    if (user && ready && !ok) router.replace(homeHref(user.role));
  }, [ok, ready, router, user]);

  if (!ok) {
    return <p className="text-sm text-muted-foreground">Недостаточно прав. Перенаправляю…</p>;
  }
  return <>{children}</>;
}
