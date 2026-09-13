"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SortDir = "asc" | "desc" | "";

export function SortToggle({
  label,
  value,
  onChange,
  ascTitle,
  descTitle,
}: {
  label?: string;
  value: SortDir;
  onChange: (value: SortDir) => void;
  ascTitle: string;
  descTitle: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {label ? <span className="text-xs whitespace-nowrap text-muted-foreground">{label}</span> : null}
      <Button
        type="button"
        size="icon-sm"
        variant={value === "asc" ? "default" : "outline"}
        title={ascTitle}
        onClick={() => onChange(value === "asc" ? "" : "asc")}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={value === "desc" ? "default" : "outline"}
        title={descTitle}
        onClick={() => onChange(value === "desc" ? "" : "desc")}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}
