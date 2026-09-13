import { mkdir, readFile, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { previewCatalogFile, importCatalogFile } from "../src/lib/import-catalog";
import { rollbackImport, listImportHistory } from "../src/lib/import-history";
import { decodePriceText, extractBestZipFile } from "../src/lib/zip";
import { parseCsvText } from "../src/lib/parse-feed";
import { DEFAULT_COLUMN_MAP, type Supplier } from "../src/lib/types";
import { findBand, markupForPrice, DEFAULT_PRICE_BANDS } from "../src/lib/price-bands";
import { clientSellPrice } from "../src/lib/pricing";
import { stringifyCell } from "../src/lib/json-path";
import { collectRowImages, isDisplayableImage } from "../src/lib/media";
import { parseExcelPrice } from "../src/lib/excel-price";
import { readCatalog } from "../src/lib/file-catalog";

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function encode1251(text: string) {
  const out = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 128) out[i] = code;
    else if (code >= 0x410 && code <= 0x44f) out[i] = code - 0x410 + 0xc0;
    else if (code === 0x401) out[i] = 0xa8;
    else if (code === 0x451) out[i] = 0xb8;
    else out[i] = 0x3f;
  }
  return out;
}

function zipFiles(files: { name: string; body: Buffer; compress?: boolean }[]) {
  const locals: Buffer[] = [];
  const cds: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const payload = file.compress ? deflateRawSync(file.body) : file.body;
    const method = file.compress ? 8 : 0;
    const nameBuf = Buffer.from(file.name);
    const crc = crc32(file.body);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(file.body.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(Buffer.concat([local, nameBuf, payload]));
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(file.body.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    cds.push(Buffer.concat([cd, nameBuf]));
    offset += 30 + nameBuf.length + payload.length;
  }
  const cdBuf = Buffer.concat(cds);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdBuf, eocd]);
}

function zipStore(name: string, body: Buffer, compress = false) {
  return zipFiles([{ name, body, compress }]);
}

const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const supplier: Supplier = {
  id: "sup-test-import",
  name: "Тест",
  code: "TEST",
  source: "file",
  adapter: "generic",
  apiUrl: "",
  apiKey: "",
  apiKey2: "",
  authMode: "header",
  authHeaderName: "",
  authQueryParam: "",
  itemsPath: "",
  columnMap: DEFAULT_COLUMN_MAP,
  notes: "",
  active: true,
  createdAt: new Date().toISOString(),
  deliveryDaysMoscow: 1,
  deliveryNote: "",
};

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

async function main() {
  const csv = await readFile(path.join(process.cwd(), "public/samples/price-crooked.csv"));
  const table = parseCsvText(csv.toString("utf8"));
  assert(table.headers.includes("Артикул"), "заголовок Артикул");
  assert(table.rows.length >= 4, `ожидали позиции, получили ${table.rows.length}`);
  assert(
    table.rows.every((row) => row["Артикул"] !== "Прайс \"кривой\" от 13.09.2026"),
    "служебная строка не должна стать данными",
  );

  const comic = stringifyCell({
    richText: [{ font: { name: "Comic Sans MS", size: 16 }, text: "Колодки" }],
  });
  assert(comic === "Колодки", `richText: ${comic}`);
  const mixedFont = stringifyCell({
    richText: [
      { font: { name: "Calibri" }, text: "Фильтр " },
      { font: { name: "MS Gothic" }, text: "オイル" },
    ],
  });
  assert(mixedFont.includes("Фильтр") && mixedFont.includes("オイル"), mixedFont);
  const fromPhotoCell = collectRowImages({
    Фото: {
      richText: [{ font: { name: "Calibri" }, text: "каталог https://www.rossko.ru/catalog/G052195M4" }],
    },
  });
  assert(fromPhotoCell.images.includes("https://www.rossko.ru/catalog/G052195M4"), String(fromPhotoCell.images));
  assert(!isDisplayableImage("https://www.rossko.ru/catalog/G052195M4"), "страница каталога — ссылка, не img");
  assert(
    isDisplayableImage("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Oil_filter.jpg/320px-Oil_filter.jpg"),
    "wikimedia jpg",
  );

  const preview = previewCatalogFile(csv, "rossko_price_september.csv");
  assert(preview.title.toLowerCase().includes("rossko"), `имя прайса: ${preview.title}`);
  assert(preview.rows.length > 0, "превью пустое");
  assert(preview.headers.some((header) => /фото/i.test(header)), `headers ${preview.headers.join(",")}`);

  const encoded = encode1251("Артикул;Бренд;Описание;Цена, руб.\nABC;VAG;Сайлентблок;550\n");
  const decoded = decodePriceText(encoded);
  assert(decoded.includes("Артикул"), `cp1251: ${decoded.slice(0, 40)}`);

  const zipped = zipStore("price.csv", csv, true);
  const junkZip = Buffer.concat([Buffer.from("JUNKJUNK"), zipped]);
  const extracted = extractBestZipFile(junkZip);
  assert(extracted.name === "price.csv", extracted.name);
  const zipPreview = previewCatalogFile(junkZip, "кривой_прайс_росско.zip");
  assert(zipPreview.rows.length > 0, "zip превью пустое");
  assert(zipPreview.title.includes("кривой"), zipPreview.title);

  await mkdir(path.join(process.cwd(), "data", "catalogs"), { recursive: true });
  const first = await importCatalogFile(supplier, csv, "rossko_price_september.csv", "replace", "Сентябрь Росско");
  assert(first.imported >= 4, `imported ${first.imported}`);
  assert(first.label === "Сентябрь Росско", first.label);
  const afterCsv = await readCatalog(supplier.id);
  const bySku = new Map(afterCsv.rows.map((row) => [row.sku.replace(/\s+/g, "").toUpperCase(), row]));
  const mann = bySku.get("HU7185X");
  assert(mann?.images?.some((url) => url.includes("Oil_filter.jpg")), `mann photos ${mann?.images}`);
  const vag = bySku.get("G052195M4");
  assert(vag?.images?.some((url) => url.includes("rossko.ru")), `vag ${vag?.images}`);
  assert(
    Boolean(vag?.images?.length) && vag!.images!.every((url) => !isDisplayableImage(url)),
    "страница Росско должна остаться ссылкой, не <img>",
  );
  const skf = bySku.get("VKBA3643");
  assert(skf?.images?.includes("/samples/photos/brake-pad.svg"), `skf ${skf?.images}`);
  const boschPads = bySku.get("0986424792");
  assert(!boschPads?.images?.includes("0986424792.png"), "голый файл без ZIP не становится src");

  const second = await importCatalogFile(
    supplier,
    Buffer.from("Артикул;Бренд;Описание;Цена, руб.\nZZZ;TEST;Вторая загрузка;100\n"),
    "second.csv",
    "replace",
    "Второй прайс",
  );
  assert(second.imported === 1, `second ${second.imported}`);
  const history = await listImportHistory(supplier.id);
  const rollbackTarget = history.find((item) => item.label === "Второй прайс" && item.snapshotFile);
  if (!rollbackTarget?.snapshotFile) throw new Error("нет снимка для отката");
  const rolled = await rollbackImport(rollbackTarget.id);
  assert(rolled.rollback.label.startsWith("Откат"), rolled.rollback.label);

  const band = findBand(400, DEFAULT_PRICE_BANDS);
  assert(band.min === 300, band.id);
  const sell = clientSellPrice(400, DEFAULT_PRICE_BANDS, 18, {
    id: "x",
    name: "СТО",
    phone: "",
    inn: "",
    discountPercent: 8,
    bandMarkups: { [band.id]: 10 },
    notes: "",
    createdAt: "",
  });
  assert(Math.abs(sell - 400 * 1.1 * 0.92) < 0.02, `sell ${sell}`);
  assert(markupForPrice(200, DEFAULT_PRICE_BANDS, 18) === 32, "коридор 0-300");

  const photoSupplier: Supplier = { ...supplier, id: "sup-test-media" };
  const packed = zipFiles([
    { name: "price.csv", body: csv, compress: true },
    { name: "photos/0986424792.png", body: PIXEL_PNG },
  ]);
  const withPhotos = await importCatalogFile(photoSupplier, packed, "прайс_с_фото.zip", "replace", "ZIP фото");
  assert(withPhotos.imported >= 4, `zip photos ${withPhotos.imported}`);
  const mediaCatalog = await readCatalog(photoSupplier.id);
  const pads = mediaCatalog.rows.find((row) => row.sku.replace(/\s+/g, "") === "0986424792");
  assert(
    pads?.images?.some((url) => url.includes("/api/media/sup-test-media/") && url.toLowerCase().includes("0986424792")),
    `zip media ${pads?.images}`,
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Прайс");
  sheet.addRow(["Артикул", "Бренд", "Описание", "Цена, руб.", "Фото"]);
  sheet.getCell("A2").value = "FONT-SKU";
  sheet.getCell("B2").value = "BOSCH";
  sheet.getCell("C2").value = {
    richText: [
      { font: { name: "Comic Sans MS", size: 14 }, text: "Колодки " },
      { font: { name: "MS Gothic" }, text: "ブレーキ" },
    ],
  };
  sheet.getCell("D2").value = 3120;
  sheet.getCell("E2").value = {
    text: "страница",
    hyperlink: "https://www.rossko.ru/catalog/FONT-SKU",
  };
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
  const excel = await parseExcelPrice(xlsx);
  assert(excel.fontsNoted, "fontsNoted");
  const excelName = excel.table.rows[0]?.["Описание"] ?? "";
  assert(excelName.includes("Колодки") && excelName.includes("ブレーキ"), excelName);
  const excelImport = await importCatalogFile(
    { ...supplier, id: "sup-test-xlsx" },
    xlsx,
    "fonts.xlsx",
    "replace",
    "Excel шрифты",
  );
  assert(excelImport.imported === 1, `xlsx ${excelImport.imported}`);
  const xlsxCatalog = await readCatalog("sup-test-xlsx");
  assert(xlsxCatalog.rows[0]?.name.includes("Колодки"), xlsxCatalog.rows[0]?.name);
  assert(
    xlsxCatalog.rows[0]?.images?.some((url) => url.includes("rossko.ru/catalog/FONT-SKU")),
    String(xlsxCatalog.rows[0]?.images),
  );

  for (const id of [supplier.id, photoSupplier.id, "sup-test-xlsx"]) {
    try {
      await unlink(path.join(process.cwd(), "data", "catalogs", `${id}.jsonl`));
    } catch {
      // ok
    }
    await rm(path.join(process.cwd(), "data", "media", id), { recursive: true, force: true });
  }

  console.log("price-import-check ok", {
    previewRows: preview.rows.length,
    imported: first.imported,
    zipTitle: zipPreview.title,
    zipPhotos: pads?.images,
    excelName,
    sell,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
