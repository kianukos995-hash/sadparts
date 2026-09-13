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
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import type { Offer } from "@/lib/types";

export function NomenclatureEdit({
  offer,
  open,
  onOpenChange,
}: {
  offer: Offer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {offer ? (
          <EditForm key={offer.id} offer={offer} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  const { patchOffer } = useAvtoPrice();
  const [name, setName] = useState(offer.name);
  const [brand, setBrand] = useState(offer.brand);
  const [oem, setOem] = useState(offer.oem);
  const [category, setCategory] = useState(offer.category);
  const [displayName, setDisplayName] = useState(offer.displayName ?? "");
  const [cars, setCars] = useState(offer.applicability ?? "");
  const [notes, setNotes] = useState(offer.notes ?? "");
  const [cross, setCross] = useState((offer.crossOems ?? []).join(", "));
  const [busy, setBusy] = useState(false);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Редактировать {offer.sku}</DialogTitle>
        <DialogDescription>Изменения пишутся в прайс и сохраняются при повторном импорте как патч.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
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
          <Input value={cars} onChange={(event) => setCars(event.target.value)} />
        </label>
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
            void patchOffer(
              offer.id,
              {
                name: name.trim() || offer.name,
                brand: brand.trim(),
                oem: oem.trim(),
                category: category.trim(),
                displayName: displayName.trim(),
                applicability: cars,
                notes,
                crossOems: cross
                  .split(/[;,]/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              },
              offer.supplierId,
            )
              .then(() => {
                toast.success("Карточка сохранена");
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
