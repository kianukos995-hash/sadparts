import { copyFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { invalidateCatalog } from "@/lib/file-catalog";
import type { ImportHistoryItem } from "@/lib/types";

const DIR = path.join(process.cwd(), "data", "imports");
const INDEX = path.join(DIR, "history.json");
const KEEP = 12;

async function readIndex(): Promise<ImportHistoryItem[]> {
  try {
    const parsed = JSON.parse(await readFile(INDEX, "utf8")) as ImportHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(items: ImportHistoryItem[]) {
  await mkdir(DIR, { recursive: true });
  await writeFile(INDEX, JSON.stringify(items, null, 2), "utf8");
}

function catalogPath(supplierId: string) {
  return path.join(process.cwd(), "data", "catalogs", `${supplierId}.jsonl`);
}

export async function listImportHistory(supplierId?: string) {
  const items = await readIndex();
  return supplierId ? items.filter((item) => item.supplierId === supplierId) : items;
}

export async function copyPreviousCatalog(supplierId: string) {
  await mkdir(DIR, { recursive: true });
  const id = crypto.randomUUID();
  try {
    const snapshotFile = `${id}.jsonl`;
    await copyFile(catalogPath(supplierId), path.join(DIR, snapshotFile));
    return { id, snapshotFile };
  } catch {
    return { id, snapshotFile: "" };
  }
}

export async function recordImportHistory(item: ImportHistoryItem) {
  const next = [item, ...(await readIndex())];
  const kept = next.slice(0, KEEP);
  const rest = next.slice(KEEP);
  for (const old of rest) {
    if (!old.snapshotFile) continue;
    try {
      await unlink(path.join(DIR, old.snapshotFile));
    } catch {
      // gone
    }
  }
  await writeIndex(
    [...kept, ...rest.map((row) => ({ ...row, snapshotFile: undefined }))].slice(0, 40),
  );
  return item;
}

export async function rollbackImport(id: string) {
  const items = await readIndex();
  const item = items.find((row) => row.id === id);
  if (!item?.snapshotFile) throw new Error("Снимка для отката нет — храним только последние 12 загрузок");
  await copyFile(path.join(DIR, item.snapshotFile), catalogPath(item.supplierId));
  invalidateCatalog(item.supplierId);
  const rollback: ImportHistoryItem = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    supplierId: item.supplierId,
    label: `Откат: ${item.label}`,
    fileName: item.fileName,
    mode: "replace",
    imported: item.imported,
    skipped: 0,
    rolledBackFrom: item.id,
  };
  await writeIndex([rollback, ...items].slice(0, 40));
  return { item, rollback };
}

export async function listSnapshots() {
  try {
    return await readdir(DIR);
  } catch {
    return [];
  }
}
