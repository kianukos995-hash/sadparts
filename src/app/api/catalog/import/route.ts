import { NextRequest } from "next/server";
import { importCatalogFile } from "@/lib/import-catalog";
import { readStore, touchSupplierSync } from "@/lib/server-store";
import type { ImportMode } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 80 * 1024 * 1024;

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const supplierId = String(form.get("supplierId") ?? "");
  const mode = (String(form.get("mode") ?? "replace") === "merge" ? "merge" : "replace") as ImportMode;
  if (!(file instanceof File)) {
    return Response.json({ error: "Прикрепите ZIP или CSV Росско" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Файл больше 80 МБ" }, { status: 413 });
  }
  const store = await readStore();
  const supplier = store.suppliers.find((item) => item.id === supplierId);
  if (!supplier) return Response.json({ error: "Поставщик не найден" }, { status: 404 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importCatalogFile(supplier, buffer, file.name, mode);
    const log = {
      id: crypto.randomUUID(),
      supplierId: supplier.id,
      at: new Date().toISOString(),
      status: "ok" as const,
      imported: result.imported,
      source: "file" as const,
      fileName: file.name,
      mode,
    };
    const next = await touchSupplierSync(supplier.id, log, result.imported);
    return Response.json({
      imported: result.imported,
      skipped: result.skipped,
      store: next,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить прайс Росско" },
      { status: 422 },
    );
  }
}
