import ExcelJS from "exceljs";
import { nextOrderNumber } from "../src/lib/order";
import { invoiceTitle, rublesInWords } from "../src/lib/money-words";
import { includedVat } from "../src/lib/order-price";
import { buildClientInvoice } from "../src/lib/invoice";
import { EMPTY_SETTINGS } from "../src/lib/server-store";
import type { Client, Order } from "../src/lib/types";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

async function main() {
  const words = rublesInWords(31153.7);
  assert(/тридцать одна тысяча/i.test(words), words);
  assert(/70 копеек/i.test(words), words);
  assert(rublesInWords(0) === "Ноль рублей 00 копеек", rublesInWords(0));
  assert(rublesInWords(1) === "Один рубль 00 копеек", rublesInWords(1));
  assert(includedVat(120, 20) === 20, `vat ${includedVat(120, 20)}`);
  assert(nextOrderNumber([]) === "ЗК-0001", nextOrderNumber([]));
  assert(
    nextOrderNumber([{ number: "ЗК-0007" } as Order, { number: "SP-0003" } as Order]) === "ЗК-0008",
    "serial",
  );
  assert(invoiceTitle("ЗК-0001", "2026-09-13T10:00:00.000Z").includes("ЗК-0001"), "title");

  const client: Client = {
    id: "cli",
    name: "Бруско Илья",
    phone: "+79055752252",
    inn: "",
    discountPercent: 0,
    notes: "",
    createdAt: "2026-09-13T10:00:00.000Z",
    car: "Nissan Almera",
    vin: "SJNBBAN16U2612427",
  };
  const order: Order = {
    id: "ord-1",
    number: "ЗК-0001",
    status: "assembled",
    clientId: "cli",
    markupPercent: 0,
    comment: "",
    createdAt: "2026-09-13T10:00:00.000Z",
    updatedAt: "2026-09-13T10:00:00.000Z",
    lines: [
      {
        id: "l1",
        offerId: "o1",
        supplierId: "s1",
        sku: "8941",
        brand: "MANNOL",
        name: "Жидкость тормозная 3002 MANNOL 0,91л DOT 4 Brake Fluid",
        oem: "",
        qty: 2,
        buyPrice: 310,
        currency: "RUB",
        deliveryDays: 1,
        warehouse: "",
      },
      {
        id: "l2",
        offerId: "o2",
        supplierId: "s1",
        sku: "PH2385",
        brand: "NTY",
        name: "Патрубок радиатора",
        oem: "",
        qty: 1,
        buyPrice: 1050,
        currency: "RUB",
        deliveryDays: 2,
        warehouse: "",
      },
    ],
  };

  const invoice = await buildClientInvoice(order, client, {
    ...EMPTY_SETTINGS,
    markupPercent: 0,
    priceBands: [{ id: "all", min: 0, max: null, markupPercent: 0 }],
    vatPercent: 0,
  });
  assert(invoice.filename.includes("ЗК-0001"), invoice.filename);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(invoice.buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  const title = String(sheet.getCell("B6").value || "");
  assert(title.includes("ЗК-0001"), title);
  assert(String(sheet.getCell("E12").value).includes("Бруско"), String(sheet.getCell("E12").value));
  assert(String(sheet.getCell("B24").value) === "8941", String(sheet.getCell("B24").value));
  assert(String(sheet.getCell("B25").value) === "PH2385", String(sheet.getCell("B25").value));
  const sum = Number(sheet.getCell("S26").value);
  assert(Math.abs(sum - (310 * 2 + 1050)) < 0.05, `sum ${sum}`);

  console.log("invoice-check ok", { title, filename: invoice.filename, sum, words });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
