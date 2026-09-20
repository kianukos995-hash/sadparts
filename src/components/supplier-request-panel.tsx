"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SearchPick } from "@/components/search-pick";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { SUPPLIER_PRESETS, presetById } from "@/lib/supplier-presets";
import { canCreateSupplier, canRequestSupplier } from "@/lib/suppliers-scope";
import type { SupplierRequest } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

export function SupplierRequestPanel({
  presetId,
}: {
  presetId?: string;
}) {
  const { user } = useAuth();
  const { supplierRequests, refresh } = useAvtoPrice();
  const canCreate = canCreateSupplier(user);
  const canRequest = canRequestSupplier(user);
  const initialPreset = presetById(presetId ?? "");
  const [name, setName] = useState(initialPreset?.name ?? "");
  const [comment, setComment] = useState("");
  const [chosenPreset, setChosenPreset] = useState(initialPreset?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = useMemo(
    () => supplierRequests.filter((item) => item.status === "pending"),
    [supplierRequests],
  );
  const archive = useMemo(
    () => supplierRequests.filter((item) => item.status !== "pending").slice(0, 12),
    [supplierRequests],
  );

  async function submit() {
    const preset = presetById(chosenPreset);
    const title = name.trim() || preset?.name || "";
    if (!title) {
      toast.error("Укажите название или карточку из списка");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("name", title);
      form.set("comment", comment.trim());
      if (preset) form.set("presetId", preset.id);
      const file = fileRef.current?.files?.[0];
      if (file) form.set("file", file);
      const response = await fetch("/api/supplier-requests", { method: "POST", body: form });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не отправить запрос");
      toast.success(`Запрос «${title}» отправлен администратору`);
      setName("");
      setComment("");
      setChosenPreset("");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не отправить");
    } finally {
      setBusy(false);
    }
  }

  async function review(item: SupplierRequest, action: "approve" | "reject") {
    const note = (rejectNote[item.id] ?? "").trim();
    if (action === "reject" && !note) {
      toast.error("Напишите причину отклонения");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/supplier-requests/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok && response.status !== 207) throw new Error(data.error || "Не разобрать");
      if (data.error) toast.error(data.error);
      else toast.success(action === "approve" ? `«${item.name}» добавлен` : `«${item.name}» отклонён`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не разобрать запрос");
    } finally {
      setBusy(false);
    }
  }

  if (!canRequest && !canCreate) return null;

  return (
    <div className="grid gap-6">
      {canRequest ? (
        <Card>
          <CardHeader>
            <CardTitle>Запросить поставщика</CardTitle>
            <CardDescription>
              Организации и менеджеры не заводят карточки сами. Напишите, кого добавить — администратор
              подтвердит и поставщик появится в справочнике.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Карточка из списка</Label>
              <SearchPick
                value={chosenPreset}
                onChange={(id) => {
                  setChosenPreset(id);
                  const preset = presetById(id);
                  if (preset && !name.trim()) setName(preset.name);
                }}
                placeholder="Не обязательно — можно своё имя"
                emptyLabel="Без карточки, своё имя"
                options={SUPPLIER_PRESETS.map((item) => ({
                  id: item.id,
                  label: item.name,
                  logo: item.logoUrl,
                }))}
              />
            </div>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Название, если не из списка"
            />
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Комментарий: город, логин кабинета, как приходит прайс"
              rows={3}
            />
            <input ref={fileRef} type="file" className="text-sm" />
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? "Отправляю…" : "Отправить запрос"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{canCreate ? "Запросы на поставщиков" : "Мои запросы"}</CardTitle>
          <CardDescription>
            {canCreate
              ? "Одобрение создаёт карточку из пресета или файла. Отклонение — с комментарием."
              : "Статус смотрит администратор. Пока запрос открыт, карточку в справочник не ставим."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {pending.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground">
              Открытых запросов нет.
            </p>
          ) : (
            pending.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-lg border px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.name}</p>
                  <Badge variant="secondary">ожидает</Badge>
                  {item.presetId ? <Badge variant="outline">пресет</Badge> : <Badge variant="outline">своё имя</Badge>}
                  {item.fileName ? <Badge variant="outline">{item.fileName}</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.requestedByName} · {item.requestedByEmail} · {formatDateTime(item.createdAt)}
                </p>
                {item.comment ? <p className="text-sm">{item.comment}</p> : null}
                {canCreate ? (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <Input
                      value={rejectNote[item.id] ?? ""}
                      onChange={(event) =>
                        setRejectNote((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                      placeholder="Комментарий при отклонении"
                    />
                    <Button size="sm" disabled={busy} onClick={() => void review(item, "approve")}>
                      Одобрить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void review(item, "reject")}
                    >
                      Отклонить
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {archive.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">Разобранные</p>
              {archive.map((item) => (
                <p key={item.id} className="text-sm">
                  <Badge variant={item.status === "approved" ? "secondary" : "outline"}>
                    {item.status === "approved" ? "добавлен" : "отклонён"}
                  </Badge>{" "}
                  {item.name}
                  {item.adminNote ? ` — ${item.adminNote}` : ""}
                </p>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
