"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDate, formatMoney, fromDateInput, toDateInput } from "@/lib/format";
import {
  BILL_PAY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  billPayStatus,
  emptyBill,
  emptyMovement,
  paidForBill,
  remainingForBill,
  sortBills,
  sortMovements,
  summarizeMoney,
  unpaidSupplierDebt,
} from "@/lib/money";
import { priceOrder } from "@/lib/order-price";
import type {
  BillPayStatus,
  Client,
  MoneyDirection,
  MoneyMovement,
  Order,
  PaymentMethod,
  PublicSettings,
  Supplier,
  SupplierBill,
} from "@/lib/types";

type MoneyTab = "income" | "expense" | "bills";

function parseTab(value: string | null): MoneyTab {
  if (value === "expense" || value === "bills") return value;
  return "income";
}

export function MoneyDesk() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const {
    ready,
    error,
    refresh,
    clients,
    orders,
    suppliers,
    settings,
    moneyMovements,
    supplierBills,
    upsertMoneyMovement,
    removeMoneyMovement,
    upsertSupplierBill,
    removeSupplierBill,
  } = useAvtoPrice();

  const [movementOpen, setMovementOpen] = useState(false);
  const [movementDraft, setMovementDraft] = useState<MoneyMovement>(() => emptyMovement("income"));
  const [savingMovement, setSavingMovement] = useState(false);

  const [billOpen, setBillOpen] = useState(false);
  const [billDraft, setBillDraft] = useState<SupplierBill | null>(null);
  const [savingBill, setSavingBill] = useState(false);

  const summary = useMemo(() => summarizeMoney(moneyMovements), [moneyMovements]);
  const debt = useMemo(
    () => unpaidSupplierDebt(supplierBills, moneyMovements),
    [supplierBills, moneyMovements],
  );
  const income = useMemo(
    () => sortMovements(moneyMovements.filter((item) => item.direction === "income")),
    [moneyMovements],
  );
  const expense = useMemo(
    () => sortMovements(moneyMovements.filter((item) => item.direction === "expense")),
    [moneyMovements],
  );
  const bills = useMemo(() => sortBills(supplierBills), [supplierBills]);

  function setTab(next: string | null) {
    if (!next) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "income") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `/money?${query}` : "/money");
  }

  function openMovement(direction: MoneyDirection, initial?: Partial<MoneyMovement>) {
    const base = emptyMovement(direction);
    setMovementDraft({ ...base, ...initial, direction, id: initial?.id ?? base.id });
    setMovementOpen(true);
  }

  function openBill(initial?: SupplierBill) {
    setBillDraft(initial ?? emptyBill(suppliers[0]?.id ?? "", supplierBills));
    setBillOpen(true);
  }

  async function saveMovement() {
    const amount = Number(movementDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Укажите сумму больше нуля");
      return;
    }
    if (
      !movementDraft.counterparty.trim() &&
      !movementDraft.clientId &&
      !movementDraft.supplierId
    ) {
      toast.error("Укажите, от кого пришли или кому ушли деньги");
      return;
    }
    setSavingMovement(true);
    try {
      await upsertMoneyMovement({
        ...movementDraft,
        amount,
        counterparty: movementDraft.counterparty.trim(),
        comment: movementDraft.comment.trim(),
        clientId: movementDraft.clientId || undefined,
        orderId: movementDraft.orderId || undefined,
        supplierId: movementDraft.supplierId || undefined,
        supplierBillId: movementDraft.supplierBillId || undefined,
      });
      toast.success(movementDraft.direction === "income" ? "Приход записан" : "Расход записан");
      setMovementOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не сохранить движение");
    } finally {
      setSavingMovement(false);
    }
  }

  async function saveBill() {
    if (!billDraft) return;
    if (!billDraft.supplierId) {
      toast.error("Выберите поставщика");
      return;
    }
    if (!Number.isFinite(Number(billDraft.amount)) || Number(billDraft.amount) <= 0) {
      toast.error("Укажите сумму счёта");
      return;
    }
    setSavingBill(true);
    try {
      await upsertSupplierBill({
        ...billDraft,
        amount: Number(billDraft.amount),
        number: billDraft.number.trim(),
        comment: billDraft.comment.trim(),
      });
      toast.success("Счёт поставщика сохранён");
      setBillOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не сохранить счёт");
    } finally {
      setSavingBill(false);
    }
  }

  function payBill(bill: SupplierBill) {
    const supplier = suppliers.find((item) => item.id === bill.supplierId);
    const paid = paidForBill(bill.id, moneyMovements);
    const remaining = remainingForBill(bill.amount, paid);
    openMovement("expense", {
      amount: remaining || bill.amount,
      supplierId: bill.supplierId,
      supplierBillId: bill.id,
      counterparty: supplier?.name ?? "",
      comment: `Оплата ${bill.number}`,
    });
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Загружаю кассу…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-12 text-center">
        <p className="text-sm font-medium">Не удалось загрузить деньги</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Деньги</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Приход — от клиентов и заказов. Расход — поставщикам и прочие выплаты. Способ: наличные,
            карта или безнал. Счета поставщиков показывают, кто уже оплачен.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTab("income");
              openMovement("income");
            }}
          >
            <Plus />
            Приход
          </Button>
          <Button
            onClick={() => {
              setTab("expense");
              openMovement("expense");
            }}
          >
            <Plus />
            Расход
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Приход" value={formatMoney(summary.income)} hint="все поступления" />
        <Stat title="Расход" value={formatMoney(summary.expense)} hint="выплаты и закуп" />
        <Stat title="Касса" value={formatMoney(summary.balance)} hint="приход минус расход" />
        <Stat title="Долг поставщикам" value={formatMoney(debt)} hint="остаток по счетам" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="w-full max-w-full flex-wrap justify-start">
          <TabsTrigger value="income">Приход</TabsTrigger>
          <TabsTrigger value="expense">Расход</TabsTrigger>
          <TabsTrigger value="bills">Счета поставщиков</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          <MovementTable
            items={income}
            empty="Прихода ещё нет. Запишите оплату от клиента или прочее поступление."
            clients={clients}
            orders={orders}
            suppliers={suppliers}
            bills={supplierBills}
            onEdit={(item) => openMovement("income", item)}
            onDelete={(item) => {
              if (confirm("Удалить это поступление?")) {
                void removeMoneyMovement(item.id).then(() => toast.success("Удалено"));
              }
            }}
          />
        </TabsContent>

        <TabsContent value="expense" className="mt-4">
          <MovementTable
            items={expense}
            empty="Расхода ещё нет. Запишите оплату поставщику или прочий расход."
            clients={clients}
            orders={orders}
            suppliers={suppliers}
            bills={supplierBills}
            onEdit={(item) => openMovement("expense", item)}
            onDelete={(item) => {
              if (confirm("Удалить этот расход?")) {
                void removeMoneyMovement(item.id).then(() => toast.success("Удалено"));
              }
            }}
          />
        </TabsContent>

        <TabsContent value="bills" className="mt-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Подкрепите оплату к счёту поставщика — видно, кто уже заплатил и сколько осталось.
            </p>
            <Button
              variant="outline"
              disabled={suppliers.length === 0}
              onClick={() => openBill()}
            >
              <Plus />
              Новый счёт
            </Button>
          </div>
          {suppliers.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
              Сначала добавьте поставщика в разделе «Поставщики».
            </p>
          ) : bills.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
              Счетов поставщиков нет. Создайте счёт и привяжите к нему расход.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Счёт</th>
                    <th className="px-3 py-2 font-medium">Поставщик</th>
                    <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Сумма</th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Оплачено</th>
                    <th className="px-3 py-2 text-right font-medium">Остаток</th>
                    <th className="px-3 py-2 font-medium">Статус</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const supplier = suppliers.find((item) => item.id === bill.supplierId);
                    const paid = paidForBill(bill.id, moneyMovements);
                    const remaining = remainingForBill(bill.amount, paid);
                    const status = billPayStatus(bill.amount, paid);
                    return (
                      <tr key={bill.id} className="border-t">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="font-medium hover:underline"
                            onClick={() => openBill(bill)}
                          >
                            {bill.number}
                          </button>
                          <p className="text-xs text-muted-foreground">{formatDate(bill.createdAt)}</p>
                        </td>
                        <td className="px-3 py-2">{supplier?.name || "без поставщика"}</td>
                        <td className="hidden px-3 py-2 text-right sm:table-cell">
                          {formatMoney(bill.amount)}
                        </td>
                        <td className="hidden px-3 py-2 text-right md:table-cell">
                          {formatMoney(paid)}
                        </td>
                        <td className="px-3 py-2 text-right">{formatMoney(remaining)}</td>
                        <td className="px-3 py-2">
                          <PayBadge status={status} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {status !== "paid" ? (
                              <Button size="sm" variant="outline" onClick={() => payBill(bill)}>
                                Оплатить
                              </Button>
                            ) : null}
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Удалить счёт ${bill.number}? Оплаты останутся в расходе.`)) {
                                  void removeSupplierBill(bill.id).then(() => toast.success("Счёт удалён"));
                                }
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MovementDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        draft={movementDraft}
        setDraft={setMovementDraft}
        saving={savingMovement}
        onSave={() => void saveMovement()}
        clients={clients}
        orders={orders}
        suppliers={suppliers}
        bills={supplierBills}
        movements={moneyMovements}
        settings={settings}
      />

      <BillDialog
        open={billOpen}
        onOpenChange={setBillOpen}
        draft={billDraft}
        setDraft={setBillDraft}
        saving={savingBill}
        onSave={() => void saveBill()}
        suppliers={suppliers}
      />
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function PayBadge({ status }: { status: BillPayStatus }) {
  const variant = status === "paid" ? "secondary" : status === "partial" ? "outline" : "destructive";
  return <Badge variant={variant}>{BILL_PAY_STATUS_LABELS[status]}</Badge>;
}

function MovementTable({
  items,
  empty,
  clients,
  orders,
  suppliers,
  bills,
  onEdit,
  onDelete,
}: {
  items: MoneyMovement[];
  empty: string;
  clients: { id: string; name: string }[];
  orders: { id: string; number: string }[];
  suppliers: { id: string; name: string }[];
  bills: { id: string; number: string }[];
  onEdit: (item: MoneyMovement) => void;
  onDelete: (item: MoneyMovement) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Дата</th>
            <th className="px-3 py-2 font-medium">Контрагент</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Связь</th>
            <th className="px-3 py-2 font-medium">Способ</th>
            <th className="px-3 py-2 text-right font-medium">Сумма</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const client = clients.find((entry) => entry.id === item.clientId);
            const order = orders.find((entry) => entry.id === item.orderId);
            const supplier = suppliers.find((entry) => entry.id === item.supplierId);
            const bill = bills.find((entry) => entry.id === item.supplierBillId);
            const link =
              [order ? `заказ ${order.number}` : "", bill ? `счёт ${bill.number}` : "", !order && !bill && supplier ? supplier.name : "", !order && !bill && client && !item.counterparty ? client.name : ""]
                .filter(Boolean)
                .join(" · ") || "—";
            return (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.at)}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-left font-medium hover:underline" onClick={() => onEdit(item)}>
                    {item.counterparty || client?.name || supplier?.name || "без имени"}
                  </button>
                  {item.comment ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{item.comment}</p>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{link}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{PAYMENT_METHOD_LABELS[item.method]}</Badge>
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatMoney(item.amount)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon-sm" variant="ghost" onClick={() => onDelete(item)}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MovementDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  saving,
  onSave,
  clients,
  orders,
  suppliers,
  bills,
  movements,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: MoneyMovement;
  setDraft: (next: MoneyMovement) => void;
  saving: boolean;
  onSave: () => void;
  clients: Client[];
  orders: Order[];
  suppliers: Supplier[];
  bills: SupplierBill[];
  movements: MoneyMovement[];
  settings: PublicSettings;
}) {
  const income = draft.direction === "income";
  const customerOrders = orders.filter((order) => order.status !== "draft");
  const visibleBills = bills.filter((bill) => !draft.supplierId || bill.supplierId === draft.supplierId);

  function update<K extends keyof MoneyMovement>(key: K, value: MoneyMovement[K]) {
    setDraft({ ...draft, [key]: value });
  }

  const clientLabel = clients.find((item) => item.id === draft.clientId)?.name ?? "без клиента";
  const orderLabel = customerOrders.find((item) => item.id === draft.orderId)?.number ?? "без заказа";
  const supplierLabel = suppliers.find((item) => item.id === draft.supplierId)?.name ?? "без поставщика";
  const billLabel = bills.find((item) => item.id === draft.supplierBillId)?.number ?? "без счёта";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{income ? "Приход" : "Расход"}</DialogTitle>
          <DialogDescription>
            {income
              ? "Оплата от клиента, заказа или прочее поступление."
              : "Выплата поставщику, оплата счёта или прочий расход."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Дата">
              <Input
                type="date"
                value={toDateInput(draft.at)}
                onChange={(event) => update("at", fromDateInput(event.target.value))}
              />
            </Field>
            <Field label="Сумма, ₽">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.amount || ""}
                onChange={(event) => update("amount", Number(event.target.value))}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Способ">
            <Select
              value={draft.method}
              onValueChange={(value) => {
                if (value) update("method", value as PaymentMethod);
              }}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">{PAYMENT_METHOD_LABELS[draft.method]}</span>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Контрагент">
            <Input
              value={draft.counterparty}
              onChange={(event) => update("counterparty", event.target.value)}
              placeholder={income ? "Клиент, касса, прочее" : "Поставщик, аренда, прочее"}
            />
          </Field>

          {income ? (
            <>
              <Field label="Клиент">
                <Select
                  value={draft.clientId || "none"}
                  onValueChange={(value) => {
                    if (!value) return;
                    if (value === "none") {
                      setDraft({ ...draft, clientId: undefined });
                      return;
                    }
                    const client = clients.find((item) => item.id === value);
                    setDraft({
                      ...draft,
                      clientId: value,
                      counterparty: draft.counterparty.trim() || client?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className="flex flex-1 truncate text-left">
                      {draft.clientId ? clientLabel : "не выбран"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">не выбран</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Заказ клиента">
                <Select
                  value={draft.orderId || "none"}
                  onValueChange={(value) => {
                    if (!value) return;
                    if (value === "none") {
                      setDraft({ ...draft, orderId: undefined });
                      return;
                    }
                    const order = customerOrders.find((item) => item.id === value);
                    const client = clients.find((item) => item.id === order?.clientId);
                    const priced = order
                      ? priceOrder(
                          order,
                          client,
                          settings.priceBands,
                          order.markupPercent || settings.markupPercent,
                        )
                      : null;
                    const alreadyPaid = movements
                      .filter(
                        (item) =>
                          item.direction === "income" &&
                          item.orderId === value &&
                          item.id !== draft.id,
                      )
                      .reduce((sum, item) => sum + item.amount, 0);
                    const remaining = priced
                      ? Math.max(0, priced.totals.sell - alreadyPaid)
                      : draft.amount;
                    setDraft({
                      ...draft,
                      orderId: value,
                      clientId: order?.clientId || draft.clientId,
                      counterparty: draft.counterparty.trim() || client?.name || draft.counterparty,
                      amount: draft.amount > 0 ? draft.amount : remaining,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className="flex flex-1 truncate text-left">
                      {draft.orderId ? orderLabel : "не привязан"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">не привязан</SelectItem>
                    {customerOrders.map((order) => {
                      const client = clients.find((item) => item.id === order.clientId);
                      return (
                        <SelectItem key={order.id} value={order.id}>
                          {order.number}
                          {client ? ` · ${client.name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Поставщик">
                <Select
                  value={draft.supplierId || "none"}
                  onValueChange={(value) => {
                    if (!value) return;
                    if (value === "none") {
                      setDraft({ ...draft, supplierId: undefined, supplierBillId: undefined });
                      return;
                    }
                    const supplier = suppliers.find((item) => item.id === value);
                    setDraft({
                      ...draft,
                      supplierId: value,
                      supplierBillId:
                        draft.supplierBillId &&
                        bills.find((bill) => bill.id === draft.supplierBillId)?.supplierId === value
                          ? draft.supplierBillId
                          : undefined,
                      counterparty: draft.counterparty.trim() || supplier?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className="flex flex-1 truncate text-left">
                      {draft.supplierId ? supplierLabel : "не выбран"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">не выбран</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Счёт поставщика">
                <Select
                  value={draft.supplierBillId || "none"}
                  onValueChange={(value) => {
                    if (!value) return;
                    if (value === "none") {
                      setDraft({ ...draft, supplierBillId: undefined });
                      return;
                    }
                    const bill = bills.find((item) => item.id === value);
                    const supplier = suppliers.find((item) => item.id === bill?.supplierId);
                    const paid = bill
                      ? paidForBill(
                          bill.id,
                          movements.filter((item) => item.id !== draft.id),
                        )
                      : 0;
                    const remaining = bill ? remainingForBill(bill.amount, paid) : 0;
                    setDraft({
                      ...draft,
                      supplierBillId: value,
                      supplierId: bill?.supplierId || draft.supplierId,
                      counterparty: draft.counterparty.trim() || supplier?.name || draft.counterparty,
                      amount: draft.amount > 0 ? draft.amount : remaining,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <span className="flex flex-1 truncate text-left">
                      {draft.supplierBillId ? billLabel : "не привязан"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">не привязан</SelectItem>
                    {visibleBills.map((bill) => {
                      const supplier = suppliers.find((item) => item.id === bill.supplierId);
                      const remaining = remainingForBill(bill.amount, paidForBill(bill.id, movements));
                      return (
                        <SelectItem key={bill.id} value={bill.id}>
                          {bill.number}
                          {supplier ? ` · ${supplier.name}` : ""} · остаток {formatMoney(remaining)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              {visibleBills.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Нет счетов. Создайте счёт на вкладке «Счета поставщиков», затем привяжите оплату.
                </p>
              ) : null}
            </>
          )}

          <Field label="Комментарий">
            <Textarea
              value={draft.comment}
              onChange={(event) => update("comment", event.target.value)}
              rows={3}
              placeholder="Назначение платежа"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  saving,
  onSave,
  suppliers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: SupplierBill | null;
  setDraft: (next: SupplierBill | null) => void;
  saving: boolean;
  onSave: () => void;
  suppliers: { id: string; name: string }[];
}) {
  if (!draft) return null;
  const supplierLabel = suppliers.find((item) => item.id === draft.supplierId)?.name ?? "выберите";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Счёт поставщика</DialogTitle>
          <DialogDescription>
            Заказ или накладная поставщика, к которой потом подкрепляют расход.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Номер">
            <Input
              value={draft.number}
              onChange={(event) => setDraft({ ...draft, number: event.target.value })}
              placeholder="ПС-0001"
            />
          </Field>
          <Field label="Поставщик">
            <Select
              value={draft.supplierId || "none"}
              onValueChange={(value) => {
                if (value && value !== "none") setDraft({ ...draft, supplierId: value });
              }}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 truncate text-left">{supplierLabel}</span>
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Сумма, ₽">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.amount || ""}
              onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })}
            />
          </Field>
          <Field label="Комментарий">
            <Textarea
              value={draft.comment}
              onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
              rows={3}
              placeholder="Накладная, заказ у поставщика"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Сохраняю…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
