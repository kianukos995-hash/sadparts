import { readStore } from "@/lib/server-store";
import { fail, requireUser } from "@/lib/session";
import { listAccessKeys } from "@/lib/auth-store";
import { readSettings } from "@/lib/server-store";
import { publicStoreFor } from "@/lib/public-store";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const [store, settings, keys] = await Promise.all([readStore(), readSettings(), listAccessKeys()]);
    return Response.json(publicStoreFor(user, store, settings, keys));
  } catch (error) {
    return fail(error);
  }
}
