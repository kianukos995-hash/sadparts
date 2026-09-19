"use client";

import { cn } from "@/lib/utils";
import { logoForSupplier } from "@/lib/supplier-presets";
import type { Supplier } from "@/lib/types";

export function SupplierLogo({
  supplier,
  src,
  name,
  size = "md",
  className,
}: {
  supplier?: Pick<Supplier, "logoUrl" | "presetId" | "name" | "code">;
  src?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const url = src || (supplier ? logoForSupplier(supplier) : "");
  const label = name || supplier?.name || "?";
  const initial = label.trim().slice(0, 1).toUpperCase() || "?";
  const box =
    size === "lg" ? "size-12 text-base" : size === "sm" ? "size-7 text-[11px]" : "size-9 text-sm";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- локальные логотипы из /public
      <img
        src={url}
        alt=""
        className={cn("rounded-lg border bg-white object-contain", box, className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg border bg-muted font-semibold text-muted-foreground",
        box,
        className,
      )}
    >
      {initial}
    </span>
  );
}
