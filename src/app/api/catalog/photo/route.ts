import { NextRequest } from "next/server";
import { writeMediaFile } from "@/lib/media-store";
import { writeOfferPatch } from "@/lib/offer-patches";
import { patchOffer, readStore } from "@/lib/server-store";
import { uniqueUrls } from "@/lib/media";

export const runtime = "nodejs";

const MAX = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/avif") return "avif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Нет файла или позиции" }, { status: 400 });
  }
  const file = form.get("file");
  const offerId = String(form.get("offerId") ?? "");
  const supplierIdRaw = String(form.get("supplierId") ?? "");
  if (!(file instanceof File) || !offerId) {
    return Response.json({ error: "Нет файла или позиции" }, { status: 400 });
  }
  if (file.size > MAX) {
    return Response.json({ error: "Файл больше 8 МБ" }, { status: 400 });
  }
  if (file.type && !ALLOWED.has(file.type) && !file.type.startsWith("image/")) {
    return Response.json({ error: "Нужно изображение" }, { status: 400 });
  }
  const store = await readStore();
  const fromStore = store.offers.find((item) => item.id === offerId);
  const previous = (() => {
    try {
      const raw = form.get("images");
      if (typeof raw === "string" && raw.trim()) return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
    return fromStore?.images ?? [];
  })();
  const supplierId =
    supplierIdRaw ||
    fromStore?.supplierId ||
    store.suppliers.find((item) => offerId.startsWith(`${item.id}:`))?.id ||
    "";
  if (!supplierId) {
    return Response.json({ error: "Неизвестный поставщик" }, { status: 400 });
  }
  const sku = (fromStore?.sku || offerId.split(":").pop() || "part").replace(/[^\w.-]+/g, "_");
  const relative = `nomenclature/${sku}-${Date.now()}.${extOf(file)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await writeMediaFile(supplierId, relative, buffer);
  const images = uniqueUrls([...(previous ?? []), url]);
  await writeOfferPatch(supplierId, offerId, { images });
  const next = await patchOffer(offerId, { images });
  return Response.json({ ok: true, url, images, store: next });
}
