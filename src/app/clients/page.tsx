"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { formatBandLabel, markupForPrice } from "@/lib/price-bands";
import { clientPriceBreakdown, discountBreakEvenPercent } from "@/lib/pricing";
import { PriceFormula } from "@/components/price-formula";
import type { Client, Organization, PriceBand, PublicUser } from "@/lib/types";

function emptyClient(ownerUserId?: string, organizationId?: string): Client {
  return {
    id: crypto.randomUUID(),
    name: "",
    fio: "",
    phone: "",
    inn: "",
    discountPercent: 0,
    bandMarkups: {},
    notes: "",
    createdAt: new Date().toISOString(),
    ownerUserId,
    organizationId,
    issuedByUserId: ownerUserId,
  };
}

type StaffUser = PublicUser & { createdAt?: string };

export default function ClientsPage() {
  return (
    <RoleGate allow={["admin", "organization", "manager", "client"]}>
      <ClientsInner />
    </RoleGate>
  );
}

function ClientsInner() {
  const { user } = useAuth();
  const { ready, clients, organizations, settings, upsertClient, removeClient } = useAvtoPrice();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Client>(emptyClient(user?.id, user?.organizationId));
  const [users, setUsers] = useState<StaffUser[]>([]);

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "organization") return;
    void fetch("/api/auth/users")
      .then(async (response) => {
        const data = (await response.json()) as { users?: StaffUser[] };
        setUsers(data.users ?? []);
      })
      .catch(() => undefined);
  }, [user?.role]);

  const groups = useMemo(
    () => groupClients(clients, organizations, users, user),
    [clients, organizations, users, user],
  );

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю клиентов…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.role === "admin"
              ? "Полный список по каждому пользователю и организации: их цены, заказы и наценки."
              : "Только ваши карточки. Чужие организации и клиенты скрыты."}
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyClient(user?.id, user?.organizationId));
            setOpen(true);
          }}
        >
          <Plus />
          Добавить клиента
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Клиентов нет. После регистрации список чужих СТО не подтягивается.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="grid gap-3">
            <div>
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <p className="text-xs text-muted-foreground">{group.hint}</p>
            </div>
            {group.clients.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                Пусто — только пример, без чужих клиентов.
              </p>
            ) : (
              <div className="grid gap-3">
                {group.clients.map((client) => (
                  <ClientSectionsCard
                    key={client.id}
                    client={client}
                    bands={settings.priceBands}
                    fallback={settings.markupPercent}
                    showCost={Boolean(user && (user.role === "admin" || user.seeCost))}
                    onEdit={() => {
                      setDraft(client);
                      setOpen(true);
                    }}
                    onRemove={() => {
                      if (confirm(`Удалить «${client.name}»?`)) void removeClient(client.id);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {clients.some((item) => item.id === draft.id) ? "Клиент" : "Новый клиент"}
            </DialogTitle>
            <DialogDescription>
              Три блока: личность, цены, автомобиль. Не смешиваем в одну кучу.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <Section title="Личность">
              <Field label="Название / организация">
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
              </Field>
              <Field label="ФИО">
                <Input
                  value={draft.fio ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, fio: event.target.value }))}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Телефон">
                  <Input
                    value={draft.phone}
                    onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </Field>
                <Field label="ИНН">
                  <Input
                    value={draft.inn}
                    onChange={(event) => setDraft((prev) => ({ ...prev, inn: event.target.value }))}
                  />
                </Field>
                <Field label="Telegram Chat ID">
                  <Input
                    value={draft.telegramChatId ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, telegramChatId: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Email аккаунта">
                  <Input
                    type="email"
                    value={draft.email ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </Field>
              </div>
            </Section>
            <Section title="Цены и скидки">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Скидка, %">
                  <Input
                    type="number"
                    min={0}
                    max={95}
                    value={draft.discountPercent}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        discountPercent: Math.max(0, Number.parseFloat(event.target.value) || 0),
                      }))
                    }
                  />
                </Field>
                {user?.role === "client" ? null : (
                <Field label="Наценка ключа, %">
                  <Input
                    type="number"
                    min={0}
                    value={draft.markupPercent ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        markupPercent:
                          event.target.value === ""
                            ? undefined
                            : Number.parseFloat(event.target.value) || 0,
                      }))
                    }
                  />
                </Field>
                )}
                {user?.role === "admin" ? (
                  <Field label="Потолок наценки, %">
                    <Input
                      type="number"
                      min={0}
                      value={draft.maxMarkup ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          maxMarkup:
                            event.target.value === ""
                              ? undefined
                              : Number.parseFloat(event.target.value) || 0,
                        }))
                      }
                    />
                  </Field>
                ) : null}
                {user?.role === "client" ? null : (
                <Field label="Ключ доступа">
                  <Input
                    value={draft.accessKey ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, accessKey: event.target.value }))}
                  />
                </Field>
                )}
                {user?.role === "client" ? null : (
                <Field label="Показ цены клиенту">
                  <select
                    className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                    value={draft.priceView ?? "clean"}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        priceView: event.target.value as Client["priceView"],
                      }))
                    }
                  >
                    <option value="clean">Чистая цена</option>
                    <option value="retail">Розница − скидка = цена</option>
                  </select>
                </Field>
                )}
              </div>
              {user?.role === "admin" || user?.role === "organization" ? (
                <>
                  <DiscountHint
                    discount={draft.discountPercent}
                    bands={settings.priceBands}
                    fallback={settings.markupPercent}
                    client={draft}
                  />
                  <div className="grid gap-2">
                    <Label>Наценки по ценовым категориям</Label>
                    {settings.priceBands.map((band) => {
                      const value = draft.bandMarkups?.[band.id];
                      return (
                        <label key={band.id} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {formatBandLabel(band)} · база {band.markupPercent}%
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder={String(band.markupPercent)}
                            value={value ?? ""}
                            onChange={(event) => {
                              const raw = event.target.value;
                              setDraft((prev) => {
                                const next = { ...(prev.bandMarkups ?? {}) };
                                if (raw === "") delete next[band.id];
                                else next[band.id] = Number.parseFloat(raw) || 0;
                                return { ...prev, bandMarkups: next };
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </Section>
            <Section title="Автомобиль">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Марка">
                  <Input
                    value={draft.carMake ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, carMake: event.target.value }))}
                  />
                </Field>
                <Field label="Модель">
                  <Input
                    value={draft.carModel ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, carModel: event.target.value }))}
                  />
                </Field>
                <Field label="Автомобиль">
                  <Input
                    value={draft.car ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, car: event.target.value }))}
                  />
                </Field>
                <Field label="VIN">
                  <Input
                    value={draft.vin ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, vin: event.target.value }))}
                  />
                </Field>
                <Field label="Госномер">
                  <Input
                    value={draft.plate ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, plate: event.target.value }))}
                  />
                </Field>
                <Field label="Год">
                  <Input
                    value={draft.year ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, year: event.target.value }))}
                  />
                </Field>
                <Field label="Цвет">
                  <Input
                    value={draft.color ?? ""}
                    onChange={(event) => setDraft((prev) => ({ ...prev, color: event.target.value }))}
                  />
                </Field>
              </div>
            </Section>
            <Field label="Комментарий">
              <Textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={draft.name.trim().length < 2}
              onClick={() => {
                void upsertClient({
                  ...draft,
                  name: draft.name.trim(),
                  ownerUserId: draft.ownerUserId || user?.id,
                  organizationId: draft.organizationId || user?.organizationId,
                  issuedByUserId: draft.issuedByUserId || user?.id,
                }).then(() => {
                  toast.success("Клиент сохранён");
                  setOpen(false);
                });
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientSectionsCard({
  client,
  bands,
  fallback,
  showCost,
  onEdit,
  onRemove,
}: {
  client: Client;
  bands: PriceBand[];
  fallback: number;
  showCost: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const sample = clientPriceBreakdown(1000, bands, fallback, client);
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{client.name}</CardTitle>
          <CardDescription>{client.fio || client.email || "без ФИО"}</CardDescription>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Открыть
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Личность</p>
          <p className="mt-1 text-sm">{client.fio || client.name}</p>
          <p className="text-xs text-muted-foreground">{client.phone || "телефон не указан"}</p>
          <p className="text-xs text-muted-foreground">ИНН {client.inn || "—"}</p>
          <p className="text-xs text-muted-foreground">Telegram {client.telegramChatId || "—"}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Цены</p>
          <p className="mt-1 text-sm">скидка {client.discountPercent}%</p>
          <p className="text-xs text-muted-foreground">
            наценка {client.markupPercent ?? "коридоры"}%
            {client.maxMarkup != null ? ` · потолок ${client.maxMarkup}%` : ""}
          </p>
          <p className="text-xs text-muted-foreground">ключ {client.accessKey || "нет"}</p>
          <p className="text-xs text-muted-foreground">вид {client.priceView || "clean"}</p>
          {showCost ? <PriceFormula breakdown={sample} compact /> : null}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Авто</p>
          <p className="mt-1 text-sm">{client.car || "не указан"}</p>
          <p className="text-xs text-muted-foreground">VIN {client.vin || "—"}</p>
          <p className="text-xs text-muted-foreground">
            {client.plate || "без номера"} · {client.year || "год —"} · {client.color || "цвет —"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function groupClients(
  clients: Client[],
  organizations: Organization[],
  users: StaffUser[],
  actor?: PublicUser | null,
) {
  if (actor?.role !== "admin") {
    return [
      {
        id: actor?.id || "mine",
        title: "Мои клиенты",
        hint: "Только карточки, которые вы завели или к которым выдан ваш ключ.",
        clients,
      },
    ];
  }
  const used = new Set<string>();
  const groups: { id: string; title: string; hint: string; clients: Client[] }[] = [];
  for (const org of organizations) {
    const rows = clients.filter((item) => item.organizationId === org.id);
    rows.forEach((item) => used.add(item.id));
    groups.push({
      id: org.id,
      title: org.name,
      hint: `Организация · потолок ${org.maxMarkup ?? "нет"}% · ключ ${org.accessKey || "нет"}`,
      clients: rows,
    });
  }
  for (const person of users.filter((item) => item.role !== "organization" && item.role !== "guest")) {
    const rows = clients.filter(
      (item) =>
        !used.has(item.id) &&
        (item.ownerUserId === person.id || item.issuedByUserId === person.id || item.id === person.clientId),
    );
    rows.forEach((item) => used.add(item.id));
    groups.push({
      id: person.id,
      title: `${person.name} · ${person.email}`,
      hint: person.role === "admin" ? "Карточки склада администратора" : `Роль ${person.role}`,
      clients: rows,
    });
  }
  const leftover = clients.filter((item) => !used.has(item.id));
  if (leftover.length) {
    groups.push({
      id: "other",
      title: "Прочие",
      hint: "Без владельца",
      clients: leftover,
    });
  }
  return groups;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 rounded-xl border p-3">
      <p className="text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function DiscountHint({
  discount,
  bands,
  fallback,
  client,
}: {
  discount: number;
  bands: PriceBand[];
  fallback: number;
  client: Client;
}) {
  const sampleBuy = 1000;
  const markup = markupForPrice(sampleBuy, bands, fallback, client);
  const breakdown = clientPriceBreakdown(sampleBuy, bands, fallback, client);
  const breakEven = discountBreakEvenPercent(markup);
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">
        Пример на {sampleBuy} ₽, коридор {markup}%, скидка {discount || 0}%:
      </p>
      <PriceFormula breakdown={breakdown} compact />
      <p className="text-xs text-muted-foreground">Ниже закупа скидка становится после {breakEven}%.</p>
    </div>
  );
}
