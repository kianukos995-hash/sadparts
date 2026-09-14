"use client";

import { RoleGate } from "@/components/role-gate";
import { SuppliersBoard } from "@/components/suppliers-board";

export default function ApiSuppliersPage() {
  return (
    <RoleGate allow={["admin", "organization"]}>
      <SuppliersBoard kind="api" />
    </RoleGate>
  );
}
