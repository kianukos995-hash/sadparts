import { pollTelegram } from "@/lib/telegram";

export async function POST() {
  try {
    const result = await pollTelegram();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Опрос Telegram не удался" },
      { status: 502 },
    );
  }
}
