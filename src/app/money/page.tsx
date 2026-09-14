import { Suspense } from "react";
import { MoneyDesk } from "@/components/money-desk";
import { RoleGate } from "@/components/role-gate";

export default function MoneyPage() {
  return (
    <RoleGate allow={["admin", "organization"]}>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Загружаю кассу…</p>}>
        <MoneyDesk />
      </Suspense>
    </RoleGate>
  );
}
