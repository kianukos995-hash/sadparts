import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type { AppSettings, Client, Order } from "@/lib/types";
import { invoiceFileName, invoiceTitle, rublesInWords } from "@/lib/money-words";
import { includedVat, lineCaption, priceOrder } from "@/lib/order-price";

const TEMPLATE = path.join(process.cwd(), "templates", "zakaz-klienta.xlsx");

const FONT = { name: "Arial", size: 8, bold: true, color: { argb: "FF000000" } };
const TITLE_FONT = { name: "Arial", size: 16, bold: true, color: { argb: "FF000000" } };
const THIN: ExcelJS.BorderStyle = "thin";
const MEDIUM: ExcelJS.BorderStyle = "medium";
const BLACK = { argb: "FF000000" };

function border(left: ExcelJS.BorderStyle | undefined, right: ExcelJS.BorderStyle | undefined) {
  return {
    top: { style: THIN, color: BLACK },
    bottom: { style: THIN, color: BLACK },
    left: left ? { style: left, color: BLACK } : undefined,
    right: right ? { style: right, color: BLACK } : undefined,
  };
}

function setCell(
  sheet: ExcelJS.Worksheet,
  addr: string,
  value: ExcelJS.CellValue,
  extra?: {
    numFmt?: string;
    align?: Partial<ExcelJS.Alignment>;
    font?: Partial<ExcelJS.Font>;
    border?: Partial<ExcelJS.Borders>;
    fill?: ExcelJS.Fill;
  },
) {
  const cell = sheet.getCell(addr);
  cell.value = value;
  cell.font = extra?.font ?? FONT;
  cell.alignment = (extra?.align ?? { wrapText: true, vertical: "top" }) as ExcelJS.Alignment;
  if (extra?.numFmt) cell.numFmt = extra.numFmt;
  if (extra?.border) cell.border = extra.border;
  if (extra?.fill) cell.fill = extra.fill;
}

function mergeSafe(sheet: ExcelJS.Worksheet, range: string) {
  try {
    sheet.unMergeCells(range);
  } catch {
    // not merged
  }
  sheet.mergeCells(range);
}

function unmergeFrom(sheet: ExcelJS.Worksheet, minRow: number) {
  const merges = [...(sheet.model.merges ?? [])];
  for (const range of merges) {
    const start = Number.parseInt(String(range).split(":")[0].replace(/\D/g, ""), 10);
    if (start >= minRow) {
      try {
        sheet.unMergeCells(range);
      } catch {
        // already gone
      }
    }
  }
}

function writeItemRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  sku: string,
  name: string,
  qty: number,
  price: number,
  sum: number,
) {
  mergeSafe(sheet, `B${row}:C${row}`);
  mergeSafe(sheet, `D${row}:L${row}`);
  mergeSafe(sheet, `M${row}:N${row}`);
  mergeSafe(sheet, `O${row}:P${row}`);
  mergeSafe(sheet, `Q${row}:R${row}`);
  mergeSafe(sheet, `S${row}:T${row}`);
  const height = Math.max(16, Math.min(42, 14 + Math.floor(name.length / 48) * 12));
  sheet.getRow(row).height = height;
  setCell(sheet, `B${row}`, sku, {
    align: { horizontal: "center", vertical: "top", wrapText: true },
    border: border(MEDIUM, THIN),
  });
  setCell(sheet, `D${row}`, name, {
    align: { horizontal: "left", vertical: "top", wrapText: true },
    border: border(THIN, THIN),
  });
  setCell(sheet, `M${row}`, qty, {
    numFmt: "#0.###",
    align: { horizontal: "right", vertical: "top", wrapText: true },
    border: border(THIN, THIN),
  });
  setCell(sheet, `O${row}`, "шт", {
    align: { horizontal: "center", vertical: "top", wrapText: true },
    border: border(undefined, THIN),
  });
  setCell(sheet, `Q${row}`, price, {
    numFmt: "#,##0.00",
    align: { horizontal: "right", vertical: "top", wrapText: true },
    border: border(THIN, THIN),
  });
  setCell(sheet, `S${row}`, sum, {
    numFmt: "#,##0.00",
    align: { horizontal: "right", vertical: "top", wrapText: true },
    border: border(THIN, MEDIUM),
  });
}

export async function buildClientInvoice(
  order: Order,
  client: Client | null | undefined,
  settings: AppSettings,
  markupOverride?: number | null,
) {
  const priced = priceOrder(
    order,
    client,
    settings.priceBands,
    order.markupPercent || settings.markupPercent,
    markupOverride,
  );
  const vatPercent = settings.vatPercent ?? 0;
  const vat = includedVat(priced.totals.sell, vatPercent);
  const paid = Math.max(0, order.paidAmount ?? 0);
  const rest = Math.max(0, priced.totals.sell - paid);

  const template = await readFile(TEMPLATE);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(template as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("В шаблоне нет листа");

  const seller = settings.sellerTitle?.trim() || "SadParts";
  const address = settings.sellerAddress?.trim() || "";
  setCell(sheet, "B2", seller, { font: FONT, align: { wrapText: true, vertical: "top" } });
  setCell(sheet, "B3", address, { font: FONT, align: { wrapText: true, vertical: "top" } });
  setCell(sheet, "B6", invoiceTitle(order.number, order.createdAt), {
    font: TITLE_FONT,
    align: { wrapText: true, vertical: "top", horizontal: "left" },
  });
  setCell(sheet, "E12", client?.name || "—");
  setCell(sheet, "E14", client?.phone || order.comment || "");
  setCell(sheet, "E16", order.car || client?.car || "");
  setCell(sheet, "L16", order.vin || client?.vin || "");
  setCell(sheet, "E18", order.year || client?.year || "");
  setCell(sheet, "L18", order.plate || client?.plate || "");
  setCell(sheet, "E20", order.color || client?.color || "");

  unmergeFrom(sheet, 24);
  const last = sheet.rowCount;
  if (last >= 24) sheet.spliceRows(24, last - 23);

  const lines = priced.lines.length ? priced.lines : [];
  const itemCount = Math.max(1, lines.length);
  for (let index = 0; index < itemCount; index += 1) {
    const line = lines[index];
    const row = 24 + index;
    if (line) {
      writeItemRow(sheet, row, line.sku, lineCaption(line), line.qty, line.sell, line.sum);
    } else {
      writeItemRow(sheet, row, "", "", 0, 0, 0);
    }
  }

  const footer = 24 + itemCount;
  mergeSafe(sheet, `D${footer}:L${footer}`);
  mergeSafe(sheet, `M${footer}:N${footer}`);
  mergeSafe(sheet, `S${footer}:T${footer}`);
  sheet.getRow(footer).height = 14;
  setCell(sheet, `D${footer}`, "Итого:", {
    align: { horizontal: "right", vertical: "middle", wrapText: true },
  });
  setCell(sheet, `M${footer}`, priced.totals.qty, {
    numFmt: "#0.###",
    align: { horizontal: "right", vertical: "middle" },
  });
  setCell(sheet, `S${footer}`, priced.totals.sell, {
    numFmt: "#,##0.00",
    align: { horizontal: "right", vertical: "middle" },
  });

  const t1 = footer + 2;
  mergeSafe(sheet, `J${t1}:O${t1}`);
  mergeSafe(sheet, `P${t1}:S${t1}`);
  setCell(sheet, `J${t1}`, "Итого:", { align: { horizontal: "right", vertical: "middle" } });
  setCell(sheet, `P${t1}`, priced.totals.sell, {
    numFmt: "#,##0.00",
    align: { horizontal: "right", vertical: "middle" },
  });

  const t2 = footer + 3;
  mergeSafe(sheet, `J${t2}:O${t2}`);
  mergeSafe(sheet, `P${t2}:S${t2}`);
  setCell(sheet, `J${t2}`, vatPercent > 0 ? "В том числе НДС:" : "НДС не облагается", {
    align: { horizontal: "right", vertical: "middle" },
  });
  setCell(sheet, `P${t2}`, vat, {
    numFmt: "#,##0.00",
    align: { horizontal: "right", vertical: "middle" },
  });

  const t3 = footer + 5;
  mergeSafe(sheet, `B${t3}:E${t3}`);
  mergeSafe(sheet, `F${t3}:I${t3}`);
  setCell(sheet, `B${t3}`, "Сумма оплаты:");
  setCell(sheet, `F${t3}`, paid, { numFmt: "#,##0.00" });

  const t4 = footer + 7;
  mergeSafe(sheet, `B${t4}:E${t4}`);
  mergeSafe(sheet, `F${t4}:I${t4}`);
  setCell(sheet, `B${t4}`, "Остаток к оплате:");
  setCell(sheet, `F${t4}`, rest, { numFmt: "#,##0.00" });

  const t5 = footer + 9;
  mergeSafe(sheet, `B${t5}:S${t5}`);
  const sumText = priced.totals.sell.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  setCell(
    sheet,
    `B${t5}`,
    `Всего наименований ${priced.lines.length}, на сумму ${sumText}`,
  );

  const t6 = footer + 10;
  mergeSafe(sheet, `B${t6}:S${t6}`);
  sheet.getRow(t6).height = 18;
  setCell(sheet, `B${t6}`, rublesInWords(priced.totals.sell), {
    font: { ...FONT, size: 9 },
  });

  const t7 = footer + 13;
  mergeSafe(sheet, `B${t7}:C${t7}`);
  mergeSafe(sheet, `I${t7}:J${t7}`);
  setCell(sheet, `B${t7}`, "Отпустил:");
  setCell(sheet, `I${t7}`, "Получил:");

  const t8 = footer + 15;
  mergeSafe(sheet, `N${t8}:S${t8}`);
  setCell(sheet, `N${t8}`, "Страница 1 / 1", {
    align: { horizontal: "right", vertical: "middle" },
  });

  sheet.pageSetup = {
    ...sheet.pageSetup,
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0, footer: 0 },
  };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    filename: invoiceFileName(order.number, order.createdAt),
    caption: `${invoiceTitle(order.number, order.createdAt)}\n${client?.name || "клиент"} · ${sumText} ₽`,
    priced,
  };
}
