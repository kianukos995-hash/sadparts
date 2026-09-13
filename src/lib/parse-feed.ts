import { XMLParser } from "fast-xml-parser";
import Papa from "papaparse";
import { stringifyCell } from "@/lib/json-path";
import type { ParsedTable } from "@/lib/types";
import {
  flattenRosskoParts,
  isRosskoSoapXml,
  parseCheckoutResult,
  parseOrdersResult,
  parseSearchResult,
  parseSoapXml,
} from "@/lib/rossko-soap";

const MAX_ROWS = 20_000;

export function matrixToTable(matrix: string[][], maxRows = MAX_ROWS): ParsedTable {
  const filled = matrix.filter((row) => row.some((cell) => cell.trim()));
  if (filled.length === 0) {
    return { headers: [], rows: [], total: 0 };
  }
  const headers = uniqueHeaders(filled[0].map((cell, index) => cell.trim() || `Колонка ${index + 1}`));
  const body = filled.slice(1);
  const rows = body.slice(0, maxRows).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
  return { headers, rows, total: body.length };
}

export function recordsToTable(records: Record<string, unknown>[]): ParsedTable {
  const headers: string[] = [];
  for (const record of records.slice(0, MAX_ROWS)) {
    Object.keys(record).forEach((key) => {
      if (!headers.includes(key)) headers.push(key);
    });
  }
  const rows = records.slice(0, MAX_ROWS).map((record) => {
    const row: Record<string, string> = {};
    headers.forEach((header) => {
      row[header] = stringifyCell(record[header]);
    });
    return row;
  });
  return { headers, rows, total: rows.length };
}

  const HEADER_HINT =
  /артикул|номенклатура|sku|partnumber|brand|бренд|цена|price|наличие|stock|oem|описание|наименование|кодтовара|производитель|закуп/i;

export function detectDelimiter(line: string) {
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs >= semicolons && tabs >= commas && tabs > 0) return "\t";
  return semicolons >= commas ? ";" : ",";
}

export function stripCsvJunk(text: string) {
  const stripped = text.replace(/^\uFEFF/, "").replace(/\0/g, "");
  const lines = stripped.split(/\r?\n/);
  let start = 0;
  while (start < Math.min(lines.length - 1, 6)) {
    const line = lines[start]?.replace(/^"|"$/g, "").trim() ?? "";
    if (!line) {
      start += 1;
      continue;
    }
    if (HEADER_HINT.test(line)) break;
    if (HEADER_HINT.test(lines[start + 1] ?? "")) {
      start += 1;
      break;
    }
    break;
  }
  return { text: lines.slice(start).join("\n"), skipped: start };
}

function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((raw, index) => {
    const base = raw.replace(/^\uFEFF/, "").replace(/^"|"$/g, "").trim() || `Колонка ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

function parseDelimited(text: string, delimiter: string) {
  const parseFn = Papa.parse as unknown as (
    input: string,
    config: {
      header: false;
      skipEmptyLines: "greedy";
      delimiter: string;
      relaxColumnCount: true;
      relaxQuotes: true;
      worker: false;
      download: false;
    },
  ) => { data: string[][]; errors: { row?: number; message: string; code?: string }[] };
  return parseFn(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter,
    relaxColumnCount: true,
    relaxQuotes: true,
    worker: false,
    download: false,
  });
}

export function parseCsvText(text: string, maxRows = MAX_ROWS): ParsedTable {
  const prepared = stripCsvJunk(text);
  const first = prepared.text.split(/\r?\n/, 1)[0] ?? "";
  const parsed = parseDelimited(prepared.text, detectDelimiter(first));
  const matrix = parsed.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const table = matrixToTable(matrix, maxRows);
  const warnings = (parsed.errors ?? [])
    .filter((item) => item.code !== "UndetectableDelimiter")
    .slice(0, 8)
    .map((item) => `стр. ${item.row ?? "?"}: ${item.message}`);
  if (prepared.skipped) warnings.unshift(`пропущены служебные строки: ${prepared.skipped}`);
  return { ...table, warnings: warnings.length ? warnings : undefined };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function flattenValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 1) return flattenValue(value[0]);
  const record = asRecord(value);
  if (record && Object.keys(record).length === 1 && "#text" in record) return record["#text"];
  return value;
}

export function collectObjectArrays(
  value: unknown,
  path = "",
  acc: { path: string; items: Record<string, unknown>[] }[] = [],
) {
  if (Array.isArray(value)) {
    const objects = value
      .map((item) => asRecord(flattenValue(item)))
      .filter((item): item is Record<string, unknown> => Boolean(item));
    if (objects.length >= 1) acc.push({ path, items: objects });
    value.forEach((item, index) => collectObjectArrays(item, `${path}[${index}]`, acc));
    return acc;
  }
  const record = asRecord(value);
  if (!record) return acc;
  for (const [key, child] of Object.entries(record)) {
    const nextPath = path ? `${path}.${key}` : key;
    collectObjectArrays(child, nextPath, acc);
  }
  return acc;
}

export function jsonToTable(payload: unknown, itemsPath?: string): ParsedTable {
  if (Array.isArray(payload)) {
    const objects = payload
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
    return recordsToTable(objects);
  }
  if (itemsPath) {
    const extracted = itemsPath.split(".").reduce<unknown>((acc, segment) => {
      if (acc == null || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[segment];
    }, payload);
    if (Array.isArray(extracted)) {
      const objects = extracted
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item));
      return recordsToTable(objects);
    }
  }
  const arrays = collectObjectArrays(payload).sort((a, b) => b.items.length - a.items.length);
  if (arrays[0]) return recordsToTable(arrays[0].items);
  const record = asRecord(payload);
  if (record) return recordsToTable([record]);
  return { headers: [], rows: [], total: 0 };
}

export function xmlToTable(xml: string): ParsedTable {
  if (isRosskoSoapXml(xml)) {
    const parsed = parseSoapXml(xml);
    const search = parseSearchResult(parsed);
    if (search.parts.length) return recordsToTable(flattenRosskoParts(search.parts));
    const checkout = parseCheckoutResult(parsed);
    if (checkout.items.length) {
      return recordsToTable(
        checkout.items.map((item) => ({
          partnumber: item.partnumber,
          brand: item.brand,
          count: String(item.count),
          price: String(item.price ?? ""),
          stock: item.stock ?? "",
        })),
      );
    }
    const orders = parseOrdersResult(parsed);
    const parts = orders.orders.flatMap((order) =>
      order.parts.map((part) => ({
        guid: part.guid,
        partnumber: part.partnumber,
        brand: part.brand,
        name: part.name,
        price: part.price,
        count: String(part.count),
      })),
    );
    if (parts.length) return recordsToTable(parts);
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "#text",
    trimValues: true,
  });
  const parsed: unknown = parser.parse(xml);
  return jsonToTable(parsed);
}

export function detectFeedKind(contentType: string, body: string, url = "") {
  const type = contentType.toLowerCase();
  const trimmed = body.trim();
  const lowerUrl = url.toLowerCase();
  if (type.includes("xml") || trimmed.startsWith("<?xml") || trimmed.startsWith("<yml") || trimmed.startsWith("<") && trimmed.includes("<offer")) {
    return "xml" as const;
  }
  if (type.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json" as const;
  }
  if (lowerUrl.endsWith(".csv") || type.includes("csv") || type.includes("excel") || trimmed.includes(";")) {
    return "csv" as const;
  }
  return "text" as const;
}

export function feedToTable(kind: "json" | "xml" | "csv" | "text", body: string, itemsPath?: string) {
  if (kind === "xml") return xmlToTable(body);
  if (kind === "json") {
    try {
      return jsonToTable(JSON.parse(body) as unknown, itemsPath);
    } catch {
      throw new Error("Текст не является JSON");
    }
  }
  return parseCsvText(body);
}
