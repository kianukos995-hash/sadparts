import { offerToCatalogRow, readCatalog, writeCatalog } from "@/lib/file-catalog";
import { copyPreviousCatalog, recordImportHistory } from "@/lib/import-history";
import { guessColumnMap, rowToOffer } from "@/lib/mapping";
import { parseCsvText, xmlToTable } from "@/lib/parse-feed";
import { guessPriceTitle } from "@/lib/price-bands";
import { isRosskoSoapXml } from "@/lib/rossko-soap";
import { decodePriceText, extractBestZipFile } from "@/lib/zip";
import type { ImportMode, Offer, Supplier } from "@/lib/types";

const IMPORT_ROWS = 400_000;

function payloadBuffer(buffer: Buffer, filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return extractBestZipFile(buffer);
  return { name: filename, body: buffer };
}

function decodeText(buffer: Buffer, filename: string) {
  const { name, body } = payloadBuffer(buffer, filename);
  return { name, text: decodePriceText(body) };
}

function priceTitle(filename: string, innerName: string) {
  return guessPriceTitle(filename) || guessPriceTitle(innerName || filename);
}

function offersFromRecords(supplier: Supplier, rows: Record<string, string>[], headers: string[]) {
  const map = guessColumnMap(headers.length ? headers : Object.keys(rows[0] ?? {}));
  const mappedSupplier = { ...supplier, columnMap: map, source: "file" as const };
  const offers: Offer[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];
  for (const row of rows) {
    try {
      const offer = rowToOffer(row, mappedSupplier, map);
      if (offer) offers.push(offer);
      else {
        skipped += 1;
        if (skipReasons.length < 6) skipReasons.push("нет артикула");
      }
    } catch (error) {
      skipped += 1;
      if (skipReasons.length < 6) {
        skipReasons.push(error instanceof Error ? error.message : "строка не разобралась");
      }
    }
  }
  return {
    offers,
    skipped,
    headers: headers.length ? headers : Object.keys(rows[0] ?? {}),
    map,
    skipReasons,
  };
}

async function commitRows(supplier: Supplier, offers: Offer[], mode: ImportMode) {
  let catalogRows = offers.map(offerToCatalogRow);
  if (mode === "merge") {
    const existing = await readCatalog(supplier.id);
    const byId = new Map(existing.rows.map((row) => [`${row.guid}:${row.sku}`, row]));
    for (const row of catalogRows) byId.set(`${row.guid}:${row.sku}`, row);
    catalogRows = Array.from(byId.values());
  }
  await writeCatalog(supplier.id, catalogRows);
  return catalogRows;
}

export function previewCatalogFile(buffer: Buffer, filename: string) {
  const decoded = decodeText(buffer, filename);
  const text = decoded.text;
  const title = priceTitle(filename, decoded.name);
  if (
    isRosskoSoapXml(text) ||
    decoded.name.toLowerCase().endsWith(".xml") ||
    filename.toLowerCase().endsWith(".xml")
  ) {
    const table = xmlToTable(text);
    return {
      title,
      innerName: decoded.name,
      headers: table.headers,
      rows: table.rows.slice(0, 25),
      total: table.total,
      warnings: table.total === 0 ? ["SOAP/XML не дал строк прайса"] : [],
    };
  }
  const lineCount = (text.match(/\n/g) ?? []).length;
  const sampleLines = text.split(/\r?\n/, 45).join("\n");
  const table = parseCsvText(sampleLines, 40);
  return {
    title,
    innerName: decoded.name,
    headers: table.headers,
    rows: table.rows.slice(0, 25),
    total: Math.max(table.total, lineCount),
    warnings: table.warnings,
  };
}

export async function importCatalogFile(
  supplier: Supplier,
  buffer: Buffer,
  filename: string,
  mode: ImportMode,
  label?: string,
) {
  const decoded = decodeText(buffer, filename);
  const text = decoded.text;
  const title = (label ?? "").trim() || priceTitle(filename, decoded.name);
  let offers: Offer[] = [];
  let skipped = 0;
  let headers: string[] = [];
  const warnings: string[] = [];

  if (
    isRosskoSoapXml(text) ||
    decoded.name.toLowerCase().endsWith(".xml") ||
    filename.toLowerCase().endsWith(".xml")
  ) {
    const table = xmlToTable(text);
    const mapped = offersFromRecords(supplier, table.rows, table.headers);
    offers = mapped.offers;
    skipped = mapped.skipped;
    headers = mapped.headers;
    warnings.push(...mapped.skipReasons);
  } else {
    const parsed = parseCsvText(text, IMPORT_ROWS);
    const mapped = offersFromRecords(supplier, parsed.rows, parsed.headers);
    offers = mapped.offers;
    skipped = mapped.skipped;
    headers = mapped.headers;
    warnings.push(...(parsed.warnings ?? []), ...mapped.skipReasons);
  }

  if (offers.length === 0) {
    throw new Error(
      warnings.filter((item) => !item.startsWith("пропущены служебные")).join(" · ") ||
        "В файле нет артикулов. Проверьте разделитель, кодировку и заголовки.",
    );
  }

  const previous = await copyPreviousCatalog(supplier.id);
  const catalogRows = await commitRows(supplier, offers, mode);
  const history = await recordImportHistory({
    id: previous.id,
    at: new Date().toISOString(),
    supplierId: supplier.id,
    label: title,
    fileName: decoded.name || filename,
    mode,
    imported: catalogRows.length,
    skipped,
    snapshotFile: previous.snapshotFile || undefined,
    warnings: warnings.slice(0, 8),
  });
  return {
    imported: catalogRows.length,
    skipped,
    headers,
    warnings: warnings.slice(0, 8),
    label: title,
    history,
  };
}
