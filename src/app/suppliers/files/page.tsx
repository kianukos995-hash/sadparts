"use client";

import { RoleGate } from "@/components/role-gate";
import { SuppliersBoard } from "@/components/suppliers-board";

export default function FileSuppliersPage() {
  return (
    <RoleGate allow={["admin", "organization"]}>
      <SuppliersBoard kind="file" />
    </RoleGate>
  );
}
