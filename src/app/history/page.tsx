"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

export default function HistoryPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/activity")
      .then(async (response) => {
        const data = (await response.json()) as { events?: ActivityEvent[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Нет доступа");
        setEvents(data.events ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Ошибка"));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">История визитов</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Кто входил, что искал, какие цены видел в проценке и что клал в заказ. Если API
          поставщика позже изменит цену — в заказе будет перепроценка, здесь останется снимок.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Журнал</CardTitle>
          <CardDescription>Последние действия покупателей и сотрудников</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока пусто — после поисков и заказов появятся строки.</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">
                  {event.email || "гость"} · {event.action}
                </p>
                <p className="text-muted-foreground">{event.detail}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.at)}
                  {event.sku ? ` · ${event.sku}` : ""}
                  {event.sellPrice != null ? ` · цена ${formatMoney(event.sellPrice)}` : ""}
                  {event.buyPrice != null ? ` · закуп ${formatMoney(event.buyPrice)}` : ""}
                  {event.stock != null ? ` · ост. ${event.stock}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
