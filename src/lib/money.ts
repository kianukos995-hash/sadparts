import type {
  BillPayStatus,
  MoneyDirection,
  MoneyMovement,
  MoneyPurpose,
  Order,
  PaymentMethod,
  Supplier,
  SupplierBill,
} from "@/lib/types";

export const PAYMENT_METHODS = ["cash", "card", "cashless"] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  cashless: "Безнал",
};

export const MONEY_DIRECTION_LABELS: Record<MoneyDirection, string> = {
  income: "Приход",
  expense: "Расход",
};

export const BILL_PAY_STATUS_LABELS: Record<BillPayStatus, string> = {
  unpaid: "не оплачен",
  partial: "частично",
  paid: "оплачен",
};

export const MONEY_PURPOSES: MoneyPurpose[] = [
  "sale",
  "purchase",
  "salary",
  "inventory",
  "company",
  "other",
];

export const MONEY_PURPOSE_LABELS: Record<MoneyPurpose, string> = {
  sale: "Оплата клиента / заказа",
  purchase: "Оплата поставщику",
  salary: "Зарплата сотруднику",
  inventory: "Инвентаризация кассы",
  company: "Свободно, без контрагента",
  other: "Прочее",
};

export function purposesFor(direction: MoneyDirection): MoneyPurpose[] {
  if (direction === "income") {
    return ["sale", "inventory", "company", "other"];
  }
  return ["purchase", "salary", "inventory", "company", "other"];
}

export function purposeNeedsParty(purpose?: MoneyPurpose) {
  return purpose === "sale" || purpose === "purchase" || purpose === "salary";
}

export function inferMoneyPurpose(item: Pick<MoneyMovement, "purpose" | "clientId" | "orderId" | "supplierId" | "supplierBillId" | "employeeUserId" | "counterparty">): MoneyPurpose {
  if (item.purpose && MONEY_PURPOSES.includes(item.purpose)) return item.purpose;
  if (item.employeeUserId) return "salary";
  if (item.supplierId || item.supplierBillId) return "purchase";
  if (item.clientId || item.orderId) return "sale";
  if (!item.counterparty?.trim()) return "company";
  return "other";
}

export function purposeComment(purpose: MoneyPurpose, direction: MoneyDirection) {
  if (purpose === "salary") return "Выдача зарплаты";
  if (purpose === "inventory") {
    return direction === "income" ? "Инвентаризация: оприходование" : "Инвентаризация: списание";
  }
  if (purpose === "company") {
    return direction === "income" ? "Свободный приход компании" : "Свободный расход компании";
  }
  return "";
}

export type CounterpartyOption = {
  id: string;
  label: string;
  kind: "none" | "client" | "supplier" | "employee" | "organization" | "custom";
};

export function counterpartyOptionId(kind: CounterpartyOption["kind"], value = "") {
  if (kind === "none") return "none";
  return `${kind}:${value}`;
}

export function parseCounterpartyOption(id: string): {
  kind: CounterpartyOption["kind"];
  value: string;
} {
  if (!id || id === "none") return { kind: "none", value: "" };
  const split = id.indexOf(":");
  if (split <= 0) return { kind: "custom", value: id };
  const kind = id.slice(0, split) as CounterpartyOption["kind"];
  const value = id.slice(split + 1);
  if (
    kind === "client" ||
    kind === "supplier" ||
    kind === "employee" ||
    kind === "organization" ||
    kind === "custom"
  ) {
    return { kind, value };
  }
  return { kind: "custom", value: id };
}

export function buildCounterpartyOptions(input: {
  clients: { id: string; name: string; phone?: string; inn?: string }[];
  suppliers: { id: string; name: string }[];
  employees?: { id: string; name: string; email?: string }[];
  organizations?: { id: string; name: string }[];
  movements?: { counterparty?: string }[];
}): CounterpartyOption[] {
  const options: CounterpartyOption[] = [{ id: "none", label: "без контрагента", kind: "none" }];
  const seen = new Set<string>(["без контрагента"]);
  function push(option: CounterpartyOption) {
    const key = option.label.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    options.push(option);
  }
  for (const client of input.clients) {
    const extra = [client.phone, client.inn].filter((item) => item?.trim()).join(" · ");
    push({
      id: counterpartyOptionId("client", client.id),
      label: extra ? `${client.name} · ${extra}` : client.name,
      kind: "client",
    });
  }
  for (const supplier of input.suppliers) {
    push({
      id: counterpartyOptionId("supplier", supplier.id),
      label: supplier.name,
      kind: "supplier",
    });
  }
  for (const person of input.employees ?? []) {
    push({
      id: counterpartyOptionId("employee", person.id),
      label: person.email ? `${person.name} · ${person.email}` : person.name,
      kind: "employee",
    });
  }
  for (const org of input.organizations ?? []) {
    push({
      id: counterpartyOptionId("organization", org.id),
      label: org.name,
      kind: "organization",
    });
  }
  for (const movement of input.movements ?? []) {
    const name = movement.counterparty?.trim();
    if (!name) continue;
    push({
      id: counterpartyOptionId("custom", name),
      label: name,
      kind: "custom",
    });
  }
  return options;
}

export function selectedCounterpartyId(item: MoneyMovement): string {
  if (item.employeeUserId) return counterpartyOptionId("employee", item.employeeUserId);
  if (item.clientId) return counterpartyOptionId("client", item.clientId);
  if (item.supplierId) return counterpartyOptionId("supplier", item.supplierId);
  if (item.counterparty.trim()) return counterpartyOptionId("custom", item.counterparty.trim());
  return "none";
}

export const BILL_PREFIX = "ПС";

export function roundCash(amount: number) {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function paidForBill(billId: string, movements: MoneyMovement[]) {
  return roundCash(
    movements
      .filter((item) => item.direction === "expense" && item.supplierBillId === billId)
      .reduce((sum, item) => sum + item.amount, 0),
  );
}

export function remainingForBill(amount: number, paid: number) {
  return roundCash(Math.max(0, amount - paid));
}

export function billPayStatus(amount: number, paid: number): BillPayStatus {
  if (paid <= 0.009) return "unpaid";
  if (paid + 0.009 >= amount) return "paid";
  return "partial";
}

export function nextBillNumber(bills: Pick<SupplierBill, "number">[]) {
  const max = bills.reduce((acc, bill) => {
    const match = /^(?:ПС|PS)-(\d+)$/i.exec(bill.number.trim());
    return match ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
  }, 0);
  return `${BILL_PREFIX}-${String(max + 1).padStart(4, "0")}`;
}

export function summarizeMoney(movements: MoneyMovement[]) {
  let income = 0;
  let expense = 0;
  for (const item of movements) {
    if (item.direction === "income") income += item.amount;
    else expense += item.amount;
  }
  return {
    income: roundCash(income),
    expense: roundCash(expense),
    balance: roundCash(income - expense),
  };
}

export function unpaidSupplierDebt(bills: SupplierBill[], movements: MoneyMovement[]) {
  return roundCash(
    bills.reduce((sum, bill) => {
      const paid = paidForBill(bill.id, movements);
      return sum + remainingForBill(bill.amount, paid);
    }, 0),
  );
}

export function syncOrderPaidAmounts(orders: Order[], movements: MoneyMovement[]): Order[] {
  const paid = new Map<string, number>();
  for (const item of movements) {
    if (item.direction !== "income" || !item.orderId) continue;
    paid.set(item.orderId, roundCash((paid.get(item.orderId) ?? 0) + item.amount));
  }
  return orders.map((order) => ({
    ...order,
    paidAmount: paid.get(order.id) ?? 0,
  }));
}

export function isApiSupplier(supplier: Pick<Supplier, "source" | "adapter">) {
  return supplier.source === "api" || supplier.adapter === "rossko" || supplier.adapter === "demo";
}

export function isFileSupplier(supplier: Pick<Supplier, "source" | "catalogCount">) {
  return supplier.source !== "api" || (supplier.catalogCount ?? 0) > 0;
}

export function emptyMovement(direction: MoneyDirection): MoneyMovement {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    at: now,
    amount: 0,
    method: "cash",
    direction,
    purpose: direction === "income" ? "sale" : "purchase",
    counterparty: "",
    comment: "",
    createdAt: now,
  };
}

export function emptyBill(supplierId: string, bills: Pick<SupplierBill, "number">[]): SupplierBill {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    number: nextBillNumber(bills),
    supplierId,
    amount: 0,
    comment: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function sortMovements(movements: MoneyMovement[]) {
  return [...movements].sort((a, b) => {
    const byDate = Date.parse(b.at) - Date.parse(a.at);
    if (byDate !== 0) return byDate;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function sortBills(bills: SupplierBill[]) {
  return [...bills].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
