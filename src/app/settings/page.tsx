"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceBandsEditor } from "@/components/price-bands-editor";
import { PriceFormula } from "@/components/price-formula";
import { ProfileFields } from "@/components/profile-fields";
import { SuppliersSettingsPanel } from "@/components/suppliers-settings";
import { EmailPricesCard } from "@/components/email-prices";
import { ImportWizard } from "@/components/import-wizard";
import { ImportHistoryCard } from "@/components/import-history";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_PRICE_BANDS, formatBandLabel, markupForPrice, sanitizeBands } from "@/lib/price-bands";
import { priceBreakdown } from "@/lib/pricing";
import { canEditSupplier, canSeeSupplierCatalog } from "@/lib/suppliers-scope";
import type { Client, Organization, PriceBand, PriceView, PublicUser } from "@/lib/types";

type StaffUser = PublicUser & { createdAt?: string; lastLoginAt?: string };

export default function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "client" || user.role === "guest") return <ClientSettings />;
  return <DeskSettings />;
}

function ClientSettings() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ФИО, контакты, автомобиль и как показывать цену. Закупочную цену не показываем, пока
          администратор явно не включит её для вашего аккаунта.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Профиль и автомобиль</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileFields />
        </CardContent>
      </Card>
    </div>
  );
}

function DeskSettings() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загружаю настройки…</p>}>
      <DeskSettingsInner />
    </Suspense>
  );
}

function DeskSettingsInner() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const canTrade = admin || user?.role === "organization";
  const {
    ready,
    suppliers,
    settings,
    saveTradeSettings,
    organizations,
    upsertOrganization,
    clients,
    upsertClient,
  } = useAvtoPrice();
  const [markup, setMarkup] = useState<string | null>(null);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const [bands, setBands] = useState<PriceBand[] | null>(null);
  const [guestBands, setGuestBands] = useState<PriceBand[] | null>(null);
  const [managerBands, setManagerBands] = useState<PriceBand[] | null>(null);
  const [sellerTitle, setSellerTitle] = useState<string | null>(null);
  const [sellerAddress, setSellerAddress] = useState<string | null>(null);
  const [vat, setVat] = useState<string | null>(null);
  const [notifyChat, setNotifyChat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<StaffUser[]>([]);

  useEffect(() => {
    void fetch("/api/auth/users")
      .then(async (response) => {
        const data = (await response.json()) as { users?: StaffUser[] };
        setUsers(data.users ?? []);
      })
      .catch(() => undefined);
  }, []);

  const markupValue = markup ?? String(settings.markupPercent);
  const noteValue = hubNote ?? settings.moscowHubNote;
  const bandsValue = bands ?? sanitizeBands(settings.priceBands?.length ? settings.priceBands : DEFAULT_PRICE_BANDS);
  const guestBandsValue =
    guestBands ??
    sanitizeBands(settings.guestPriceBands?.length ? settings.guestPriceBands : DEFAULT_PRICE_BANDS);
  const managerBandsValue =
    managerBands ??
    sanitizeBands(settings.managerPriceBands?.length ? settings.managerPriceBands : DEFAULT_PRICE_BANDS);
  const sampleBuy = 1000;
  const sampleMarkup = markupForPrice(
    sampleBuy,
    bandsValue,
    Number.parseFloat(markupValue.replace(",", ".")) || 0,
  );
  const sampleBreakdown = priceBreakdown(sampleBuy, sampleMarkup, 8);
  const sellerTitleValue = sellerTitle ?? settings.sellerTitle ?? "";
  const sellerAddressValue = sellerAddress ?? settings.sellerAddress ?? "";
  const vatValue = vat ?? String(settings.vatPercent ?? 0);
  const notifyChatValue = notifyChat ?? settings.telegramNotifyChatId ?? "";

  const corridorTargets = useMemo(
    () => corridorClients(clients, users, user),
    [clients, users, user],
  );

  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get("tab") || "general";
  const canSuppliers = canSeeSupplierCatalog(user);
  const editableSuppliers = suppliers.filter((item) => canEditSupplier(item, user, organizations));

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю настройки…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {admin
            ? "Коридоры, справочник, поставщики и прайсы. Добавление ключей API — во вкладке «Поставщики»."
            : "Справочник поставщиков виден целиком. Нового поставщика заводит администратор по запросу."}
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (!value) return;
          const next = new URLSearchParams(search.toString());
          next.set("tab", value);
          router.replace(`/settings?${next.toString()}`, { scroll: false });
        }}
      >
        <TabsList variant="line" className="flex-wrap justify-start">
          <TabsTrigger value="general">Общие</TabsTrigger>
          {canSuppliers ? <TabsTrigger value="suppliers">Поставщики</TabsTrigger> : null}
          {canSuppliers ? <TabsTrigger value="prices">Прайсы</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="suppliers" className="mt-4">
          <SuppliersSettingsPanel />
        </TabsContent>
        <TabsContent value="prices" className="mt-4 grid gap-5">
          {editableSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Сначала добавьте своего поставщика во вкладке «Поставщики».
            </p>
          ) : (
            <ImportWizard />
          )}
          <EmailPricesCard suppliers={editableSuppliers} />
          <ImportHistoryCard />
        </TabsContent>
        <TabsContent value="general" className="mt-4 grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Мой профиль</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileFields showCar={false} />
        </CardContent>
      </Card>

      {user?.role === "organization" ? (
        <OrgSupplierManagersCard />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Коридоры выданных ключей</CardTitle>
          <CardDescription>Группы свёрнуты. Откройте строку, чтобы править наценку и скидку.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {corridorTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет карточек с вашим ключом.</p>
          ) : (
            corridorTargets.map((group) => (
              <details key={group.id} className="rounded-lg border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {group.title} · {group.items.length}
                </summary>
                <div className="mt-3 grid gap-2">
                  {group.items.map((client) => (
                    <PolicyAccordion
                      key={client.id}
                      title={client.name}
                      hint={`${client.email || client.phone || ""} · скидка ${client.discountPercent}%`}
                    >
                      <ClientPolicyForm
                        client={client}
                        bands={bandsValue}
                        allowMax={admin}
                        onSave={(next) =>
                          void upsertClient(next).then(() => toast.success("Политика сохранена"))
                        }
                      />
                    </PolicyAccordion>
                  ))}
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>

      {admin ? <AdminDirectory users={users} /> : null}

      {canTrade ? (
      <>
      <Card>
        <CardHeader>
          <CardTitle>Торговля</CardTitle>
          <CardDescription>
            Цена клиенту = закуп + наценка по категории − скидка клиента. Наценка 0% — это 0%.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Label>Наценка по умолчанию, %</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={markupValue}
              onChange={(event) => setMarkup(event.target.value)}
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Комментарий по доставке до Москвы</Label>
            <Textarea rows={3} value={noteValue} onChange={(event) => setHubNote(event.target.value)} />
          </label>
          <div className="sm:col-span-2">
            <Label className="mb-2 block">Ценовые категории</Label>
            <PriceBandsEditor bands={bandsValue} onChange={setBands} />
            <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Пример на закуп {sampleBuy} ₽ и скидку клиента 8%. Коридор даёт наценку {sampleMarkup}%.
              </p>
              <PriceFormula breakdown={sampleBreakdown} className="mt-1" view="cost" />
            </div>
          </div>
          {admin ? (
            <>
              <div className="sm:col-span-2">
                <Label className="mb-2 block">Категории наценки для гостя</Label>
                <PriceBandsEditor bands={guestBandsValue} onChange={setGuestBands} />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-2 block">Категории наценки для менеджера</Label>
                <PriceBandsEditor bands={managerBandsValue} onChange={setManagerBands} />
              </div>
            </>
          ) : null}
          <div>
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                if (!admin) {
                  const org = organizations.find((item) => item.id === user?.organizationId);
                  if (!org) {
                    setBusy(false);
                    toast.error("Организация не найдена");
                    return;
                  }
                  const cap = org.maxMarkup;
                  void upsertOrganization({
                    ...org,
                    markupPercent: Number.parseFloat(markupValue.replace(",", ".")) || 0,
                    priceBands: bandsValue.map((band) => ({
                      ...band,
                      markupPercent: cap == null ? band.markupPercent : Math.min(band.markupPercent, cap),
                    })),
                  })
                    .then(() => toast.success("Наценки организации сохранены"))
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    )
                    .finally(() => setBusy(false));
                  return;
                }
                void saveTradeSettings({
                  markupPercent: Number.parseFloat(markupValue.replace(",", ".")) || 0,
                  moscowHubNote: noteValue,
                  priceBands: bandsValue,
                  guestPriceBands: guestBandsValue,
                  managerPriceBands: managerBandsValue,
                  sellerTitle: sellerTitleValue,
                  sellerAddress: sellerAddressValue,
                  vatPercent: Number.parseFloat(vatValue.replace(",", ".")) || 0,
                  telegramNotifyChatId: notifyChatValue,
                })
                  .then(() => toast.success("Настройки сохранены"))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Ошибка"),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Накладная ЗК</CardTitle>
          <CardDescription>Шапка Excel и печати. Номера: ЗК-0001… в своей книге.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Продавец (строка 1)</Label>
            <Input value={sellerTitleValue} onChange={(event) => setSellerTitle(event.target.value)} />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Адрес (строка 2)</Label>
            <Textarea rows={2} value={sellerAddressValue} onChange={(event) => setSellerAddress(event.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <Label>НДС, % (0 — не облагается)</Label>
            <Input value={vatValue} onChange={(event) => setVat(event.target.value)} type="number" min={0} />
          </label>
          <label className="grid gap-1.5">
            <Label>Chat ID для накладных в Telegram</Label>
            <Input
              value={notifyChatValue}
              onChange={(event) => setNotifyChat(event.target.value)}
              placeholder="если у клиента нет своего"
            />
          </label>
        </CardContent>
      </Card>
      </>
      ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminDirectory({ users }: { users: StaffUser[] }) {
  const { organizations, clients, upsertOrganization, takeOrganizationKey, upsertClient, settings } =
    useAvtoPrice();
  const [tab, setTab] = useState("orgs");
  const managers = users.filter((item) => item.role === "manager");
  const clientUsers = users.filter((item) => item.role === "client");
  const guests = users.filter((item) => item.role === "guest");
  const bands = sanitizeBands(settings.priceBands?.length ? settings.priceBands : DEFAULT_PRICE_BANDS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Справочник</CardTitle>
        <CardDescription>
          Организации, менеджеры, клиенты и гости. Строка открывает полную ценовую политику, включая
          «видеть закуп».
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="mb-3 flex-wrap justify-start">
            <TabsTrigger value="orgs">Организации</TabsTrigger>
            <TabsTrigger value="managers">Менеджеры в организациях</TabsTrigger>
            <TabsTrigger value="clients">Клиенты</TabsTrigger>
            <TabsTrigger value="guests">Гости</TabsTrigger>
          </TabsList>
          <TabsContent value="orgs">
            {organizations.map((org) => {
              const account = users.find(
                (item) => item.role === "organization" && item.organizationId === org.id,
              );
              return (
                <PolicyAccordion
                  key={org.id}
                  title={org.name}
                  hint={`${org.email || ""} · потолок ${org.maxMarkup ?? "нет"}%${org.adminControlsClients ? " · ключ забран" : ""}`}
                >
                  <OrgPolicyForm
                    org={org}
                    account={account}
                    bands={bands}
                    onSave={(next) =>
                      void upsertOrganization(next).then(() => toast.success("Организация сохранена"))
                    }
                    onTakeKey={() =>
                      void takeOrganizationKey(org.id).then(() =>
                        toast.success("Ключ забран. Клиентами управляете вы."),
                      )
                    }
                  />
                </PolicyAccordion>
              );
            })}
          </TabsContent>
          <TabsContent value="managers">
            {managers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Менеджеров нет.</p>
            ) : (
              managers.map((person) => {
                const org = organizations.find((item) => item.id === person.organizationId);
                const client = clients.find((item) => item.id === person.clientId || item.email === person.email);
                return (
                  <PolicyAccordion
                    key={person.id}
                    title={person.name}
                    hint={`${person.email} · ${org?.name || "без организации"}`}
                  >
                    <UserSeeCost userId={person.id} seeCost={Boolean(person.seeCost)} />
                    {client ? (
                      <ClientPolicyForm
                        client={client}
                        bands={bands}
                        allowMax
                        onSave={(next) => void upsertClient(next).then(() => toast.success("Сохранено"))}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">Карточки клиента нет — только флаг закупа.</p>
                    )}
                  </PolicyAccordion>
                );
              })
            )}
          </TabsContent>
          <TabsContent value="clients">
            {clientUsers.map((person) => {
              const client =
                clients.find((item) => item.id === person.clientId) ||
                clients.find((item) => item.email === person.email);
              return (
                <PolicyAccordion key={person.id} title={person.name} hint={person.email}>
                  <UserSeeCost userId={person.id} seeCost={Boolean(person.seeCost)} />
                  {client ? (
                    <ClientPolicyForm
                      client={client}
                      bands={bands}
                      allowMax
                      onSave={(next) => void upsertClient(next).then(() => toast.success("Сохранено"))}
                    />
                  ) : null}
                </PolicyAccordion>
              );
            })}
          </TabsContent>
          <TabsContent value="guests">
            {guests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Гостей ещё не было.</p>
            ) : (
              guests.map((person) => {
                const client = clients.find((item) => item.id === person.clientId);
                return (
                  <PolicyAccordion key={person.id} title={person.name} hint={person.email}>
                    <UserSeeCost userId={person.id} seeCost={Boolean(person.seeCost)} />
                    {client ? (
                      <ClientPolicyForm
                        client={client}
                        bands={bands}
                        allowMax
                        onSave={(next) => void upsertClient(next).then(() => toast.success("Сохранено"))}
                      />
                    ) : null}
                  </PolicyAccordion>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PolicyAccordion({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mb-2 rounded-lg border px-3 py-2">
      <summary className="cursor-pointer">
        <span className="font-medium">{title}</span>
        {hint ? <span className="ml-2 text-xs text-muted-foreground">{hint}</span> : null}
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}

function UserSeeCost({ userId, seeCost }: { userId: string; seeCost: boolean }) {
  const { refresh } = useAuth();
  const [on, setOn] = useState(seeCost);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => {
          const next = event.target.checked;
          setOn(next);
          void fetch("/api/auth/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set-see-cost", userId, seeCost: next }),
          })
            .then(async (response) => {
              if (!response.ok) throw new Error("Не сохранить флаг");
              toast.success(next ? "Закуп открыт" : "Закуп скрыт");
              await refresh();
            })
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Ошибка"));
        }}
      />
      Видеть сырой закуп
    </label>
  );
}

function ClientPolicyForm({
  client,
  bands,
  allowMax,
  onSave,
}: {
  client: Client;
  bands: PriceBand[];
  allowMax?: boolean;
  onSave: (client: Client) => void;
}) {
  const [draft, setDraft] = useState(client);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Наценка, %"
          value={draft.markupPercent ?? ""}
          onChange={(value) => setDraft({ ...draft, markupPercent: value })}
        />
        <NumberField
          label="Скидка, %"
          value={draft.discountPercent}
          onChange={(value) => setDraft({ ...draft, discountPercent: value ?? 0 })}
        />
        {allowMax ? (
          <NumberField
            label="Потолок, %"
            value={draft.maxMarkup ?? ""}
            onChange={(value) => setDraft({ ...draft, maxMarkup: value })}
          />
        ) : null}
        <label className="grid gap-1.5">
          <Label>Вид цены</Label>
          <select
            className="h-9 rounded-lg border bg-transparent px-3 text-sm"
            value={draft.priceView ?? "clean"}
            onChange={(event) => setDraft({ ...draft, priceView: event.target.value as PriceView })}
          >
            <option value="clean">Своя цена</option>
            <option value="retail">Розница − скидка</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2">
        <Label>Наценки по коридорам</Label>
        {bands.map((band) => (
          <label key={band.id} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {formatBandLabel(band)} · база {band.markupPercent}%
            </span>
            <Input
              type="number"
              min={0}
              step="0.1"
              placeholder={String(band.markupPercent)}
              value={draft.bandMarkups?.[band.id] ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                const next = { ...(draft.bandMarkups ?? {}) };
                if (raw === "") delete next[band.id];
                else next[band.id] = Number.parseFloat(raw) || 0;
                setDraft({ ...draft, bandMarkups: next });
              }}
            />
          </label>
        ))}
      </div>
      <Button size="sm" className="w-fit" onClick={() => onSave(draft)}>
        Сохранить политику
      </Button>
    </div>
  );
}

function OrgPolicyForm({
  org,
  account,
  bands,
  onSave,
  onTakeKey,
}: {
  org: Organization;
  account?: StaffUser;
  bands: PriceBand[];
  onSave: (org: Organization) => void;
  onTakeKey?: () => void;
}) {
  const [draft, setDraft] = useState(org);
  return (
    <div className="grid gap-3">
      {account ? <UserSeeCost userId={account.id} seeCost={Boolean(account.seeCost)} /> : null}
      {org.adminControlsClients ? (
        <p className="text-xs text-destructive">Ключ забран. Клиентами и их ценами управляет администратор.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label="Наценка, %"
          value={draft.markupPercent ?? ""}
          onChange={(value) => setDraft({ ...draft, markupPercent: value })}
        />
        <NumberField
          label="Скидка, %"
          value={draft.discountPercent}
          onChange={(value) => setDraft({ ...draft, discountPercent: value ?? 0 })}
        />
        <NumberField
          label="Потолок наценки, %"
          value={draft.maxMarkup ?? ""}
          onChange={(value) => setDraft({ ...draft, maxMarkup: value })}
        />
        <NumberField
          label="Потолок скидки клиентам, %"
          value={draft.maxDiscountPercent ?? ""}
          onChange={(value) => setDraft({ ...draft, maxDiscountPercent: value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(draft.adminControlsClients)}
          onChange={(event) => setDraft({ ...draft, adminControlsClients: event.target.checked })}
        />
        Клиентами управляет администратор
      </label>
      <div className="grid gap-2">
        <Label>Коридоры организации</Label>
        <PriceBandsEditor
          bands={sanitizeBands(draft.priceBands?.length ? draft.priceBands : bands)}
          onChange={(next) => setDraft({ ...draft, priceBands: next })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="w-fit" onClick={() => onSave(draft)}>
          Сохранить политику
        </Button>
        {onTakeKey && !org.adminControlsClients && org.accessKey ? (
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => {
              if (!confirm(`Забрать ключ у «${org.name}»?`)) return;
              onTakeKey();
            }}
          >
            Забрать ключ
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : Number.parseFloat(event.target.value) || 0)
        }
      />
    </label>
  );
}

function corridorClients(clients: Client[], _users: StaffUser[], actor?: PublicUser | null) {
  if (!actor) return [];
  if (actor.role === "admin") {
    return [
      {
        id: "org-clients",
        title: "Клиенты организаций",
        items: clients.filter((item) => item.organizationId && !item.id.startsWith("cli-guest")),
      },
      {
        id: "own-clients",
        title: "Клиенты склада",
        items: clients.filter(
          (item) => !item.organizationId && item.id !== "cli-guest" && !item.id.startsWith("cli-guest"),
        ),
      },
      {
        id: "guests",
        title: "Гости",
        items: clients.filter((item) => item.id === "cli-guest" || item.id.startsWith("cli-guest")),
      },
    ].filter((group) => group.items.length);
  }
  const mine = clients.filter(
    (item) =>
      item.issuedByUserId === actor.id ||
      item.ownerUserId === actor.id ||
      (actor.organizationId && item.organizationId === actor.organizationId),
  );
  return [
    {
      id: "issued",
      title: "Выданные ключи · клиенты и гости",
      items: mine,
    },
  ].filter((group) => group.items.length);
}

function OrgSupplierManagersCard() {
  const { user } = useAuth();
  const { organizations, upsertOrganization } = useAvtoPrice();
  const org = organizations.find((item) => item.id === user?.organizationId);
  if (!org) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Менеджеры и поставщики</CardTitle>
        <CardDescription>
          По умолчанию менеджеры видят каталог, но не правят ключи. Включите, если им можно добавлять
          своих поставщиков организации.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(org.managersCanEditSuppliers)}
            onChange={(event) => {
              void upsertOrganization({
                ...org,
                managersCanEditSuppliers: event.target.checked,
              })
                .then(() =>
                  toast.success(
                    event.target.checked
                      ? "Менеджеры могут править своих поставщиков"
                      : "Поставщиков правит только организация",
                  ),
                )
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Ошибка"),
                );
            }}
          />
          Менеджеры могут добавлять, править и удалять своих поставщиков организации
        </label>
      </CardContent>
    </Card>
  );
}
