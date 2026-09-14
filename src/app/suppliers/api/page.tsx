"use client";

import { SuppliersGate } from "@/components/suppliers-gate";
import { SuppliersBoard } from "@/components/suppliers-board";

export default function ApiSuppliersPage() {
  return (
    <SuppliersGate>
      <SuppliersBoard kind="api" />
    </SuppliersGate>
  );
}
