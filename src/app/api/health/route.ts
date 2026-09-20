export async function GET() {
  return Response.json({ ok: true, service: "sadparts", ts: Date.now() });
}
