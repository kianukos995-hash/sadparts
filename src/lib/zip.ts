import { inflateRawSync, inflateSync } from "node:zlib";

export interface ZipEntry {
  name: string;
  body: Buffer;
}

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const EOCD = 0x06054b50;
const DESCRIPTOR = 0x08074b50;

function inflate(method: number, compressed: Buffer) {
  if (method === 0) return compressed;
  if (method === 8) {
    try {
      return inflateRawSync(compressed);
    } catch {
      return inflateSync(compressed);
    }
  }
  throw new Error("Неподдерживаемое сжатие ZIP");
}

function skipJunk(name: string) {
  return (
    !name ||
    name.endsWith("/") ||
    name.startsWith("__MACOSX") ||
    name.includes(".DS_Store") ||
    /(^|\/)\._/.test(name)
  );
}

function findEocd(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 22 - 65535);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD) return i;
  }
  return -1;
}

function extractFromCentralDirectory(buffer: Buffer): ZipEntry[] {
  const eocd = findEocd(buffer);
  if (eocd < 0) return [];
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count && offset + 46 <= buffer.length; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");
    offset += 46 + nameLen + extraLen + commentLen;
    if (skipJunk(name) || localOffset + 30 > buffer.length) continue;
    if (buffer.readUInt32LE(localOffset) !== LOCAL) continue;
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.subarray(dataStart, Math.min(buffer.length, dataStart + compSize));
    try {
      entries.push({ name, body: inflate(method, compressed) });
    } catch {
      // skip broken entry
    }
  }
  return entries;
}

function findNextSignature(buffer: Buffer, start: number) {
  for (let i = start; i + 4 <= buffer.length; i += 1) {
    const sig = buffer.readUInt32LE(i);
    if (sig === DESCRIPTOR || sig === LOCAL || sig === CENTRAL) return i;
  }
  return buffer.length;
}

function extractFromLocalHeaders(buffer: Buffer): ZipEntry[] {
  const start = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  let offset = start < 0 ? 0 : start;
  const entries: ZipEntry[] = [];
  while (offset + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);
    if (sig === CENTRAL || sig === EOCD) break;
    if (sig !== LOCAL) break;
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    let compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLen).toString("utf8");
    const dataStart = offset + 30 + nameLen + extraLen;
    const dataDescriptor = Boolean(flags & 0x8);
    const unknownSize = dataDescriptor && (compSize === 0 || compSize === 0xffffffff);
    if (unknownSize) {
      const end = findNextSignature(buffer, dataStart);
      compSize = Math.max(0, end - dataStart);
      const compressed = buffer.subarray(dataStart, dataStart + compSize);
      offset = end;
      if (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === DESCRIPTOR) {
        offset += offset + 16 <= buffer.length ? 16 : 12;
      }
      if (skipJunk(name)) continue;
      try {
        entries.push({ name, body: inflate(method, compressed) });
      } catch {
        // skip broken entry
      }
      continue;
    }
    const compressed = buffer.subarray(dataStart, Math.min(buffer.length, dataStart + compSize));
    offset = dataStart + compSize;
    if (skipJunk(name)) continue;
    try {
      entries.push({ name, body: inflate(method, compressed) });
    } catch {
      // skip broken entry
    }
  }
  return entries;
}

export function extractZipEntries(buffer: Buffer): ZipEntry[] {
  const fromCd = extractFromCentralDirectory(buffer);
  if (fromCd.length) return fromCd;
  return extractFromLocalHeaders(buffer);
}

export function extractBestZipFile(buffer: Buffer): ZipEntry {
  const entries = extractZipEntries(buffer);
  if (entries.length === 0) {
    throw new Error("Это не ZIP или в архиве нет файлов прайса");
  }
  const rank = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".csv")) return 5;
    if (lower.endsWith(".xml")) return 4;
    if (lower.endsWith(".txt") || lower.endsWith(".tsv")) return 3;
    if (lower.endsWith(".json")) return 2;
    return 1;
  };
  entries.sort((a, b) => rank(b.name) - rank(a.name) || b.body.length - a.body.length);
  return entries[0];
}

export function isZipBuffer(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

export function zipLooksLikeXlsx(entries: ZipEntry[]) {
  return entries.some(
    (entry) =>
      entry.name === "[Content_Types].xml" ||
      entry.name.startsWith("xl/") ||
      entry.name === "xl/workbook.xml",
  );
}

function countCyr(text: string) {
  return (text.match(/[А-Яа-яЁё]/g) ?? []).length;
}

export function decodePriceText(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  let utf8 = buffer.toString("utf8");
  if (utf8.charCodeAt(0) === 0xfeff) utf8 = utf8.slice(1);
  const sample = utf8.slice(0, 12_000);
  const bad = (sample.match(/\uFFFD/g) ?? []).length;
  const utfCyr = countCyr(sample);
  let cp1251 = "";
  try {
    cp1251 = new TextDecoder("windows-1251").decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    cp1251 = "";
  }
  const cpCyr = countCyr(cp1251.slice(0, 12_000));
  if (bad > 2 || (cpCyr > utfCyr + 8 && utfCyr < 12)) return cp1251 || utf8;
  return utf8;
}
