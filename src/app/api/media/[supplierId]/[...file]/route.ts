import { NextRequest } from "next/server";
import { mediaContentType, readMediaFile } from "@/lib/media-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ supplierId: string; file: string[] }> },
) {
  const { supplierId, file } = await context.params;
  const relative = (file ?? []).join("/");
  if (!supplierId || !relative) {
    return Response.json({ error: "Нет файла" }, { status: 400 });
  }
  try {
    const body = await readMediaFile(supplierId, relative);
    return new Response(body, {
      headers: {
        "Content-Type": mediaContentType(relative),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return Response.json({ error: "Файл не найден" }, { status: 404 });
  }
}
