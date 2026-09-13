"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "code" | "wait">("form");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-4 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Регистрация клиента</CardTitle>
          <CardDescription>
            Почта и пароль. Придёт код. После подтверждения администратор выдаёт ключ, наценку и
            скидку — тогда откроется проценка.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {step === "form" ? (
            <>
              <label className="grid gap-1.5">
                <Label>Имя / организация</Label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="grid gap-1.5">
                <Label>Пароль (от 8 символов)</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, password }),
                  })
                    .then(async (response) => {
                      const data = (await response.json()) as { error?: string; message?: string };
                      if (!response.ok) throw new Error(data.error || "Ошибка");
                      toast.success(data.message || "Код отправлен");
                      setStep("code");
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Получить код
              </Button>
            </>
          ) : null}
          {step === "code" ? (
            <>
              <label className="grid gap-1.5">
                <Label>Код из письма</Label>
                <Input value={code} onChange={(event) => setCode(event.target.value)} />
              </label>
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void fetch("/api/auth/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, code }),
                  })
                    .then(async (response) => {
                      const data = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(data.error || "Код не подошёл");
                      toast.success("Почта подтверждена. Ждите ключ от администратора.");
                      setStep("wait");
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                Подтвердить
              </Button>
            </>
          ) : null}
          {step === "wait" ? (
            <p className="text-sm text-muted-foreground">
              Заявка у администратора. Когда ключ выдадут, войдите с этой почтой и паролем.
            </p>
          ) : null}
          <Link href="/login" className="text-sm underline">
            Уже есть вход
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
