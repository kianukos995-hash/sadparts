import ExcelJS from "exceljs";
import { feedToTable, matrixToTable, parseCsvText, xmlToTable } from "@/lib/parse-feed";
import { stringifyCell } from "@/lib/json-path";
import { decodePriceText, extractBestZipFile } from "@/lib/zip";

export const runtime = "nodejs";

const MAX_BYTES = 80 * 1024 * 1024;

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

function tableFromBuffer(buffer: Buffer, filename: string, itemsPath: string) {
  const name = filename.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcel(buffer);
  }
  const payload = name.endsWith(".zip") ? extractBestZipFile(buffer) : { name: filename, body: buffer };
  const text = decodePriceText(payload.body);
  const inner = payload.name.toLowerCase();
  if (inner.endsWith(".xml") || inner.endsWith(".yml") || name.endsWith(".xml") || name.endsWith(".yml") || text.trimStart().startsWith("<")) {
    return Promise.resolve(xmlToTable(text));
  }
  if (inner.endsWith(".json") || name.endsWith(".json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
    return Promise.resolve(feedToTable("json", text, itemsPath));
  }
  return Promise.resolve(parseCsvText(text));
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
      return Response.json({ error: "Файл больше 80 МБ" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const table = await tableFromBuffer(buffer, file.name, itemsPath);
    if (table.headers.length === 0) {
      return Response.json({ error: "В файле нет строк с заголовками" }, { status: 422 });
    }
    return Response.json(table);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось разобрать файл. Нужен CSV, ZIP, XLSX, JSON или XML/YML.",
      },
      { status: 422 },
    );
  }
}
