"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportHistoryItem } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useAvtoPrice } from "@/hooks/use-avtoprice";

export function ImportHistoryCard({ supplierId }: { supplierId?: string }) {
  const { refresh, logs } = useAvtoPrice();
  const [items, setItems] = useState<ImportHistoryItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const latestLog = logs[0]?.id;

  async function load() {
    const url = supplierId
      ? `/api/catalog/import?supplierId=${encodeURIComponent(supplierId)}`
      : "/api/catalog/import";
    const response = await fetch(url, { cache: "no-store" });
    const data = (await response.json()) as { items?: ImportHistoryItem[] };
    setItems(data.items ?? []);
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- history is loaded after mount and after each import */
    void load();
    /* eslint-enable react-hooks/set-state-in-effect */
    // load is recreated each render; supplierId + latest import log are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, latestLog]);

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История прайсов</CardTitle>
          <CardDescription>После загрузки здесь можно откатить последнюю подмену каталога.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История прайсов</CardTitle>
        <CardDescription>Откат возвращает каталог поставщика к снимку до этой загрузки.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border px-3 py-2">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(item.at)} · {item.fileName} · {item.imported} поз.
              {item.skipped ? ` · пропуск ${item.skipped}` : ""}
              {item.rolledBackFrom ? " · откат" : ""}
            </p>
            {item.snapshotFile && !item.rolledBackFrom ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={busy === item.id}
                onClick={() => {
                  setBusy(item.id);
                  const form = new FormData();
                  form.set("action", "rollback");
                  form.set("historyId", item.id);
                  void fetch("/api/catalog/import", { method: "POST", body: form })
                    .then(async (response) => {
                      const data = (await response.json()) as { error?: string };
                      if (!response.ok) throw new Error(data.error || "Откат не удался");
                      toast.success("Прайс откатили");
                      await refresh();
                      await load();
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    )
                    .finally(() => setBusy(null));
                }}
              >
                Откатить
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
