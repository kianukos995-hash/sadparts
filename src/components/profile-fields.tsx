"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import type { PriceView, PublicUser } from "@/lib/types";

export function ProfileFields({
  showCar = true,
  showPriceView = true,
}: {
  showCar?: boolean;
  showPriceView?: boolean;
}) {
  const { user, refresh } = useAuth();
  const [draft, setDraft] = useState({
    name: user?.name ?? "",
    fio: user?.fio ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    carMake: user?.carMake ?? "",
    carModel: user?.carModel ?? "",
    vin: user?.vin ?? "",
    plate: user?.plate ?? "",
    year: user?.year ?? "",
    color: user?.color ?? "",
    priceView: (user?.priceView ?? "clean") as PriceView,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не сохранить");
      await refresh();
      toast.success("Профиль сохранён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error || "Не загрузить фото");
    await refresh();
    toast.success("Аватар обновлён");
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border bg-muted text-lg font-semibold">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local avatar
            <img src={user.avatarUrl} alt="" className="size-16 object-cover" />
          ) : (
            (user?.fio || user?.name || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Фото</span>
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Ошибка"));
            }}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ФИО">
          <Input value={draft.fio} onChange={(event) => setDraft({ ...draft, fio: event.target.value })} />
        </Field>
        <Field label="Отображаемое имя">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field label="Телефон">
          <Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={draft.email}
            disabled={user?.role === "guest"}
            onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          />
        </Field>
      </div>
      {showCar ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Марка">
            <Input value={draft.carMake} onChange={(event) => setDraft({ ...draft, carMake: event.target.value })} />
          </Field>
          <Field label="Модель">
            <Input value={draft.carModel} onChange={(event) => setDraft({ ...draft, carModel: event.target.value })} />
          </Field>
          <Field label="VIN">
            <Input value={draft.vin} onChange={(event) => setDraft({ ...draft, vin: event.target.value })} />
          </Field>
          <Field label="Госномер">
            <Input value={draft.plate} onChange={(event) => setDraft({ ...draft, plate: event.target.value })} />
          </Field>
          <Field label="Год">
            <Input value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} />
          </Field>
          <Field label="Цвет">
            <Input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
          </Field>
        </div>
      ) : null}
      {showPriceView && user?.role !== "admin" ? (
        <Field label="Как показывать цену">
          <select
            className="h-9 rounded-lg border bg-transparent px-3 text-sm"
            value={draft.priceView}
            onChange={(event) => setDraft({ ...draft, priceView: event.target.value as PriceView })}
          >
            <option value="clean">Своя цена продажи</option>
            <option value="retail">Розница − скидка = цена</option>
          </select>
        </Field>
      ) : null}
      <Button disabled={busy} onClick={() => void save()}>
        Сохранить профиль
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

export function userInitials(user?: PublicUser | null) {
  return (user?.fio || user?.name || "?").slice(0, 1).toUpperCase();
}
