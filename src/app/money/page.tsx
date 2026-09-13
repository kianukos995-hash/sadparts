import { Suspense } from "react";
import { MoneyDesk } from "@/components/money-desk";

export default function MoneyPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загружаю кассу…</p>}>
      <MoneyDesk />
    </Suspense>
  );
}
