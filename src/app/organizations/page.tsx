"use client";

import { RoleGate } from "@/components/role-gate";
import { OrganizationsDesk } from "@/components/organizations-desk";

export default function OrganizationsPage() {
  return (
    <RoleGate allow={["admin"]}>
      <OrganizationsDesk />
    </RoleGate>
  );
}
