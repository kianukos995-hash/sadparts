import { isXlsxName, parseExcelPrice } from "@/lib/excel-price";
import { applyImportDiff, offerToCatalogRow, readCatalog, writeCatalog } from "@/lib/file-catalog";
import { copyPreviousCatalog, recordImportHistory } from "@/lib/import-history";
import { guessColumnMap, rowToOffer } from "@/lib/mapping";
import { uniqueUrls } from "@/lib/media";
import { attachOfferMedia, saveZipMedia, type MediaIndex } from "@/lib/media-store";
import { parseCsvText, xmlToTable } from "@/lib/parse-feed";
import { guessPriceTitle } from "@/lib/price-bands";
import { isRosskoSoapXml } from "@/lib/rossko-soap";
import {
  decodePriceText,
  extractBestZipFile,
  extractZipEntries,
  isZipBuffer,
  zipLooksLikeXlsx,
  type ZipEntry,
} from "@/lib/zip";
import type { ImportMode, Offer, Supplier } from "@/lib/types";

const IMPORT_ROWS = 800_000;

function priceTitle(filename: string, innerName: string) {
  return guessPriceTitle(filename) || guessPriceTitle(innerName || filename);
}

function offersFromRecords(
  supplier: Supplier,
  rows: Record<string, string>[],
  headers: string[],
  media?: MediaIndex,
  extraImages?: Map<number, string[]>,
) {
  const map = guessColumnMap(headers.length ? headers : Object.keys(rows[0] ?? {}));
  const mappedSupplier = { ...supplier, columnMap: map, source: "file" as const };
  const offers: Offer[] = [];
  let skipped = 0;
  const skipReasons: string[] = [];
  rows.forEach((row, index) => {
    try {
      const offer = rowToOffer(row, mappedSupplier, map);
      if (!offer) {
        skipped += 1;
        if (skipReasons.length < 6) skipReasons.push("нет артикула");
        return;
      }
      offer.images = attachOfferMedia(
        uniqueUrls([...(offer.images ?? []), ...(extraImages?.get(index) ?? [])]),
        offer.sku,
        media,
      );
      offers.push(offer);
    } catch (error) {
      skipped += 1;
      if (skipReasons.length < 6) {
        skipReasons.push(error instanceof Error ? error.message : "строка не разобралась");
      }
    }
  });
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
  const existing = await readCatalog(supplier.id);
  if (mode === "merge") {
    const byId = new Map(existing.rows.map((row) => [`${row.guid}:${row.sku}`, row]));
    for (const row of catalogRows) byId.set(`${row.guid}:${row.sku}`, row);
    catalogRows = Array.from(byId.values());
  }
  const diffed = applyImportDiff(existing.rows, catalogRows);
  await writeCatalog(supplier.id, diffed.rows);
  return { catalogRows: diffed.rows, changed: diffed.changed };
}

function tableFromText(name: string, text: string, filename: string) {
  if (
    isRosskoSoapXml(text) ||
    name.toLowerCase().endsWith(".xml") ||
    filename.toLowerCase().endsWith(".xml")
  ) {
    return xmlToTable(text);
  }
  return parseCsvText(text, IMPORT_ROWS);
}

function zipPreviewNotes(entries: ZipEntry[]) {
  const images = entries.filter((entry) => /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(entry.name)).length;
  const fonts = entries.filter((entry) => /\.(ttf|otf|woff2?|eot)$/i.test(entry.name)).length;
  const notes: string[] = [];
  if (images) notes.push(`в архиве ${images} фото — подгрузятся к артикулам`);
  if (fonts) notes.push(`${fonts} шрифт(ов) в файле: текст читается, шрифт Excel/TTF на экран не ставится`);
  return notes;
}

export function previewCatalogFile(buffer: Buffer, filename: string) {
  const title = priceTitle(filename, filename);
  if (filename.toLowerCase().endsWith(".zip") || isZipBuffer(buffer)) {
    if (zipLooksLikeXlsx(extractZipEntries(buffer)) || isXlsxName(filename)) {
      return {
        title,
        innerName: filename,
        headers: [] as string[],
        rows: [] as Record<string, string>[],
        total: 0,
        warnings: ["Excel-книга: откройте превью через загрузку — читаем любой шрифт ячеек и фото"],
      };
    }
    const entries = extractZipEntries(buffer);
    const best = extractBestZipFile(buffer);
    const text = decodePriceText(best.body);
    const table = tableFromText(best.name, text, filename);
    const notes = zipPreviewNotes(entries);
    return {
      title,
      innerName: best.name,
      headers: table.headers,
      rows: table.rows.slice(0, 25),
      total: table.total,
      warnings: [...(table.warnings ?? []), ...notes],
    };
  }

  const text = decodePriceText(buffer);
  if (isRosskoSoapXml(text) || filename.toLowerCase().endsWith(".xml")) {
    const table = xmlToTable(text);
    return {
      title,
      innerName: filename,
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
    innerName: filename,
    headers: table.headers,
    rows: table.rows.slice(0, 25),
    total: Math.max(table.total, lineCount),
    warnings: table.warnings,
  };
}

export async function previewCatalogFileAsync(buffer: Buffer, filename: string) {
  if (isXlsxName(filename) || (isZipBuffer(buffer) && zipLooksLikeXlsx(extractZipEntries(buffer)))) {
    const excel = await parseExcelPrice(buffer);
    const photos = [...excel.imagesByDataRow.values()].reduce((sum, list) => sum + list.length, 0);
    return {
      title: priceTitle(filename, filename),
      innerName: filename,
      headers: excel.table.headers,
      rows: excel.table.rows.slice(0, 25),
      total: excel.table.total,
      warnings: [
        excel.fontsNoted ? "Текст ячеек читается при любом шрифте Excel" : "",
        photos ? `на листе ${photos} фото/ссылок` : "",
      ].filter(Boolean),
    };
  }
  return previewCatalogFile(buffer, filename);
}

export async function importCatalogFile(
  supplier: Supplier,
  buffer: Buffer,
  filename: string,
  mode: ImportMode,
  label?: string,
) {
  const title = (label ?? "").trim() || priceTitle(filename, filename);
  let offers: Offer[] = [];
  let skipped = 0;
  let headers: string[] = [];
  const warnings: string[] = [];
  let innerName = filename;

  const zipEntries = isZipBuffer(buffer) ? extractZipEntries(buffer) : [];
  const asXlsx = isXlsxName(filename) || zipLooksLikeXlsx(zipEntries);

  if (asXlsx) {
    const excel = await parseExcelPrice(buffer, supplier.id);
    innerName = filename;
    const mapped = offersFromRecords(
      supplier,
      excel.table.rows,
      excel.table.headers,
      undefined,
      excel.imagesByDataRow,
    );
    offers = mapped.offers;
    skipped = mapped.skipped;
    headers = mapped.headers;
    warnings.push("Excel: шрифты ячеек не мешают чтению", ...mapped.skipReasons);
  } else if (filename.toLowerCase().endsWith(".zip") || (zipEntries.length > 0 && !asXlsx)) {
    const best = extractBestZipFile(buffer);
    innerName = best.name;
    const text = decodePriceText(best.body);
    const table = tableFromText(best.name, text, filename);
    const media = await saveZipMedia(supplier.id, zipEntries);
    const mapped = offersFromRecords(supplier, table.rows, table.headers, media);
    offers = mapped.offers;
    skipped = mapped.skipped;
    headers = mapped.headers;
    warnings.push(...(table.warnings ?? []), ...mapped.skipReasons);
    if (media.saved) warnings.push(`подгружено фото из архива: ${media.saved}`);
    if (media.fonts) warnings.push(`шрифты в ZIP (${media.fonts}) пропущены — текст прайса всё равно читается`);
  } else {
    const text = decodePriceText(buffer);
    const table = tableFromText(filename, text, filename);
    innerName = filename;
    const mapped = offersFromRecords(supplier, table.rows, table.headers);
    offers = mapped.offers;
    skipped = mapped.skipped;
    headers = mapped.headers;
    warnings.push(...(table.warnings ?? []), ...mapped.skipReasons);
  }

  if (offers.length === 0) {
    throw new Error(
      warnings.filter((item) => !item.startsWith("пропущены служебные")).join(" · ") ||
        "В файле нет артикулов. Проверьте разделитель, кодировку и заголовки.",
    );
  }

  const previous = await copyPreviousCatalog(supplier.id);
  const committed = await commitRows(supplier, offers, mode);
  if (committed.changed) {
    warnings.unshift(`обновлены цены/остатки: ${committed.changed} поз.`);
  }
  const history = await recordImportHistory({
    id: previous.id,
    at: new Date().toISOString(),
    supplierId: supplier.id,
    label: title,
    fileName: innerName || filename,
    mode,
    imported: committed.catalogRows.length,
    skipped,
    snapshotFile: previous.snapshotFile || undefined,
    warnings: warnings.slice(0, 8),
  });
  return {
    imported: committed.catalogRows.length,
    skipped,
    headers,
    warnings: warnings.slice(0, 8),
    label: title,
    changed: committed.changed,
    history,
  };
}
