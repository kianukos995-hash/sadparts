import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { fail, requireUser } from "@/lib/session";
import {
  patchSupplierRequest,
  readStore,
  touchSupplierSync,
  upsertSupplier,
} from "@/lib/server-store";
import { emptySupplierFromPreset, presetById } from "@/lib/supplier-presets";
import { CUSTOM_FILE_ID } from "@/lib/supplier-presets";
import { importCatalogFile } from "@/lib/import-catalog";
import type { SupplierRequest } from "@/lib/types";

export const runtime = "nodejs";

const FILES_DIR = path.join(process.cwd(), "data", "supplier-request-files");

function publicRequest(item: SupplierRequest): SupplierRequest {
  return { ...item, filePath: undefined };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    if (user.role !== "admin") {
      return Response.json({ error: "Запросы закрывает только администратор" }, { status: 403 });
    }
    const { id } = await context.params;
    const body = (await request.json()) as { action?: string; note?: string };
    const store = await readStore();
    const current = (store.supplierRequests ?? []).find((item) => item.id === id);
    if (!current) return Response.json({ error: "Запрос не найден" }, { status: 404 });
    if (current.status !== "pending") {
      return Response.json({ error: "Запрос уже разобран" }, { status: 400 });
    }
    const note = (body.note ?? "").trim();
    if (body.action === "reject") {
      if (!note) {
        return Response.json({ error: "Напишите, почему отклоняете" }, { status: 400 });
      }
      const next = await patchSupplierRequest(id, {
        status: "rejected",
        adminNote: note,
        reviewedAt: new Date().toISOString(),
        reviewedByUserId: user.id,
      });
      const item = next.supplierRequests.find((row) => row.id === id)!;
      return Response.json({ item: publicRequest(item) });
    }
    if (body.action !== "approve") {
      return Response.json({ error: "Нужно approve или reject" }, { status: 400 });
    }
    const preset = presetById(current.presetId) || presetById(CUSTOM_FILE_ID)!;
    const created = emptySupplierFromPreset(preset);
    created.name = current.name || preset.name;
    created.code = created.code || current.name.slice(0, 8).toUpperCase().replace(/\s+/g, "");
    created.ownerRole = "admin";
    created.lockedByAdmin = true;
    created.notes = current.comment
      ? `${created.notes}\nЗапрос: ${current.comment}`
      : created.notes;
    await upsertSupplier(created);
    if (current.filePath) {
      try {
        const buffer = await readFile(path.join(FILES_DIR, current.filePath));
        const imported = await importCatalogFile(
          created,
          buffer,
          current.fileName || current.filePath,
          "replace",
          current.name,
        );
        await touchSupplierSync(
          created.id,
          {
            id: crypto.randomUUID(),
            supplierId: created.id,
            at: new Date().toISOString(),
            status: "ok",
            imported: imported.imported,
            source: "file",
            fileName: current.fileName,
            label: current.name,
            mode: "replace",
          },
          imported.imported,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Прайс из запроса не загрузился";
        await patchSupplierRequest(id, {
          status: "approved",
          adminNote: note ? `${note} · ${message}` : message,
          reviewedAt: new Date().toISOString(),
          reviewedByUserId: user.id,
          supplierId: created.id,
        });
        return Response.json({
          error: `Поставщик создан, но прайс не принялся: ${message}`,
          supplierId: created.id,
        }, { status: 207 });
      }
    }
    const next = await patchSupplierRequest(id, {
      status: "approved",
      adminNote: note || "Добавлен в справочник",
      reviewedAt: new Date().toISOString(),
      reviewedByUserId: user.id,
      supplierId: created.id,
    });
    const item = next.supplierRequests.find((row) => row.id === id)!;
    return Response.json({ item: publicRequest(item), supplierId: created.id });
  } catch (error) {
    return fail(error);
  }
}
