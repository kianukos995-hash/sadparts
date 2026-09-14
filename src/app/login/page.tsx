"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { login, loginByKey, guest, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    router.replace(user.role === "client" || user.role === "guest" ? "/quote" : "/");
  }

  function goHome(role: string) {
    router.replace(role === "client" || role === "guest" ? "/quote" : "/");
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-4 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Вход в SadParts</CardTitle>
          <CardDescription>
            Почта и пароль, именной ключ или анонимный гость по устройству — три разных входа.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email">Почта</TabsTrigger>
              <TabsTrigger value="key">Ключ</TabsTrigger>
              <TabsTrigger value="guest">Гость</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="mt-4 grid gap-3">
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
                      goHome(next.role);
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Войти
              </Button>
            </TabsContent>
            <TabsContent value="key" className="mt-4 grid gap-3">
              <p className="text-sm text-muted-foreground">
                Тот же код, который выдал администратор, организация или менеджер. Сессия будет
                ранга ключа: клиент, именной гость, менеджер или организация.
              </p>
              <label className="grid gap-1.5">
                <Label>Ключ доступа</Label>
                <Input
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="например SP-KEY-DEMO1"
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || busy) return;
                    event.currentTarget.blur();
                    document.getElementById("login-by-key")?.click();
                  }}
                />
              </label>
              <Button
                id="login-by-key"
                disabled={busy || accessKey.trim().length < 6}
                onClick={() => {
                  setBusy(true);
                  loginByKey(accessKey)
                    .then((next) => {
                      toast.success("Вход по ключу выполнен");
                      goHome(next.role);
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ключ не подходит"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Войти по ключу
              </Button>
              <p className="text-xs text-muted-foreground">
                Неверный, отозванный или ещё не выданный ключ — одна и та же ошибка. Список ключей
                не показываем.
              </p>
            </TabsContent>
            <TabsContent value="guest" className="mt-4 grid gap-3">
              <p className="text-sm text-muted-foreground">
                Аноним по этому устройству и сети: корзина своя, скидки нет, наценка рыночная.
                Это не именной гость по ключу — ключ и кнопка гостя не смешиваются.
              </p>
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
            </TabsContent>
          </Tabs>
          <p className="mt-4 text-sm text-muted-foreground">
            Нет ключа?{" "}
            <Link href="/register" className="underline">
              Регистрация клиента
            </Link>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Тест: admin@sadparts.local / Admin12345 · org@sadparts.local / Org12345 ·
            manager@sadparts.local / Manager12345 · sto@sadparts.local / Client12345 · ключ
            SP-KEY-DEMO1
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
