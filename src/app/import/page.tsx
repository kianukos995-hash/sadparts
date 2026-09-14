"use client";

import { ImportWizard } from "@/components/import-wizard";
import { ImportHistoryCard } from "@/components/import-history";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { SuppliersGate } from "@/components/suppliers-gate";
import { canEditSupplier } from "@/lib/suppliers-scope";

export default function ImportPage() {
  return (
    <SuppliersGate>
      <ImportInner />
    </SuppliersGate>
  );
}

function ImportInner() {
  const { user } = useAuth();
  const { ready, suppliers, organizations } = useAvtoPrice();
  const editable = suppliers.filter((item) => canEditSupplier(item, user, organizations));

  if (!ready) return <p className="text-sm text-muted-foreground">Готовлю загрузку…</p>;

  if (editable.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold">Сначала добавьте своего поставщика</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Прайс пишется только в своего поставщика. Предложенные администратором нельзя перезаписывать.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Добавить прайс</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Сначала быстрый просмотр и имя прайса — потом запись. Ошибки в CSV/ZIP не рвут загрузку.
          Новый прайс можно откатить из истории.
        </p>
      </div>
      <ImportWizard />
      <ImportHistoryCard />
    </div>
  );
}
