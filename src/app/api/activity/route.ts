import { readActivity } from "@/lib/activity";
import { fail, requireUser } from "@/lib/session";

export async function GET(request: Request) {
  try {
    await requireUser(request, ["admin", "manager"]);
    const events = await readActivity(500);
    return Response.json({ events });
  } catch (error) {
    return fail(error);
  }
}
