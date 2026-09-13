import { XMLParser } from "fast-xml-parser";
import Papa from "papaparse";
import { stringifyCell } from "@/lib/json-path";
import type { ParsedTable } from "@/lib/types";

const MAX_ROWS = 20_000;

export function matrixToTable(matrix: string[][]): ParsedTable {
  const filled = matrix.filter((row) => row.some((cell) => cell.trim()));
  if (filled.length === 0) {
    return { headers: [], rows: [], total: 0 };
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

export function parseCsvText(text: string): ParsedTable {
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    delimiter: "",
  });
  const matrix = parsed.data.map((row) => row.map((cell) => String(cell ?? "").trim()));
  return matrixToTable(matrix);
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
