import { NextRequest } from "next/server";
import { importCatalogFile, previewCatalogFileAsync } from "@/lib/import-catalog";
import { listImportHistory, rollbackImport } from "@/lib/import-history";
import { readStore, touchSupplierSync } from "@/lib/server-store";
import type { ImportMode } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 80 * 1024 * 1024;

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const supplierId = request.nextUrl.searchParams.get("supplierId") ?? "";
  const items = await listImportHistory(supplierId || undefined);
  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const action = String(form.get("action") ?? "import");
  if (action === "rollback") {
    try {
      const result = await rollbackImport(String(form.get("historyId") ?? ""));
      const next = await touchSupplierSync(result.item.supplierId, {
        id: result.rollback.id,
        supplierId: result.item.supplierId,
        at: result.rollback.at,
        status: "ok",
        imported: result.item.imported,
        source: "file",
        fileName: result.item.fileName,
        label: result.rollback.label,
        mode: "replace",
      });
      return Response.json({ ok: true, rollback: result.rollback, store: next });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Не удалось откатить прайс" },
        { status: 422 },
      );
    }
  }

  const file = form.get("file");
  const supplierId = String(form.get("supplierId") ?? "");
  const mode = (String(form.get("mode") ?? "replace") === "merge" ? "merge" : "replace") as ImportMode;
  const label = String(form.get("label") ?? "");
  if (!(file instanceof File)) {
    return Response.json({ error: "Прикрепите ZIP, CSV или XML прайса" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Файл больше 80 МБ" }, { status: 413 });
  }
  const store = await readStore();
  const supplier = store.suppliers.find((item) => item.id === supplierId);
  if (!supplier) return Response.json({ error: "Поставщик не найден" }, { status: 404 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (action === "preview") {
      const preview = await previewCatalogFileAsync(buffer, file.name);
      return Response.json(preview);
    }
    const result = await importCatalogFile(supplier, buffer, file.name, mode, label);
    const log = {
      id: result.history.id,
      supplierId: supplier.id,
      at: result.history.at,
      status: "ok" as const,
      imported: result.imported,
      source: "file" as const,
      fileName: file.name,
      label: result.label,
      mode,
    };
    const next = await touchSupplierSync(supplier.id, log, result.imported);
    return Response.json({
      imported: result.imported,
      skipped: result.skipped,
      warnings: result.warnings,
      label: result.label,
      store: next,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить прайс" },
      { status: 422 },
    );
  }
}
