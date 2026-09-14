"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, KeyRound, KeySquare, Plus, Trash2 } from "lucide-react";
import { PriceBandsEditor } from "@/components/price-bands-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { EXAMPLE_ORG_ID } from "@/lib/constants";
import { DEFAULT_PRICE_BANDS, sanitizeBands } from "@/lib/price-bands";
import { orgKeyStatus } from "@/lib/org-policy";
import type { Client, Organization } from "@/lib/types";

function emptyOrg(createdByUserId: string): Organization {
  return {
    id: crypto.randomUUID(),
    name: "",
    inn: "",
    phone: "",
    notes: "",
    createdAt: new Date().toISOString(),
    createdByUserId,
    discountPercent: 0,
    markupPercent: 14,
    maxMarkup: 30,
    accountStatus: "pending_key",
    managersCanEditSuppliers: false,
    adminControlsClients: false,
  };
}

export function OrganizationsDesk() {
  const { user } = useAuth();
  const {
    ready,
    organizations,
    clients,
    suppliers,
    settings,
    upsertOrganization,
    takeOrganizationKey,
    removeOrganization,
    shareSupplier,
    upsertClient,
  } = useAvtoPrice();
  const [draft, setDraft] = useState<Organization | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю организации…</p>;

  const creatingId = draft && !organizations.some((item) => item.id === draft.id) ? draft.id : null;
  const rows = creatingId && draft ? [draft, ...organizations] : organizations;

  function open(org: Organization) {
    setOpenId(org.id);
    setDraft({ ...org });
  }

  const editing = (org: Organization) => (openId === org.id && draft ? draft : org);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Организации</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Список редактируемый: скидка и цена, которую вы задаёте организации, потолок для её
            клиентов. Ключ можно забрать — тогда клиентами управляете только вы.
          </p>
        </div>
        <Button
          onClick={() => {
            const next = emptyOrg(user?.id || "usr-admin");
            setDraft(next);
            setOpenId(next.id);
          }}
        >
          <Plus />
          Новая организация
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Организаций нет.
          </CardContent>
        </Card>
      ) : (
        rows.map((org) => {
          const orgClients = clients.filter((item) => item.organizationId === org.id);
          const current = editing(org);
          const opened = openId === org.id;
          const status = orgKeyStatus(current);
          return (
            <Card key={org.id} className={opened ? "border-primary/40" : undefined}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-6 py-4 text-left"
                onClick={() => (opened ? setOpenId(null) : open(org))}
              >
                <ChevronDown
                  className={`mt-1 size-4 shrink-0 text-muted-foreground transition ${opened ? "rotate-180" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{current.name.trim() || "Без названия"}</span>
                    <KeyBadge status={status} />
                    {current.adminControlsClients ? (
                      <Badge variant="destructive">клиенты у админа</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {org.id === EXAMPLE_ORG_ID
                      ? "Пример. Клиентов нет — список специально пустой."
                      : `${orgClients.length} клиентов`}
                    {` · скидка ${current.discountPercent}% · наценка ${current.markupPercent ?? "коридоры"}%`}
                    {current.maxMarkup != null ? ` · потолок ${current.maxMarkup}%` : ""}
                    {current.maxDiscountPercent != null
                      ? ` · макс. скидка клиентам ${current.maxDiscountPercent}%`
                      : ""}
                  </p>
                </div>
              </button>
              {opened ? (
                <CardContent className="grid gap-4 border-t pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <Label>Название</Label>
                      <Input
                        value={current.name}
                        onChange={(event) => setDraft({ ...current, name: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <Label>Email</Label>
                      <Input
                        value={current.email ?? ""}
                        onChange={(event) => setDraft({ ...current, email: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <Label>ИНН</Label>
                      <Input
                        value={current.inn}
                        onChange={(event) => setDraft({ ...current, inn: event.target.value })}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <Label>Телефон</Label>
                      <Input
                        value={current.phone}
                        onChange={(event) => setDraft({ ...current, phone: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-sm font-medium">Цена, которую вы задаёте организации</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Скидка и наценка — условия самой организации. Потолки ограничивают, что она
                      может дать своим клиентам. Сохранение пересчитывает карточки клиентов.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="grid gap-1.5">
                        <Label>Скидка организации, %</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.discountPercent}
                          onChange={(event) =>
                            setDraft({
                              ...current,
                              discountPercent: Number.parseFloat(event.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label>Наценка организации, %</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.markupPercent ?? ""}
                          onChange={(event) =>
                            setDraft({
                              ...current,
                              markupPercent:
                                event.target.value === ""
                                  ? undefined
                                  : Number.parseFloat(event.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label>Потолок наценки клиентам, %</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.maxMarkup ?? ""}
                          onChange={(event) =>
                            setDraft({
                              ...current,
                              maxMarkup:
                                event.target.value === ""
                                  ? undefined
                                  : Number.parseFloat(event.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label>Потолок скидки клиентам, %</Label>
                        <Input
                          type="number"
                          min={0}
                          value={current.maxDiscountPercent ?? ""}
                          onChange={(event) =>
                            setDraft({
                              ...current,
                              maxDiscountPercent:
                                event.target.value === ""
                                  ? undefined
                                  : Number.parseFloat(event.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="mt-3 grid gap-1.5">
                      <Label>Вид цены организации</Label>
                      <select
                        className="h-9 max-w-xs rounded-lg border bg-transparent px-3 text-sm"
                        value={current.priceView ?? "clean"}
                        onChange={(event) =>
                          setDraft({
                            ...current,
                            priceView: event.target.value as Organization["priceView"],
                          })
                        }
                      >
                        <option value="clean">Своя цена</option>
                        <option value="retail">Розница − скидка</option>
                      </select>
                    </label>
                    <div className="mt-3">
                      <Label>Коридоры организации</Label>
                      <div className="mt-2">
                        <PriceBandsEditor
                          bands={sanitizeBands(
                            current.priceBands?.length
                              ? current.priceBands
                              : settings.priceBands?.length
                                ? settings.priceBands
                                : DEFAULT_PRICE_BANDS,
                          )}
                          onChange={(next) => setDraft({ ...current, priceBands: next })}
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(current.managersCanEditSuppliers)}
                      onChange={(event) =>
                        setDraft({ ...current, managersCanEditSuppliers: event.target.checked })
                      }
                    />
                    Менеджеры организации могут править своих поставщиков
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(current.adminControlsClients)}
                      onChange={(event) =>
                        setDraft({ ...current, adminControlsClients: event.target.checked })
                      }
                    />
                    Клиентами и их ценами управляет администратор (без ключа организации)
                  </label>

                  <div>
                    <p className="mb-2 text-sm font-medium">Поставщики администратора</p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Отметьте, чтобы открыть уже существующего поставщика этой организации. Свои
                      поставщики организации не затрагиваются.
                    </p>
                    <div className="flex flex-col gap-1">
                      {suppliers
                        .filter((item) => (item.ownerRole ?? "admin") === "admin")
                        .map((supplier) => {
                          const shared = (supplier.sharedWithOrgIds ?? []).includes(org.id);
                          return (
                            <label key={supplier.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={shared}
                                disabled={Boolean(creatingId)}
                                onChange={(event) => {
                                  void shareSupplier(supplier.id, org.id, event.target.checked).then(() =>
                                    toast.success(
                                      event.target.checked
                                        ? `${supplier.name} открыт для «${org.name}»`
                                        : `${supplier.name}: доступ отозван`,
                                    ),
                                  );
                                }}
                              />
                              {supplier.name}
                              <span className="text-xs text-muted-foreground">замок</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>

                  <label className="grid gap-1.5">
                    <Label>Комментарий</Label>
                    <Textarea
                      rows={2}
                      value={current.notes}
                      onChange={(event) => setDraft({ ...current, notes: event.target.value })}
                    />
                  </label>

                  <OrgClientsEditor
                    org={current}
                    clients={orgClients}
                    onSave={(client) =>
                      void upsertClient(client).then(() => toast.success("Цена клиента сохранена"))
                    }
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy === org.id}
                      onClick={() => {
                        setBusy(org.id);
                        void upsertOrganization({
                          ...current,
                          name: current.name.trim() || "Организация",
                        })
                          .then(() => {
                            toast.success("Организация сохранена. Цены клиентов пересчитаны по потолкам.");
                            setOpenId(org.id);
                            setDraft(null);
                          })
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Ошибка"),
                          )
                          .finally(() => setBusy(null));
                      }}
                    >
                      Сохранить
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy === org.id || Boolean(creatingId)}
                      onClick={() => {
                        setBusy(org.id);
                        void fetch("/api/auth/users", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "create-user",
                            email: current.email || `org-${current.id.slice(0, 6)}@sadparts.local`,
                            name: current.name,
                            role: "organization",
                            organizationId: current.id,
                            password: "Org12345",
                          }),
                        })
                          .then(async (response) => {
                            const data = (await response.json()) as {
                              user?: { id: string };
                              error?: string;
                            };
                            if (!response.ok) throw new Error(data.error || "Ошибка");
                            const issued = await fetch("/api/auth/users", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "issue-key",
                                userId: data.user?.id,
                                organizationId: current.id,
                                markupPercent: current.markupPercent,
                                discountPercent: current.discountPercent,
                                maxMarkup: current.maxMarkup,
                              }),
                            });
                            const keyData = (await issued.json()) as {
                              accessKey?: string;
                              error?: string;
                            };
                            if (!issued.ok) throw new Error(keyData.error || "Ключ не выдан");
                            toast.success(`Ключ ${keyData.accessKey} — организация снова управляет клиентами`);
                            setDraft(null);
                          })
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Ошибка"),
                          )
                          .finally(() => setBusy(null));
                      }}
                    >
                      <KeyRound />
                      Выдать ключ организации
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy === org.id || Boolean(creatingId) || status === "none"}
                      onClick={() => {
                        if (
                          !confirm(
                            `Забрать ключ у «${current.name}»? Организация не сможет выдавать ключи и менять цены клиентов — это сделаете вы.`,
                          )
                        ) {
                          return;
                        }
                        setBusy(org.id);
                        void takeOrganizationKey(org.id)
                          .then(() => {
                            toast.success("Ключ забран. Клиентами организации управляете вы.");
                            setDraft(null);
                            setOpenId(org.id);
                          })
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Ошибка"),
                          )
                          .finally(() => setBusy(null));
                      }}
                    >
                      <KeySquare />
                      Забрать ключ
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy === org.id}
                      onClick={() => {
                        if (!confirm(`Удалить «${org.name}»?`)) return;
                        if (creatingId === org.id) {
                          setDraft(null);
                          setOpenId(null);
                          return;
                        }
                        void removeOrganization(org.id);
                      }}
                    >
                      <Trash2 />
                      Удалить
                    </Button>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          );
        })
      )}
    </div>
  );
}

function KeyBadge({ status }: { status: ReturnType<typeof orgKeyStatus> }) {
  if (status === "active") return <Badge variant="secondary">ключ выдан</Badge>;
  if (status === "taken") return <Badge variant="destructive">ключ забран</Badge>;
  return <Badge variant="outline">ключ не выдан</Badge>;
}

function OrgClientsEditor({
  org,
  clients,
  onSave,
}: {
  org: Organization;
  clients: Client[];
  onSave: (client: Client) => void;
}) {
  const [edits, setEdits] = useState<Record<string, { discount: string; markup: string; max: string }>>(
    {},
  );

  if (org.id === EXAMPLE_ORG_ID && clients.length === 0) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium">Клиенты организации</p>
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Пусто. У примера не должно быть чужих СТО и розницы.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Клиенты и их цены</p>
      {clients.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Клиентов пока нет. После отзыва ключа их карточки остаются здесь — скидку и наценку
          правите вы.
        </p>
      ) : (
        <ul className="grid gap-2">
          {clients.map((item) => {
            const row = edits[item.id] ?? {
              discount: String(item.discountPercent),
              markup: item.markupPercent == null ? "" : String(item.markupPercent),
              max: item.maxMarkup == null ? "" : String(item.maxMarkup),
            };
            return (
              <li
                key={item.id}
                className="grid gap-2 rounded-lg border px-3 py-2 sm:grid-cols-[1fr_repeat(3,5.5rem)_auto] sm:items-end"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.email || item.phone || item.id}
                  </p>
                </div>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Скидка %</span>
                  <Input
                    type="number"
                    min={0}
                    value={row.discount}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [item.id]: { ...row, discount: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Наценка %</span>
                  <Input
                    type="number"
                    min={0}
                    value={row.markup}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [item.id]: { ...row, markup: event.target.value },
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Потолок %</span>
                  <Input
                    type="number"
                    min={0}
                    value={row.max}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [item.id]: { ...row, max: event.target.value },
                      }))
                    }
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onSave({
                      ...item,
                      organizationId: org.id,
                      discountPercent: Number.parseFloat(row.discount.replace(",", ".")) || 0,
                      markupPercent:
                        row.markup === ""
                          ? undefined
                          : Number.parseFloat(row.markup.replace(",", ".")) || 0,
                      maxMarkup:
                        row.max === "" ? org.maxMarkup : Number.parseFloat(row.max.replace(",", ".")) || 0,
                    })
                  }
                >
                  Ок
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
