"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceBand } from "@/lib/types";

export function PriceBandsEditor({
  bands,
  onChange,
}: {
  bands: PriceBand[];
  onChange: (bands: PriceBand[]) => void;
}) {
  function update(index: number, patch: Partial<PriceBand>) {
    onChange(bands.map((band, i) => (i === index ? { ...band, ...patch } : band)));
  }

  return (
    <div className="grid gap-3">
      {bands.map((band, index) => (
        <div key={band.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">От, ₽</span>
            <Input
              type="number"
              min={0}
              value={band.min}
              onChange={(event) => update(index, { min: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">До, ₽</span>
            <Input
              placeholder="∞"
              type="number"
              min={0}
              value={band.max ?? ""}
              onChange={(event) =>
                update(index, {
                  max: event.target.value === "" ? null : Number(event.target.value) || 0,
                })
              }
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Наценка, %</span>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={band.markupPercent}
              onChange={(event) =>
                update(index, { markupPercent: Number.parseFloat(event.target.value) || 0 })
              }
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={bands.length < 2}
            onClick={() => onChange(bands.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        onClick={() => {
          const last = bands[bands.length - 1];
          const min = last?.max ?? (last?.min ?? 0) + 1000;
          onChange([
            ...bands,
            {
              id: `band-${Date.now()}`,
              min,
              max: null,
              markupPercent: last?.markupPercent ?? 12,
            },
          ]);
        }}
      >
        <Plus />
        Ещё коридор
      </Button>
      <p className="text-xs text-muted-foreground">
        Пример: 0–300, 300–550, 550–1000, 1000–2750, 2750+. Верхняя граница не входит в коридор.
      </p>
      <Label className="sr-only">Ценовые категории</Label>
    </div>
  );
}
