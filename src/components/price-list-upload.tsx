"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { compactColumnMap } from "@/lib/mapping";
import { guessPriceTitle } from "@/lib/price-bands";
import type { ImportMode, Supplier } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT =
  ".csv,.tsv,.txt,.xlsx,.xls,.xml,.zip,.json,.yml,text/csv,application/json,application/xml,application/zip";

type ImportResult = {
  imported?: number;
  skipped?: number;
  error?: string;
  label?: string;
  fileName?: string;
  bytes?: number;
  mapNote?: string;
  warnings?: string[];
};

export function PriceListUpload({
  supplier,
  variant = "button",
  onImported,
}: {
  supplier: Supplier;
  variant?: "button" | "dropzone";
  onImported?: (result: { imported: number; fileName: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useAvtoPrice();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<ImportMode>("replace");

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("action", "import");
      form.set("file", file);
      form.set("supplierId", supplier.id);
      form.set("mode", mode);
      form.set("label", guessPriceTitle(file.name));
      const custom = compactColumnMap(supplier.columnMap);
      if (Object.keys(custom).length) form.set("columnMap", JSON.stringify(custom));
      const response = await fetch("/api/catalog/import", { method: "POST", body: form });
      const data = (await response.json()) as ImportResult;
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить прайс");
      await refresh();
      const imported = data.imported ?? 0;
      toast.success(
        `«${supplier.name}»: ${imported.toLocaleString("ru-RU")} позиций из ${file.name}` +
          (data.skipped ? ` · без артикула ${data.skipped}` : ""),
      );
      if (data.mapNote) toast.message(`Ключи колонок: ${data.mapNote}`);
      onImported?.({ imported, fileName: file.name });
      if (variant === "button") router.push(`/suppliers/${supplier.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Файл не загрузился");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        void upload(file);
      }}
    />
  );

  if (variant === "button") {
    return (
      <span className="inline-flex">
        {picker}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          <Upload className={busy ? "animate-pulse" : ""} />
          {busy ? "Загружаю…" : "Добавить прайс"}
        </Button>
      </span>
    );
  }

  return (
    <div className="grid gap-3">
      {picker}
      <button
        type="button"
        disabled={busy}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center hover:bg-muted/40",
          busy && "pointer-events-none opacity-70",
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void upload(event.dataTransfer.files?.[0]);
        }}
      >
        <Upload className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">
          {busy ? "Читаю файл и пишу в каталог…" : "Перетащите прайс или нажмите, чтобы выбрать"}
        </span>
        <span className="text-xs text-muted-foreground">
          CSV, ZIP, XLSX, XML · файл уходит на сервер целиком, позиции появятся в карточке и проценке
        </span>
      </button>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={mode === "merge"}
          onCheckedChange={(checked) => setMode(checked === true ? "merge" : "replace")}
        />
        Добавить к текущему прайсу, не затирая остальные артикулы
      </label>
    </div>
  );
}
