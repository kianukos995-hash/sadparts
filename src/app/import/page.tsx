"use client";

import { ImportWizard } from "@/components/import-wizard";
import { useAvtoPrice } from "@/hooks/use-avtoprice";

export default function ImportPage() {
  const { ready, suppliers } = useAvtoPrice();

  if (!ready) return <p className="text-sm text-muted-foreground">Готовлю загрузку…</p>;

  if (suppliers.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold">Сначала добавьте поставщика</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Прайс привязывается к поставщику, даже если это просто файл с диска.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Загрузка прайс-листа</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Подставьте файл вместо API или догрузите позиции к уже существующему поставщику. Текущий
          прайс этого поставщика будет заменён.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
