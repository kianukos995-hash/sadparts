import type {
  BillPayStatus,
  MoneyDirection,
  MoneyMovement,
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
  if (paid.size === 0) return orders;
  return orders.map((order) =>
    paid.has(order.id) ? { ...order, paidAmount: paid.get(order.id) } : order,
  );
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
