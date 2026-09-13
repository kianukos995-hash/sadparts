"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OfferMedia } from "@/components/offer-media";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { specFieldsFor } from "@/lib/nomenclature-fields";
import type { Offer } from "@/lib/types";

export function NomenclatureEdit({
  offer,
  open,
  onOpenChange,
  onSaved,
}: {
  offer: Offer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (offer: Offer) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {offer ? (
          <EditForm
            key={offer.id}
            offer={offer}
            onDone={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  offer,
  onDone,
  onSaved,
}: {
  offer: Offer;
  onDone: () => void;
  onSaved?: (offer: Offer) => void;
}) {
  const { patchOffer } = useAvtoPrice();
  const [name, setName] = useState(offer.name);
  const [brand, setBrand] = useState(offer.brand);
  const [oem, setOem] = useState(offer.oem);
  const [category, setCategory] = useState(offer.category);
  const [displayName, setDisplayName] = useState(offer.displayName ?? "");
  const [cars, setCars] = useState(offer.applicability ?? "");
  const [notes, setNotes] = useState(offer.notes ?? "");
  const [cross, setCross] = useState((offer.crossOems ?? []).join(", "));
  const [images, setImages] = useState(offer.images ?? []);
  const [specs, setSpecs] = useState<Record<string, string>>({ ...(offer.specs ?? {}) });
  const [busy, setBusy] = useState(false);
  const extra = specFieldsFor(name || offer.name, category || offer.category);

  function setSpec(key: string, value: string) {
    setSpecs((current) => ({ ...current, [key]: value }));
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("offerId", offer.id);
      body.set("supplierId", offer.supplierId);
      body.set("images", JSON.stringify(images));
      const response = await fetch("/api/catalog/photo", { method: "POST", body });
      const data = (await response.json()) as { error?: string; url?: string; images?: string[] };
      if (!response.ok) throw new Error(data.error || "Не загрузить фото");
      setImages(data.images ?? [...images, data.url ?? ""]);
      toast.success("Фото загружено");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Ошибка фото");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Карточка {offer.sku}</DialogTitle>
        <DialogDescription>
          Поля зависят от типа детали ({extra.label}): фото, вес, габариты, материал и узловые
          характеристики. Патч переживает повторный импорт прайса.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <OfferMedia images={images} sku={offer.sku} size="md" />
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Загрузить фото</span>
            <Input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void uploadPhoto(file);
              }}
            />
          </label>
        </div>
        <label className="grid gap-1.5">
          <Label>Наименование</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <Label>Название для заказа</Label>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <Label>Бренд</Label>
            <Input value={brand} onChange={(event) => setBrand(event.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <Label>Категория</Label>
            <Input value={category} onChange={(event) => setCategory(event.target.value)} />
          </label>
        </div>
        <label className="grid gap-1.5">
          <Label>OEM</Label>
          <Input value={oem} onChange={(event) => setOem(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <Label>Кросс-OEM</Label>
          <Input value={cross} onChange={(event) => setCross(event.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <Label>Применимость</Label>
          <Input
            value={cars}
            onChange={(event) => setCars(event.target.value)}
            placeholder="марка, модель, годы"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-xs font-medium text-muted-foreground sm:col-span-2">
            Характеристики · {extra.label}
          </p>
          {extra.fields.map((field) => (
            <label key={field.key} className="grid gap-1.5">
              <Label>{field.key}</Label>
              <Input
                placeholder={field.placeholder}
                value={specs[field.key] ?? ""}
                onChange={(event) => setSpec(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="grid gap-1.5">
          <Label>Заметка</Label>
          <Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onDone}>
          Отмена
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            const nextSpecs = { ...specs };
            for (const [key, value] of Object.entries(nextSpecs)) {
              if (!value.trim()) delete nextSpecs[key];
            }
            const patch = {
              name: name.trim() || offer.name,
              brand: brand.trim(),
              oem: oem.trim(),
              category: category.trim(),
              displayName: displayName.trim(),
              applicability: cars,
              notes,
              specs: nextSpecs,
              images,
              crossOems: cross
                .split(/[;,]/)
                .map((item) => item.trim())
                .filter(Boolean),
            };
            void patchOffer(offer.id, patch, offer.supplierId)
              .then(() => {
                toast.success("Карточка сохранена");
                onSaved?.({ ...offer, ...patch });
                onDone();
              })
              .catch((error: unknown) =>
                toast.error(error instanceof Error ? error.message : "Ошибка"),
              )
              .finally(() => setBusy(false));
          }}
        >
          Сохранить
        </Button>
      </DialogFooter>
    </>
  );
}
