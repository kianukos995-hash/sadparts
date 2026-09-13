import { inflateRawSync } from "node:zlib";

export function extractFirstZipFile(buffer: Buffer) {
  if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("Это не ZIP-архив");
  }
  const method = buffer.readUInt16LE(8);
  const compSize = buffer.readUInt32LE(18);
  const nameLen = buffer.readUInt16LE(26);
  const extraLen = buffer.readUInt16LE(28);
  const name = buffer.subarray(30, 30 + nameLen).toString("utf8");
  const start = 30 + nameLen + extraLen;
  const compressed = buffer.subarray(start, start + compSize);
  const body =
    method === 0
      ? compressed
      : method === 8
        ? inflateRawSync(compressed)
        : (() => {
            throw new Error("Неподдерживаемое сжатие ZIP");
          })();
  return { name, body };
}
