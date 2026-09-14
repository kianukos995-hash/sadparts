"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { EXAMPLE_ORG_ID } from "@/lib/constants";
import type { Organization } from "@/lib/types";

function emptyOrg(): Organization {
  return {
    id: crypto.randomUUID(),
    name: "",
    inn: "",
    phone: "",
    notes: "",
    createdAt: new Date().toISOString(),
    createdByUserId: "usr-admin",
    discountPercent: 0,
    markupPercent: 14,
    maxMarkup: 30,
    accountStatus: "active",
  };
}

export default function OrganizationsPage() {
  return (
    <RoleGate allow={["admin"]}>
      <OrganizationsInner />
    </RoleGate>
  );
}

function OrganizationsInner() {
  const { user } = useAuth();
  const { ready, organizations, clients, upsertOrganization, removeOrganization } = useAvtoPrice();
  const [draft, setDraft] = useState<Organization>(emptyOrg());
  const [openId, setOpenId] = useState<string | null>(null);

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю организации…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Организации</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Создаёт только администратор. У новой организации список клиентов пустой — это пример,
            а не чужая база.
          </p>
        </div>
        <Button
          onClick={() => {
            const next = emptyOrg();
            next.createdByUserId = user?.id || "usr-admin";
            setDraft(next);
            setOpenId(next.id);
          }}
        >
          <Plus />
          Новая организация
        </Button>
      </div>

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Организаций нет.
          </CardContent>
        </Card>
      ) : (
        organizations.map((org) => {
          const orgClients = clients.filter((item) => item.organizationId === org.id);
          const editing = openId === org.id ? draft : org;
          return (
            <Card key={org.id}>
              <CardHeader>
                <CardTitle>{org.name}</CardTitle>
                <CardDescription>
                  {org.id === EXAMPLE_ORG_ID
                    ? "Пример. Клиентов нет — список специально пустой."
                    : `${orgClients.length} клиентов`}
                  {org.accessKey ? ` · ключ ${org.accessKey}` : " · ключ не выдан"}
                  {org.maxMarkup != null ? ` · потолок наценки ${org.maxMarkup}%` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <Label>Название</Label>
                    <Input
                      value={editing.name}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({ ...editing, name: event.target.value });
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>Email</Label>
                    <Input
                      value={editing.email ?? ""}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({ ...editing, email: event.target.value });
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>ИНН</Label>
                    <Input
                      value={editing.inn}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({ ...editing, inn: event.target.value });
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>Телефон</Label>
                    <Input
                      value={editing.phone}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({ ...editing, phone: event.target.value });
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>Скидка организации от склада, %</Label>
                    <Input
                      type="number"
                      value={editing.discountPercent}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({
                          ...editing,
                          discountPercent: Number.parseFloat(event.target.value) || 0,
                        });
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>Наценка ключа организации, %</Label>
                    <Input
                      type="number"
                      value={editing.markupPercent ?? ""}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({
                          ...editing,
                          markupPercent:
                            event.target.value === ""
                              ? undefined
                              : Number.parseFloat(event.target.value) || 0,
                        });
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label>Потолок наценки для клиентов, %</Label>
                    <Input
                      type="number"
                      value={editing.maxMarkup ?? ""}
                      onChange={(event) => {
                        setOpenId(org.id);
                        setDraft({
                          ...editing,
                          maxMarkup:
                            event.target.value === ""
                              ? undefined
                              : Number.parseFloat(event.target.value) || 0,
                        });
                      }}
                    />
                  </label>
                </div>
                <label className="grid gap-1.5">
                  <Label>Комментарий</Label>
                  <Textarea
                    rows={2}
                    value={editing.notes}
                    onChange={(event) => {
                      setOpenId(org.id);
                      setDraft({ ...editing, notes: event.target.value });
                    }}
                  />
                </label>
                <div>
                  <p className="mb-2 text-sm font-medium">Клиенты организации</p>
                  {orgClients.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      Пусто. У примера не должно быть чужих СТО и розницы.
                    </p>
                  ) : (
                    <ul className="grid gap-1 text-sm">
                      {orgClients.map((item) => (
                        <li key={item.id}>
                          {item.name} · скидка {item.discountPercent}% · наценка{" "}
                          {item.markupPercent ?? "коридоры"}%
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      void upsertOrganization({
                        ...editing,
                        name: editing.name.trim() || "Организация",
                      }).then(() => {
                        toast.success("Организация сохранена");
                        setOpenId(null);
                      });
                    }}
                  >
                    Сохранить
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void fetch("/api/auth/users", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "create-user",
                          email: editing.email || `org-${editing.id.slice(0, 6)}@sadparts.local`,
                          name: editing.name,
                          role: "organization",
                          organizationId: editing.id,
                          password: "Org12345",
                        }),
                      }).then(async (response) => {
                        const data = (await response.json()) as { user?: { id: string }; error?: string };
                        if (!response.ok) throw new Error(data.error || "Ошибка");
                        const issued = await fetch("/api/auth/users", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "issue-key",
                            userId: data.user?.id,
                            organizationId: editing.id,
                            markupPercent: editing.markupPercent,
                            discountPercent: editing.discountPercent,
                            maxMarkup: editing.maxMarkup,
                          }),
                        });
                        const keyData = (await issued.json()) as { accessKey?: string; error?: string };
                        if (!issued.ok) throw new Error(keyData.error || "Ключ не выдан");
                        toast.success(`Ключ ${keyData.accessKey}`);
                      }).catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                      );
                    }}
                  >
                    Выдать ключ организации
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (!confirm(`Удалить «${org.name}»?`)) return;
                      void removeOrganization(org.id);
                    }}
                  >
                    <Trash2 />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
