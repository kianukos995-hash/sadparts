"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatDateTime } from "@/lib/format";
import { PINNED_PRICE_MAILBOX } from "@/lib/price-mailbox";
import type { EmailInboxItem, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

type MailboxInfo = {
  address: string;
  plusExample: string;
  inboundPath: string;
  fetchPath: string;
  secretConfigured: boolean;
  imapConfigured: boolean;
  hooked: boolean;
};

export function EmailPricesCard({ suppliers }: { suppliers: Supplier[] }) {
  const { refresh } = useAvtoPrice();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [to, setTo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<EmailInboxItem[]>([]);
  const [mailbox, setMailbox] = useState<MailboxInfo>({
    address: PINNED_PRICE_MAILBOX,
    plusExample: "prajsy+armtek@sadparts.ru",
    inboundPath: "/api/prices/email/inbound",
    fetchPath: "/api/prices/email/fetch",
    secretConfigured: false,
    imapConfigured: false,
    hooked: false,
  });

  function loadInbox() {
    return fetch("/api/prices/email")
      .then(async (response) => {
        const data = (await response.json()) as { items?: EmailInboxItem[]; mailbox?: MailboxInfo };
        setItems(data.items ?? []);
        if (data.mailbox) setMailbox(data.mailbox);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    void loadInbox();
  }, []);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (from.trim()) form.set("from", from.trim());
      form.set("to", to.trim() || mailbox.address);
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

  async function fetchImap() {
    setFetching(true);
    try {
      const response = await fetch("/api/prices/email/fetch", { method: "POST" });
      const data = (await response.json()) as { error?: string; fetched?: number; imported?: number };
      if (!response.ok) throw new Error(data.error || "IMAP не ответил");
      await loadInbox();
      await refresh();
      toast.success(`Снято ${data.fetched ?? 0} писем, разобрано ${data.imported ?? 0}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ящик не открылся");
    } finally {
      setFetching(false);
    }
  }

  function copy(text: string, ok: string) {
    void navigator.clipboard.writeText(text).then(
      () => toast.success(ok),
      () => toast.error("Не скопировать"),
    );
  }

  const inboundUrl =
    typeof window === "undefined" ? mailbox.inboundPath : `${window.location.origin}${mailbox.inboundPath}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" />
          Прайсы по почте
        </CardTitle>
        <CardDescription>
          Один закреплённый ящик проекта. Поставщики шлют на него (или на plus-алиас). Разбор тот же,
          что у перетаскивания .eml.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-xl border bg-muted/30 px-3 py-3">
          <p className="text-xs text-muted-foreground">Закреплённый ящик</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="text-sm font-semibold">{mailbox.address}</code>
            <Button size="sm" variant="outline" onClick={() => copy(mailbox.address, "Адрес скопирован")}>
              <Copy />
              Копировать
            </Button>
            <Badge variant={mailbox.hooked ? "secondary" : "outline"}>
              {mailbox.hooked ? "зацеплен в .env" : "пока только разбор вручную"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Алиас поставщика: <code>{mailbox.plusExample}</code> — плюс после имени ящика, домен тот же.
          </p>
        </div>

        <details className="rounded-lg border px-3 py-2" open>
          <summary className="cursor-pointer text-sm font-medium">Как ящик цепляется в проект</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Адрес зашит в код как <code>{PINNED_PRICE_MAILBOX}</code>. Боевой ящик и секреты — только
              в <code>.env</code> (<code>PRICE_MAILBOX_ADDRESS</code>, <code>PRICE_MAILBOX_SECRET</code>,
              IMAP).
            </li>
            <li>
              <strong className="text-foreground">Входящий webhook.</strong> Cloudflare Email Routing /
              Mailgun Inbound / свой forwarder шлёт сырое письмо POST на{" "}
              <code className="break-all">{inboundUrl}</code> с заголовком{" "}
              <code>Authorization: Bearer PRICE_MAILBOX_SECRET</code>. Это основной крюк.
            </li>
            <li>
              <strong className="text-foreground">IMAP.</strong> Тот же ящик на Яндексе/Timeweb:{" "}
              <code>PRICE_IMAP_HOST/USER/PASS</code>. Кнопка «Забрать письма» или cron на{" "}
              <code>{mailbox.fetchPath}</code> с тем же секретом.
            </li>
            <li>
              Пока DNS/ящик не заведены — перетащите .eml сюда. Разбор тот же: тема, plus-адрес, имя
              файла → поставщик → прайс.
            </li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copy(inboundUrl, "URL входящей почты скопирован")}>
              <Copy />
              URL webhook
            </Button>
            <Button size="sm" variant="outline" disabled={!mailbox.imapConfigured || fetching} onClick={() => void fetchImap()}>
              <RefreshCw className={fetching ? "animate-spin" : ""} />
              {fetching ? "Снимаю ящик…" : "Забрать письма по IMAP"}
            </Button>
          </div>
          <p className="mt-2 text-xs">
            Секрет: {mailbox.secretConfigured ? "задан в .env" : "не задан — webhook закрыт"}. IMAP:{" "}
            {mailbox.imapConfigured ? "логин задан" : "не задан"}.
          </p>
        </details>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Label>От кого</Label>
            <Input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="opt@armtek.ru" />
          </label>
          <label className="grid gap-1.5">
            <Label>Кому</Label>
            <Input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder={mailbox.plusExample}
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
              <option value="">Определить по теме и plus-адресу</option>
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
            {busy ? "Разбираю письмо…" : "Перетащите .eml или прайс — как будто письмо уже пришло"}
          </span>
        </button>
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
                    {formatDateTime(item.at)} · {item.from || "без отправителя"} → {item.to || mailbox.address}
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
