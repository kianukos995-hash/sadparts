import { readFile } from "node:fs/promises";
import { ensureProjectZip, PROJECT_ZIP_NAME } from "@/lib/project-zip";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { zipPath, bytes } = ensureProjectZip();
    const body = await readFile(zipPath);
    return new Response(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${PROJECT_ZIP_NAME}"`,
        "Content-Length": String(bytes),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ZIP недоступен";
    return Response.json({ error: message }, { status: 500 });
  }
}
