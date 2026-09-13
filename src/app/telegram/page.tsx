"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyField } from "@/components/key-field";
import type { PublicSettings } from "@/lib/types";

export default function TelegramPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/settings", { cache: "no-store" });
    const data = (await response.json()) as PublicSettings;
    setSettings(data);
    setToken(data.telegramTokenMasked);
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- load bot settings from the server */
    void load();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function save(payload: { token?: string; polling?: boolean; clear?: boolean }) {
    setBusy(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as PublicSettings & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не сохранить");
      setSettings(data);
      setToken(data.telegramTokenMasked);
      toast.success("Настройки Telegram сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Telegram-бот</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Бот отвечает артикулом, OEM и ценами из того же прайса, что виден в каталоге.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4" />
            Подключение
          </CardTitle>
          <CardDescription>
            Создайте бота у @BotFather, скопируйте токен и вставьте сюда. Пока открыт SadParts
            Prices, бот опрашивает Telegram сам.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="grid gap-1.5">
            <Label>Токен бота</Label>
            <KeyField
              value={token}
              onChange={setToken}
              placeholder="123456:AAH..."
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={settings?.telegramPolling ?? true}
              onCheckedChange={(checked) => {
                void save({ polling: checked === true });
              }}
            />
            Отвечать на сообщения, пока открыт сайт
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !token.trim() || token.includes("…")}
              onClick={() => void save({ token, polling: settings?.telegramPolling ?? true })}
            >
              Проверить и сохранить
            </Button>
            {settings?.telegramConfigured ? (
              <Button variant="outline" disabled={busy} onClick={() => void save({ clear: true })}>
                Отключить
              </Button>
            ) : null}
          </div>
          {settings?.telegramConfigured ? (
            <Alert>
              <AlertTitle>Бот активен</AlertTitle>
              <AlertDescription>
                Напишите @{settings.telegramUsername || "боту"} артикул или OEM — он вернёт цены
                поставщиков.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Как спрашивать прайс</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>Любой текст без команды — поиск по артикулу, OEM, бренду и названию.</p>
          <p>
            <code className="rounded bg-muted px-1">/search колодки</code> — поиск по словам
          </p>
          <p>
            <code className="rounded bg-muted px-1">/suppliers</code> — список поставщиков и число
            позиций
          </p>
          <p>
            Вебхук для сервера с белым IP:{" "}
            <code className="break-all rounded bg-muted px-1">/api/telegram/webhook</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
