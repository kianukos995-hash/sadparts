"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";
import type { EmailInboxItem, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EmailPricesCard({ suppliers }: { suppliers: Supplier[] }) {
  const { user } = useAuth();
  const { refresh, settings, saveTradeSettings } = useAvtoPrice();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [to, setTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<EmailInboxItem[]>([]);
  const [imapHost, setImapHost] = useState<string | null>(null);
  const [imapUser, setImapUser] = useState<string | null>(null);
  const address = settings.priceMailboxAddress || "prajsy@sadparts.local";

  useEffect(() => {
    void fetch("/api/prices/email")
      .then(async (response) => {
        const data = (await response.json()) as { items?: EmailInboxItem[] };
        setItems(data.items ?? []);
      })
      .catch(() => undefined);
  }, []);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (from.trim()) form.set("from", from.trim());
      if (to.trim()) form.set("to", to.trim());
      if (subject.trim()) form.set("subject", subject.trim());
      if (supplierId) form.set("supplierId", supplierId);
      const response = await fetch("/api/prices/email", { method: "POST", body: form });
      const data = (await response.json()) as {
        error?: string;
        imported?: number;
        supplierName?: string;
        items?: EmailInboxItem[];
      };
      if (data.items) setItems(data.items);
      if (!response.ok) throw new Error(data.error || "Письмо не разобралось");
      await refresh();
      toast.success(
        `${data.supplierName}: ${data.imported?.toLocaleString("ru-RU")} позиций из письма`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не принять письмо");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Прайсы по почте
        </CardTitle>
        <CardDescription>
          Пришлите CSV/XLSX/ZIP на адрес поставщика или общий ящик. Тема или имя файла должны
          содержать название (ARMTEK, Autodoc…). Письмо .eml тоже читается — вложения распознаются.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          Общий ящик: <span className="font-mono">{address}</span>
          <p className="mt-1 text-xs text-muted-foreground">
            У каждого поставщика свой алиас, например armtek@prajsy.local. Локально письма
            перетаскиваются сюда; боевой IMAP — ниже, если ящик уже есть.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Label>От кого</Label>
            <Input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="manager@armtek.ru" />
          </label>
          <label className="grid gap-1.5">
            <Label>Кому</Label>
            <Input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="armtek@prajsy.local"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Тема</Label>
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="ARMTEK прайс 19.09"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <Label>Поставщик, если не угадать</Label>
            <select
              className="h-9 rounded-lg border bg-transparent px-3 text-sm"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Определить по теме и файлу</option>
              {suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.emailAlias ? ` · ${item.emailAlias}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".eml,.csv,.tsv,.txt,.xlsx,.xls,.xml,.zip,.json,.yml,message/rfc822"
          className="sr-only"
          onChange={(event) => {
            const next = event.target.files?.[0];
            event.target.value = "";
            void send(next);
          }}
        />
        <button
          type="button"
          disabled={busy}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center hover:bg-muted/40",
            busy && "pointer-events-none opacity-70",
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void send(event.dataTransfer.files?.[0]);
          }}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {busy ? "Разбираю письмо…" : "Перетащите .eml или прайс — или нажмите"}
          </span>
        </button>
        {user?.role === "admin" ? (
        <details className="rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Боевой IMAP (необязательно)</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <Label>Хост</Label>
              <Input
                value={imapHost ?? settings.priceMailboxImapHost ?? ""}
                onChange={(event) => setImapHost(event.target.value)}
                placeholder="imap.yandex.ru"
              />
            </label>
            <label className="grid gap-1.5">
              <Label>Логин</Label>
              <Input
                value={imapUser ?? settings.priceMailboxImapUser ?? ""}
                onChange={(event) => setImapUser(event.target.value)}
                placeholder="prajsy@…"
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => {
                void saveTradeSettings({
                  priceMailboxImapHost: imapHost ?? settings.priceMailboxImapHost,
                  priceMailboxImapUser: imapUser ?? settings.priceMailboxImapUser,
                })
                  .then(() => toast.success("Ящик сохранён. Письма пока принимаем перетаскиванием."))
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Ошибка"),
                  );
              }}
            >
              Сохранить ящик
            </Button>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Пароль IMAP не храним в открытом превью. Пока письма кладут сюда файлом — распознавание
              то же, что у входящего ящика.
            </p>
          </div>
        </details>
        ) : null}
        <div className="grid gap-2">
          <p className="text-sm font-medium">Входящие</p>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Писем ещё не было.</p>
          ) : (
            items.slice(0, 12).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.subject || item.fileName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(item.at)} · {item.from || "без отправителя"} → {item.to || "ящик"}
                    {item.supplierName ? ` · ${item.supplierName}` : ""}
                  </p>
                  {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
                </div>
                <Badge variant={item.status === "ok" ? "secondary" : "destructive"}>
                  {item.status === "ok" ? `${item.imported} шт.` : item.status === "unmatched" ? "не узнали" : "ошибка"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
