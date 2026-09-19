import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { fail, requireUser } from "@/lib/session";
import { readStore, upsertSupplierRequest } from "@/lib/server-store";
import { canRequestSupplier, canSeeSupplierCatalog } from "@/lib/suppliers-scope";
import { presetById } from "@/lib/supplier-presets";
import type { SupplierRequest } from "@/lib/types";

export const runtime = "nodejs";

const FILES_DIR = path.join(process.cwd(), "data", "supplier-request-files");
const MAX_BYTES = 20 * 1024 * 1024;

function publicRequest(item: SupplierRequest): SupplierRequest {
  return { ...item, filePath: undefined };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!canSeeSupplierCatalog(user)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const store = await readStore();
    const all = store.supplierRequests ?? [];
    const items =
      user.role === "admin"
        ? all
        : all.filter(
            (item) =>
              item.requestedByUserId === user.id ||
              (user.organizationId && item.organizationId === user.organizationId),
          );
    return Response.json({ items: items.map(publicRequest) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!canRequestSupplier(user)) {
      return Response.json(
        { error: "Запрос на поставщика отправляют организация или менеджер." },
        { status: 403 },
      );
    }
    const form = await request.formData();
    const presetId = String(form.get("presetId") ?? "").trim();
    const preset = presetId ? presetById(presetId) : undefined;
    const name = String(form.get("name") ?? "").trim() || preset?.name || "";
    const comment = String(form.get("comment") ?? "").trim();
    if (!name) {
      return Response.json({ error: "Укажите название поставщика" }, { status: 400 });
    }
    const file = form.get("file");
    const id = crypto.randomUUID();
    let fileName: string | undefined;
    let filePath: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) {
        return Response.json({ error: "Файл больше 20 МБ" }, { status: 400 });
      }
      fileName = file.name.replace(/[/\\]/g, "_");
      await mkdir(FILES_DIR, { recursive: true });
      const stored = `${id}-${fileName}`;
      await writeFile(path.join(FILES_DIR, stored), Buffer.from(await file.arrayBuffer()));
      filePath = stored;
    }
    const created: SupplierRequest = {
      id,
      createdAt: new Date().toISOString(),
      requestedByUserId: user.id,
      requestedByName: user.fio || user.name || user.email,
      requestedByEmail: user.email,
      organizationId: user.organizationId,
      name,
      comment,
      presetId: preset?.id,
      fileName,
      filePath,
      status: "pending",
    };
    await upsertSupplierRequest(created);
    return Response.json({ item: publicRequest(created) });
  } catch (error) {
    return fail(error);
  }
}
