"use client";

import { SuppliersGate } from "@/components/suppliers-gate";
import { SuppliersBoard } from "@/components/suppliers-board";

export default function FileSuppliersPage() {
  return (
    <SuppliersGate>
      <SuppliersBoard kind="file" />
    </SuppliersGate>
  );
}
