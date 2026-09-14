"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { login, guest, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    router.replace(user.role === "client" || user.role === "guest" ? "/quote" : "/");
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-4 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Вход в SadParts</CardTitle>
          <CardDescription>
            Админ, менеджер и клиент — почта и пароль. Можно зайти гостем: заказ собрать можно,
            скидки нет, наценка рыночная из настроек.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label className="grid gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5">
            <Label>Пароль</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              login(email, password)
                .then((next) => {
                  toast.success("Вход выполнен");
                  router.replace(next.role === "client" || next.role === "guest" ? "/quote" : "/");
                })
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Ошибка"),
                )
                .finally(() => setBusy(false));
            }}
          >
            Войти
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              guest()
                .then(() => {
                  toast.success("Гостевой вход");
                  router.replace("/quote");
                })
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Ошибка"),
                )
                .finally(() => setBusy(false));
            }}
          >
            Войти как гость
          </Button>
          <p className="text-sm text-muted-foreground">
            Нет ключа?{" "}
            <Link href="/register" className="underline">
              Регистрация клиента
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            Тест: admin@sadparts.local / Admin12345 · org@sadparts.local / Org12345 ·
            manager@sadparts.local / Manager12345 · sto@sadparts.local / Client12345
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
