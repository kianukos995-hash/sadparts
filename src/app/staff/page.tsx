"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/roles";
import type { UserRole, AccountStatus } from "@/lib/types";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  clientId?: string;
  createdAt: string;
  lastLoginAt?: string;
};

type Notice = { id: string; at: string; title: string; detail: string; read: boolean; kind: string };
type Mail = { id: string; at: string; to: string; subject: string; body: string };

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [mailbox, setMailbox] = useState<Mail[]>([]);
  const [markup, setMarkup] = useState("16");
  const [discount, setDiscount] = useState("8");
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    void fetch("/api/auth/users")
      .then(async (response) => {
        const data = (await response.json()) as {
          users?: StaffUser[];
          notices?: Notice[];
          mailbox?: Mail[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Нет доступа");
        setUsers(data.users ?? []);
        setNotices(data.notices ?? []);
        setMailbox(data.mailbox ?? []);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Ошибка"));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ключи и регистрации</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Письма с кодом, заявки на ключ, выдача доступа с наценкой и скидкой.
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50/70">
        <CardHeader>
          <CardTitle>Уведомления</CardTitle>
          <CardDescription>Новая регистрация — просьба выдать ключ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {notices.filter((item) => !item.read).length === 0 ? (
            <p className="text-sm text-muted-foreground">Новых заявок нет.</p>
          ) : (
            notices
              .filter((item) => !item.read)
              .map((item) => (
                <div key={item.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground">{item.detail}</p>
                </div>
              ))
          )}
          <Button
            variant="outline"
            onClick={() => {
              void fetch("/api/auth/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ noticesRead: true }),
              }).then(load);
            }}
          >
            Пометить прочитанными
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>
            После «Выдать ключ» клиент видит чистую цену. Наценку и скидку можно потом поменять в
            карточке клиента.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <Label>Наценка ключа, %</Label>
              <Input value={markup} onChange={(event) => setMarkup(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              <Label>Скидка ключа, %</Label>
              <Input value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </label>
          </div>
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {user.name}{" "}
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>{" "}
                  <Badge variant={user.status === "active" ? "secondary" : "destructive"}>
                    {user.status}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              {user.role === "client" && user.status !== "blocked" ? (
                <Button
                  disabled={busy === user.id}
                  onClick={() => {
                    setBusy(user.id);
                    void fetch("/api/auth/users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "issue-key",
                        userId: user.id,
                        name: user.name,
                        markupPercent: Number.parseFloat(markup.replace(",", ".")) || 0,
                        discountPercent: Number.parseFloat(discount.replace(",", ".")) || 0,
                      }),
                    })
                      .then(async (response) => {
                        const data = (await response.json()) as { accessKey?: string; error?: string };
                        if (!response.ok) throw new Error(data.error || "Ошибка");
                        toast.success(`Ключ ${data.accessKey} — отправьте клиенту`);
                        load();
                      })
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  Выдать ключ
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Исходящие письма (пока без SMTP)</CardTitle>
          <CardDescription>
            Код регистрации и ключ пишутся сюда. Позже подключите почтовый сервер — шаблон тот же.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {mailbox.slice(0, 12).map((item) => (
            <div key={item.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">
                {item.subject} → {item.to}
              </p>
              <p className="whitespace-pre-wrap text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
