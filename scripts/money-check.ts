import {
  billPayStatus,
  isApiSupplier,
  isFileSupplier,
  nextBillNumber,
  paidForBill,
  remainingForBill,
  roundCash,
  summarizeMoney,
  syncOrderPaidAmounts,
} from "../src/lib/money";
import type { MoneyMovement, Order, Supplier } from "../src/lib/types";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

function main() {
  assert(nextBillNumber([]) === "ПС-0001", nextBillNumber([]));
  assert(
    nextBillNumber([{ number: "ПС-0004" }, { number: "PS-0002" }]) === "ПС-0005",
    "bill serial",
  );
  assert(billPayStatus(1000, 0) === "unpaid", "unpaid");
  assert(billPayStatus(1000, 400) === "partial", "partial");
  assert(billPayStatus(1000, 1000) === "paid", "paid");
  assert(remainingForBill(1000, 250) === 750, "remaining");

  const movements: MoneyMovement[] = [
    {
      id: "m1",
      at: "2026-09-13T10:00:00.000Z",
      amount: 500,
      method: "cash",
      direction: "income",
      counterparty: "СТО Север",
      comment: "",
      orderId: "ord-1",
      createdAt: "2026-09-13T10:00:00.000Z",
    },
    {
      id: "m2",
      at: "2026-09-13T11:00:00.000Z",
      amount: 200,
      method: "card",
      direction: "expense",
      counterparty: "Росско",
      comment: "",
      supplierBillId: "bill-1",
      createdAt: "2026-09-13T11:00:00.000Z",
    },
    {
      id: "m3",
      at: "2026-09-13T12:00:00.000Z",
      amount: 50,
      method: "cashless",
      direction: "expense",
      counterparty: "Росско",
      comment: "",
      supplierBillId: "bill-1",
      createdAt: "2026-09-13T12:00:00.000Z",
    },
  ];

  assert(paidForBill("bill-1", movements) === 250, "paid for bill");
  const summary = summarizeMoney(movements);
  assert(summary.income === 500, `income ${summary.income}`);
  assert(summary.expense === 250, `expense ${summary.expense}`);
  assert(summary.balance === 250, `balance ${summary.balance}`);
  assert(roundCash(250.1) === 250.1, "round");

  const orders = syncOrderPaidAmounts(
    [{ id: "ord-1", paidAmount: 0 } as Order, { id: "ord-2", paidAmount: 15 } as Order],
    movements,
  );
  assert(orders[0]?.paidAmount === 500, "order paid");
  assert(orders[1]?.paidAmount === 0, "untouched order");

  const rossko = { source: "api", adapter: "rossko", catalogCount: 190000 } as Supplier;
  const fileOnly = { source: "file", adapter: "generic", catalogCount: 12 } as Supplier;
  assert(isApiSupplier(rossko) && isFileSupplier(rossko), "rossko both");
  assert(!isApiSupplier(fileOnly) && isFileSupplier(fileOnly), "file only");

  console.log("money-check ok");
}

main();
