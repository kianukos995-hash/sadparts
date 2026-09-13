import Papa from "papaparse";
import { offerToCatalogRow, readCatalog, writeCatalog, type CatalogRow } from "@/lib/file-catalog";
import { guessColumnMap, rowToOffer } from "@/lib/mapping";
import { parseCsvText, xmlToTable } from "@/lib/parse-feed";
import { isRosskoSoapXml } from "@/lib/rossko-soap";
import { extractFirstZipFile } from "@/lib/zip";
import type { ImportMode, Offer, Supplier } from "@/lib/types";

function payloadText(buffer: Buffer, filename: string) {
  const lower = filename.toLowerCase();
  const payload = lower.endsWith(".zip") ? extractFirstZipFile(buffer).body : buffer;
  let text = payload.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
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

function offersFromRecords(supplier: Supplier, rows: Record<string, string>[], map = guessColumnMap(Object.keys(rows[0] ?? {}))) {
  const mappedSupplier = { ...supplier, columnMap: map, source: "file" as const };
  const offers: Offer[] = [];
  let skipped = 0;
  for (const row of rows) {
    const offer = rowToOffer(row, mappedSupplier, map);
    if (offer) offers.push(offer);
    else skipped += 1;
  }
  return { offers, skipped, headers: Object.keys(rows[0] ?? {}), map };
}

export async function importCatalogFile(supplier: Supplier, buffer: Buffer, filename: string, mode: ImportMode) {
  const text = payloadText(buffer, filename);
  const lower = filename.toLowerCase();

  if (isRosskoSoapXml(text) || lower.endsWith(".xml")) {
    const table = xmlToTable(text);
    const { offers, skipped, headers } = offersFromRecords(supplier, table.rows, guessColumnMap(table.headers));
    const catalogRows = await commitRows(supplier, offers, mode);
    return { imported: catalogRows.length, skipped, headers };
  }

  const preview = parseCsvText(text.slice(0, 50_000));
  const map = guessColumnMap(preview.headers.length ? preview.headers : parseCsvText(text).headers);
  const mappedSupplier = { ...supplier, columnMap: map, source: "file" as const };
  const delimiter = (text.split(/\r?\n/, 1)[0] ?? "").includes(";") ? ";" : ",";
  const catalogRows: CatalogRow[] = [];
  let skipped = 0;
  const byId =
    mode === "merge"
      ? new Map((await readCatalog(supplier.id)).rows.map((row) => [`${row.guid}:${row.sku}`, row]))
      : null;

  Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter,
    step(result) {
      const row = result.data;
      if (!row || typeof row !== "object") {
        skipped += 1;
        return;
      }
      const offer = rowToOffer(row, mappedSupplier, map);
      if (!offer) {
        skipped += 1;
        return;
      }
      const catalogRow = offerToCatalogRow(offer);
      if (byId) byId.set(`${catalogRow.guid}:${catalogRow.sku}`, catalogRow);
      else catalogRows.push(catalogRow);
    },
  });

  const finalRows = byId ? Array.from(byId.values()) : catalogRows;
  await writeCatalog(supplier.id, finalRows);
  return {
    imported: finalRows.length,
    skipped,
    headers: preview.headers,
  };
}

export function compactCount(rows: CatalogRow[]) {
  return rows.length;
}
