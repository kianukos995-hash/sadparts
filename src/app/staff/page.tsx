"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import {
  carLine,
  emptyKeyOwner,
  keyNeedsCar,
  mergeKeyOwner,
  ownerHasData,
  ownerLabel,
} from "@/lib/access-keys";
import { ROLE_LABELS } from "@/lib/roles";
import type { AccessKeyRecord, KeyOwner, UserRole, AccountStatus } from "@/lib/types";

type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: AccountStatus;
  clientId?: string;
  organizationId?: string;
  createdAt: string;
  lastLoginAt?: string;
  avatarUrl?: string;
  phone?: string;
  fio?: string;
};

type Notice = { id: string; at: string; title: string; detail: string; read: boolean; kind: string };
type Mail = { id: string; at: string; to: string; subject: string; body: string };

const ROLE_ISSUE: Record<UserRole, UserRole[]> = {
  admin: ["client", "guest", "manager", "organization"],
  organization: ["client", "guest", "manager"],
  manager: ["client", "guest"],
  client: [],
  guest: [],
};

export default function StaffPage() {
  return (
    <RoleGate allow={["admin", "organization", "manager"]}>
      <StaffInner />
    </RoleGate>
  );
}

function StaffInner() {
  const { user: actor } = useAuth();
  const admin = actor?.role === "admin";
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [mailbox, setMailbox] = useState<Mail[]>([]);
  const [keys, setKeys] = useState<AccessKeyRecord[]>([]);
  const [markup, setMarkup] = useState("16");
  const [discount, setDiscount] = useState("8");
  const [maxMarkup, setMaxMarkup] = useState("");
  const [incomePercent, setIncomePercent] = useState("5");
  const [incomeFixed, setIncomeFixed] = useState("50");
  const [shiftRate, setShiftRate] = useState("2500");
  const [busy, setBusy] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>(actor?.role === "manager" ? "client" : "client");
  const [blankRole, setBlankRole] = useState<UserRole>("client");
  const [blankOwner, setBlankOwner] = useState<KeyOwner>(emptyKeyOwner());
  const [openKeyId, setOpenKeyId] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState<KeyOwner>(emptyKeyOwner());

  const issueRoles = actor ? ROLE_ISSUE[actor.role] : [];

  function load() {
    void fetch("/api/auth/users")
      .then(async (response) => {
        const data = (await response.json()) as {
          users?: StaffUser[];
          notices?: Notice[];
          mailbox?: Mail[];
          accessKeys?: AccessKeyRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(data.error || "Нет доступа");
        setUsers(data.users ?? []);
        setNotices(data.notices ?? []);
        setMailbox(data.mailbox ?? []);
        setKeys(data.accessKeys ?? []);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Ошибка"));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {admin ? "Ключи и регистрации" : "Ключи клиентов"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {admin
            ? "Письма с кодом, заявки, выдача ключа с владельцем, наценкой и скидкой. Ключ действует, пока его не отзовёт выдавший или администратор."
            : actor?.role === "manager"
              ? "Только ключи, которые выдали вы. Чужие коды и профили не показываем."
              : "Только люди и ключи вашей организации. Администратора и чужие кабинеты не видно."}
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50/70">
        <CardHeader>
          <CardTitle>Уведомления</CardTitle>
          <CardDescription>Заявка на ключ или новая регистрация.</CardDescription>
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

      {actor?.role === "organization" || actor?.role === "manager" ? (
        <Card>
          <CardHeader>
            <CardTitle>Создать пользователя</CardTitle>
            <CardDescription>
              {actor.role === "manager"
                ? "Менеджер заводит клиента своей организации."
                : "Организация заводит менеджера или клиента. Ключ выдайте отдельно."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <Label>Имя</Label>
              <Input value={newName} onChange={(event) => setNewName(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
              />
            </label>
            {actor.role === "organization" ? (
              <label className="grid gap-1 text-xs">
                <Label>Роль</Label>
                <select
                  className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as UserRole)}
                >
                  <option value="client">Клиент</option>
                  <option value="manager">Менеджер</option>
                </select>
              </label>
            ) : null}
            <div className="flex items-end">
              <Button
                onClick={() => {
                  void fetch("/api/auth/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "create-user",
                      email: newEmail,
                      name: newName,
                      role: actor.role === "manager" ? "client" : newRole,
                      password: "Client12345",
                    }),
                  })
                    .then(async (response) => {
                      const data = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(data.error || "Ошибка");
                      toast.success("Пользователь создан, выдайте ключ");
                      setNewEmail("");
                      setNewName("");
                      load();
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    );
                }}
              >
                Создать
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>
            После «Выдать ключ» клиент видит чистую цену. Наценку и скидку можно потом поменять в
            карточке клиента. Владельца ключа можно дописать сразу или позже.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">
              <Label>Наценка ключа, %</Label>
              <Input value={markup} onChange={(event) => setMarkup(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              <Label>Скидка ключа, %</Label>
              <Input value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </label>
            {admin ? (
              <label className="grid gap-1 text-xs">
                <Label>Потолок наценки, %</Label>
                <Input value={maxMarkup} onChange={(event) => setMaxMarkup(event.target.value)} />
              </label>
            ) : null}
          </div>
          {actor?.role === "organization" ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs">
                <Label>% от сделок (менеджер)</Label>
                <Input value={incomePercent} onChange={(event) => setIncomePercent(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs">
                <Label>Фикс за заказ, ₽</Label>
                <Input value={incomeFixed} onChange={(event) => setIncomeFixed(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs">
                <Label>Стоимость смены, ₽</Label>
                <Input value={shiftRate} onChange={(event) => setShiftRate(event.target.value)} />
              </label>
            </div>
          ) : null}
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">В этом кабинете пользователей нет.</p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <AvatarBubble src={user.avatarUrl} name={user.fio || user.name} />
                  <div>
                    <p className="font-medium">
                      {user.fio || user.name}{" "}
                      <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>{" "}
                      <Badge variant={user.status === "active" ? "secondary" : "destructive"}>
                        {user.status}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                      {user.phone ? ` · ${user.phone}` : ""}
                    </p>
                  </div>
                </div>
                {user.role !== "admin" && user.status !== "blocked" && user.role !== "guest" ? (
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
                          organizationId: user.organizationId || actor?.organizationId,
                          maxMarkup: maxMarkup === "" ? undefined : Number.parseFloat(maxMarkup),
                          incomePercent: Number.parseFloat(incomePercent.replace(",", ".")) || 0,
                          incomeFixed: Number.parseFloat(incomeFixed.replace(",", ".")) || 0,
                          shiftRate: Number.parseFloat(shiftRate.replace(",", ".")) || 0,
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
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Выдать ключ без пользователя</CardTitle>
          <CardDescription>
            Можно оставить карточку пустой и дописать ФИО, телефон и авто позже. По этому коду
            человек входит на вкладке «Ключ».
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <Label>Ранг ключа</Label>
              <Select
                value={blankRole}
                onValueChange={(value) => {
                  if (!value) return;
                  setBlankRole(value as UserRole);
                }}
              >
                <SelectTrigger className="w-full">
                  <span className="flex flex-1 truncate text-left">{ROLE_LABELS[blankRole]}</span>
                </SelectTrigger>
                <SelectContent>
                  {issueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <OwnerFields value={blankOwner} onChange={setBlankOwner} withCar={keyNeedsCar(blankRole)} />
          <Button
            disabled={busy === "blank"}
            onClick={() => {
              setBusy("blank");
              void fetch("/api/auth/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  role: blankRole,
                  owner: blankOwner,
                  markupPercent: Number.parseFloat(markup.replace(",", ".")) || 0,
                  discountPercent: Number.parseFloat(discount.replace(",", ".")) || 0,
                  maxMarkup: maxMarkup === "" ? undefined : Number.parseFloat(maxMarkup),
                  incomePercent: Number.parseFloat(incomePercent.replace(",", ".")) || 0,
                  incomeFixed: Number.parseFloat(incomeFixed.replace(",", ".")) || 0,
                  shiftRate: Number.parseFloat(shiftRate.replace(",", ".")) || 0,
                }),
              })
                .then(async (response) => {
                  const data = (await response.json()) as { accessKey?: string; error?: string };
                  if (!response.ok) throw new Error(data.error || "Ошибка");
                  toast.success(`Ключ ${data.accessKey} — можно отдать человеку`);
                  setBlankOwner(emptyKeyOwner());
                  load();
                })
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Ошибка"),
                )
                .finally(() => setBusy(null));
            }}
          >
            Выдать пустой ключ
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Выданные ключи</CardTitle>
          <CardDescription>
            В списке — кому принадлежит код, не только сам код. Отозвать может выдавший или
            администратор.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {actor?.role === "manager"
                ? "Вы ещё не выдавали ключи."
                : "Ключей нет."}
            </p>
          ) : (
            keys.map((key) => {
              const holder = users.find((item) => item.id === key.userId);
              const open = openKeyId === key.id;
              return (
                <div key={key.id} className="grid gap-2 rounded-lg border px-3 py-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <AvatarBubble
                        src={holder?.avatarUrl}
                        name={key.owner?.fio || key.owner?.name || holder?.name}
                      />
                      <div>
                        <p className="font-medium">{ownerLabel(key.owner)}</p>
                        <p className="font-mono text-xs text-muted-foreground">{key.key}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABELS[key.role]} · {key.status}
                          {key.requestedByEmail ? ` · запрос ${key.requestedByEmail}` : ""}
                          {keyNeedsCar(key.role) && carLine(key.owner)
                            ? ` · ${carLine(key.owner)}`
                            : ""}
                          {key.role === "manager"
                            ? ` · ${key.incomePercent ?? 0}% / фикс ${key.incomeFixed ?? 0} ₽ / смена ${key.shiftRate ?? 0} ₽`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {key.status !== "revoked" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (open) {
                              setOpenKeyId(null);
                              return;
                            }
                            setOpenKeyId(key.id);
                            setOwnerDraft(mergeKeyOwner(emptyKeyOwner(), key.owner));
                          }}
                        >
                          {open ? "Скрыть карточку" : "Владелец"}
                        </Button>
                      ) : null}
                      {key.status !== "revoked" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void fetch("/api/auth/users", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "revoke", keyId: key.id }),
                            })
                              .then(async (response) => {
                                const data = (await response.json()) as { error?: string };
                                if (!response.ok) throw new Error(data.error || "Ошибка");
                                toast.success("Ключ отозван");
                                load();
                              })
                              .catch((error: unknown) =>
                                toast.error(error instanceof Error ? error.message : "Ошибка"),
                              );
                          }}
                        >
                          Отозвать
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {open ? (
                    <div className="grid gap-3 border-t pt-3">
                      {!ownerHasData(key.owner) ? (
                        <p className="text-xs text-muted-foreground">
                          Карточка пустая — ключ уже действует. Допишите, кому он принадлежит.
                        </p>
                      ) : null}
                      <OwnerFields
                        value={ownerDraft}
                        onChange={setOwnerDraft}
                        withCar={keyNeedsCar(key.role)}
                      />
                      <Button
                        disabled={busy === key.id}
                        onClick={() => {
                          setBusy(key.id);
                          void fetch("/api/auth/keys", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ keyId: key.id, owner: ownerDraft }),
                          })
                            .then(async (response) => {
                              const data = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(data.error || "Ошибка");
                              toast.success("Владелец сохранён, профиль синхронизирован");
                              setOpenKeyId(null);
                              load();
                            })
                            .catch((error: unknown) =>
                              toast.error(error instanceof Error ? error.message : "Ошибка"),
                            )
                            .finally(() => setBusy(null));
                        }}
                      >
                        Сохранить владельца
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {admin || actor?.role === "organization" ? (
        <Card>
          <CardHeader>
            <CardTitle>Исходящие письма (пока без SMTP)</CardTitle>
            <CardDescription>
              Код регистрации и ключ пишутся сюда. Позже подключите почтовый сервер — шаблон тот же.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {mailbox.length === 0 ? (
              <p className="text-sm text-muted-foreground">Писем пока нет.</p>
            ) : (
              mailbox.slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-lg border px-3 py-2 text-sm">
                  <p className="font-medium">
                    {item.subject} → {item.to}
                  </p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{item.body}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {actor?.role === "organization" ? (
        <Button
          variant="outline"
          onClick={() => {
            void fetch("/api/auth/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "request-key", target: "admin" }),
            })
              .then(async (response) => {
                const data = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(data.error || "Ошибка");
                toast.success("Запрос ключа отправлен администратору");
                load();
              })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              );
          }}
        >
          Запросить ключ у администратора
        </Button>
      ) : null}
    </div>
  );
}

function AvatarBubble({ src, name }: { src?: string; name?: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-sm font-semibold">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- локальный аватар
        <img src={src} alt="" className="size-10 object-cover" />
      ) : (
        (name || "?").slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function OwnerFields({
  value,
  onChange,
  withCar,
}: {
  value: KeyOwner;
  onChange: (next: KeyOwner) => void;
  withCar: boolean;
}) {
  const next = useMemo(() => mergeKeyOwner(emptyKeyOwner(), value), [value]);
  function patch(field: keyof KeyOwner, raw: string) {
    onChange({ ...next, [field]: raw });
  }
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <Label>{withCar ? "ФИО" : "ФИО / название"}</Label>
          <Input
            value={next.fio || next.name}
            onChange={(event) => {
              const raw = event.target.value;
              onChange({ ...next, fio: raw, name: raw });
            }}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <Label>Телефон</Label>
          <Input value={next.phone} onChange={(event) => patch("phone", event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs sm:col-span-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={next.email}
            onChange={(event) => patch("email", event.target.value)}
          />
        </label>
      </div>
      {withCar ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <Label>Марка</Label>
            <Input value={next.carMake} onChange={(event) => patch("carMake", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>Модель</Label>
            <Input value={next.carModel} onChange={(event) => patch("carModel", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>VIN</Label>
            <Input value={next.vin} onChange={(event) => patch("vin", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>Госномер</Label>
            <Input value={next.plate} onChange={(event) => patch("plate", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>Год</Label>
            <Input value={next.year} onChange={(event) => patch("year", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>Цвет</Label>
            <Input value={next.color} onChange={(event) => patch("color", event.target.value)} />
          </label>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Для менеджера и организации авто не спрашиваем.</p>
      )}
    </div>
  );
}
