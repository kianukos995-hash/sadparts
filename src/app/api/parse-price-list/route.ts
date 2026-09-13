import ExcelJS from "exceljs";
import { feedToTable, matrixToTable, parseCsvText, xmlToTable } from "@/lib/parse-feed";
import { stringifyCell } from "@/lib/json-path";
import { extractFirstZipFile } from "@/lib/zip";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

async function parseExcel(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return matrixToTable([]);
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    matrix.push(values.map((cell) => stringifyCell(cell)));
  });
  return matrixToTable(matrix);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const pasted = form.get("text");
  const itemsPath = String(form.get("itemsPath") ?? "");

  try {
    if (typeof pasted === "string" && pasted.trim()) {
      const text = pasted.trim();
      const table = text.startsWith("<")
        ? xmlToTable(text)
        : text.startsWith("{") || text.startsWith("[")
          ? feedToTable("json", text, itemsPath)
          : parseCsvText(text);
      if (table.headers.length === 0) {
        return Response.json({ error: "Не удалось разобрать вставленный текст" }, { status: 422 });
      }
      return Response.json(table);
    }

    if (!(file instanceof File)) {
      return Response.json({ error: "Прикрепите файл прайс-листа" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "Файл больше 8 МБ" }, { status: 413 });
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const table =
      name.endsWith(".xlsx") || name.endsWith(".xls")
        ? await parseExcel(buffer)
        : name.endsWith(".xml") || name.endsWith(".yml")
          ? xmlToTable(buffer.toString("utf8"))
          : name.endsWith(".json")
            ? feedToTable("json", buffer.toString("utf8"), itemsPath)
            : name.endsWith(".zip")
              ? parseCsvText(extractFirstZipFile(buffer).body.subarray(0, 32_000).toString("utf8"))
              : parseCsvText(buffer.toString("utf8"));

    if (table.headers.length === 0) {
      return Response.json({ error: "В файле нет строк" }, { status: 422 });
    }
    return Response.json(table);
  } catch {
    return Response.json(
      { error: "Не удалось разобрать файл. Нужен CSV, ZIP, XLSX, JSON или XML/YML." },
      { status: 422 },
    );
  }
}
