import ExcelJS from "exceljs";
import Papa from "papaparse";
import { stringifyCell } from "@/lib/json-path";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 20_000;

function rowsToTable(matrix: string[][]) {
  const filled = matrix.filter((row) => row.some((cell) => cell.trim()));
  if (filled.length === 0) {
    return { headers: [] as string[], rows: [] as Record<string, string>[], total: 0 };
  }
  const headers = filled[0].map((cell, index) => cell.trim() || `Колонка ${index + 1}`);
  const rows = filled.slice(1, MAX_ROWS + 1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
  return { headers, rows, total: rows.length };
}

async function parseExcel(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return rowsToTable([]);
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map((cell) => stringifyCell(cell)));
  });
  return rowsToTable(matrix);
}

function parseCsv(text: string) {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    delimiter: "",
  });
  const matrix = parsed.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
  return rowsToTable(matrix);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Прикрепите файл прайс-листа" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Файл больше 8 МБ" }, { status: 413 });
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const table =
      name.endsWith(".xlsx") || name.endsWith(".xls")
        ? await parseExcel(buffer)
        : parseCsv(buffer.toString("utf8"));

    if (table.headers.length === 0) {
      return Response.json({ error: "В файле нет строк" }, { status: 422 });
    }

    return Response.json(table);
  } catch {
    return Response.json(
      { error: "Не удалось разобрать файл. Нужен CSV или XLSX." },
      { status: 422 },
    );
  }
}
