import { NextRequest } from "next/server";
import { importCatalogFile, previewCatalogFileAsync } from "@/lib/import-catalog";
import { listImportHistory, rollbackImport } from "@/lib/import-history";
import { describeColumnMap } from "@/lib/mapping";
import { readStore, touchSupplierSync } from "@/lib/server-store";
import type { ColumnMap, FieldKey, ImportMode } from "@/lib/types";
import { FIELD_KEYS } from "@/lib/types";
import { fail, requireUser } from "@/lib/session";
import { canEditSupplier, canManageSuppliers } from "@/lib/suppliers-scope";

export const runtime = "nodejs";

const MAX_BYTES = 80 * 1024 * 1024;

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const store = await readStore();
  const supplierId = request.nextUrl.searchParams.get("supplierId") ?? "";
  if (supplierId) {
    const supplier = store.suppliers.find((item) => item.id === supplierId);
    if (!supplier || !canEditSupplier(supplier, user, store.organizations ?? [])) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
  } else if (!canManageSuppliers(user, store.organizations ?? [])) {
    return Response.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  let items = await listImportHistory(supplierId || undefined);
  if (!supplierId) {
    const allowed = new Set(
      store.suppliers
        .filter((item) => canEditSupplier(item, user, store.organizations ?? []))
        .map((item) => item.id),
    );
    items = items.filter((item) => allowed.has(item.supplierId));
  }
  return Response.json({ items });
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireUser(request);
  } catch (error) {
    return fail(error);
  }
  const form = await request.formData();
  const action = String(form.get("action") ?? "import");
  const store = await readStore();
  const orgs = store.organizations ?? [];
  if (action === "rollback") {
    try {
      const historyId = String(form.get("historyId") ?? "");
      const items = await listImportHistory();
      const historyItem = items.find((item) => item.id === historyId);
      if (!historyItem) return Response.json({ error: "Запись не найдена" }, { status: 404 });
      const supplier = store.suppliers.find((item) => item.id === historyItem.supplierId);
      if (!supplier || !canEditSupplier(supplier, user, orgs)) {
        return Response.json({ error: "Недостаточно прав" }, { status: 403 });
      }
      const result = await rollbackImport(historyId);
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
  const overlayMap = parseColumnMap(form.get("columnMap"));
  if (!(file instanceof File)) {
    return Response.json({ error: "Прикрепите ZIP, CSV, XLSX или XML прайса" }, { status: 400 });
  }
  if (!file.size) {
    return Response.json({ error: "Файл пустой — выберите прайс ещё раз" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Файл больше 80 МБ" }, { status: 413 });
  }
  const storeForSupplier = await readStore();
  const supplier = storeForSupplier.suppliers.find((item) => item.id === supplierId);
  if (!supplier) return Response.json({ error: "Поставщик не найден. Откройте карточку и повторите." }, { status: 404 });
  if (!canEditSupplier(supplier, user, storeForSupplier.organizations ?? [])) {
    return Response.json({ error: "Поставщика закрепил администратор" }, { status: 403 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength === 0) {
      return Response.json({ error: "Файл не доехал: 0 байт. Проверьте выбор файла." }, { status: 400 });
    }
    if (action === "preview") {
      const preview = await previewCatalogFileAsync(buffer, file.name);
      return Response.json({
        ...preview,
        bytes: buffer.byteLength,
        keys: keyFlags(supplier),
      });
    }
    const result = await importCatalogFile(supplier, buffer, file.name, mode, label, overlayMap);
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
    const next = await touchSupplierSync(supplier.id, log, result.imported, { columnMap: result.map });
    return Response.json({
      imported: result.imported,
      skipped: result.skipped,
      warnings: result.warnings,
      label: result.label,
      fileName: file.name,
      bytes: buffer.byteLength,
      map: result.map,
      mapNote: describeColumnMap(result.map),
      keys: keyFlags(supplier),
      store: next,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить прайс" },
      { status: 422 },
    );
  }
}

function parseColumnMap(raw: FormDataEntryValue | null): Partial<ColumnMap> | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const map: Partial<ColumnMap> = {};
    for (const field of FIELD_KEYS) {
      const value = parsed[field];
      if (typeof value === "string" && value.trim()) map[field] = value;
    }
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}

function keyFlags(supplier: { adapter: string; apiKey: string; apiKey2: string; authHeaderName: string; authQueryParam: string; columnMap: ColumnMap }) {
  const mapped = FIELD_KEYS.filter((field: FieldKey) => Boolean(supplier.columnMap[field]));
  return {
    key1: Boolean(supplier.apiKey.trim()),
    key2: Boolean(supplier.apiKey2.trim()),
    rossko: supplier.adapter === "rossko",
    authHeaderName: supplier.authHeaderName || "",
    authQueryParam: supplier.authQueryParam || "",
    mappedFields: mapped,
  };
}
