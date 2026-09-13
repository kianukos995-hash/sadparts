import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await currentUser(request);
  return Response.json({ user });
}
