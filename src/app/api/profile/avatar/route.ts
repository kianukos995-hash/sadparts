import { fail, jsonUser, requireUser } from "@/lib/session";
import { updateProfile } from "@/lib/auth-store";
import { writeMediaFile } from "@/lib/media-store";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Выберите файл" }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: "Файл больше 2 МБ" }, { status: 400 });
    }
    const type = file.type || "image/jpeg";
    if (!ALLOWED.has(type)) {
      return Response.json({ error: "Нужен JPEG, PNG или WebP" }, { status: 400 });
    }
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const avatarUrl = await writeMediaFile("avatars", `${user.id}.${ext}`, buffer);
    const next = await updateProfile(user.id, { avatarUrl: `${avatarUrl}?t=${Date.now()}` });
    return jsonUser(next);
  } catch (error) {
    return fail(error);
  }
}
