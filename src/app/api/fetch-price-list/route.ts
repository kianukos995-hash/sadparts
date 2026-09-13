import { NextRequest } from "next/server";
import { fetchFeed } from "@/lib/safe-fetch";
import { detectFeedKind, feedToTable } from "@/lib/parse-feed";

export async function POST(request: NextRequest) {
  let body: {
    url?: string;
    apiKey?: string;
    apiKey2?: string;
    authMode?: "bearer" | "header" | "query";
    authHeaderName?: string;
    authQueryParam?: string;
    itemsPath?: string;
    jsonOnly?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Ожидался JSON" }, { status: 400 });
  }
  if (!body.url?.trim()) {
    return Response.json({ error: "Укажите URL прайса" }, { status: 400 });
  }
  try {
    const feed = await fetchFeed({
      url: body.url,
      apiKey: body.apiKey,
      apiKey2: body.apiKey2,
      authMode: body.authMode,
      authHeaderName: body.authHeaderName,
      authQueryParam: body.authQueryParam,
      origin: request.nextUrl,
    });
    const kind = detectFeedKind(feed.contentType, feed.body, feed.url);
    if (body.jsonOnly) {
      if (kind !== "json") {
        return Response.json({ error: "Ответ поставщика не является JSON" }, { status: 502 });
      }
      try {
        return Response.json({ payload: JSON.parse(feed.body) as unknown });
      } catch {
        return Response.json({ error: "Ответ поставщика не является JSON" }, { status: 502 });
      }
    }
    const table = feedToTable(kind, feed.body, body.itemsPath);
    if (table.total === 0) {
      return Response.json({ error: "В источнике нет позиций" }, { status: 422 });
    }
    return Response.json({ kind, table });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось загрузить прайс" },
      { status: 502 },
    );
  }
}
