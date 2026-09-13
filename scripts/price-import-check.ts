import { mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { previewCatalogFile, importCatalogFile } from "../src/lib/import-catalog";
import { rollbackImport, listImportHistory } from "../src/lib/import-history";
import { decodePriceText, extractBestZipFile } from "../src/lib/zip";
import { parseCsvText } from "../src/lib/parse-feed";
import { DEFAULT_COLUMN_MAP, type Supplier } from "../src/lib/types";
import { findBand, markupForPrice, DEFAULT_PRICE_BANDS } from "../src/lib/price-bands";
import { clientSellPrice } from "../src/lib/pricing";

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

function zipStore(name: string, body: Buffer, compress = false) {
  const payload = compress ? deflateRawSync(body) : body;
  const method = compress ? 8 : 0;
  const nameBuf = Buffer.from(name);
  const crc = crc32(body);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(payload.length, 20);
  cd.writeUInt32LE(body.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  const localOffset = 0;
  cd.writeUInt32LE(localOffset, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(46 + nameBuf.length, 12);
  eocd.writeUInt32LE(30 + nameBuf.length + payload.length, 16);
  return Buffer.concat([local, nameBuf, payload, cd, nameBuf, eocd]);
}

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

  const preview = previewCatalogFile(csv, "rossko_price_september.csv");
  assert(preview.title.toLowerCase().includes("rossko"), `имя прайса: ${preview.title}`);
  assert(preview.rows.length > 0, "превью пустое");

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

  try {
    await unlink(path.join(process.cwd(), "data", "catalogs", `${supplier.id}.jsonl`));
  } catch {
    // ok
  }

  console.log("price-import-check ok", {
    previewRows: preview.rows.length,
    imported: first.imported,
    zipTitle: zipPreview.title,
    sell,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
