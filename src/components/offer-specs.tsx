"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { specEntries, SPEC_LABELS } from "@/lib/specs";
import { cn } from "@/lib/utils";

export function OfferSpecs({
  specs,
  defaultOpen = false,
  compact = false,
}: {
  specs?: Record<string, string>;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  const entries = specEntries(specs);
  const [open, setOpen] = useState(defaultOpen);
  if (entries.length === 0) return null;

  return (
    <div className={cn("mt-2", compact && "mt-1")}>
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <ChevronDown className={cn("size-3.5", open && "rotate-180")} />
        Характеристики · {entries.length}
      </button>
      {open ? (
        <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-[11px] text-muted-foreground">{SPEC_LABELS[key] ?? key}</dt>
              <dd className="text-xs break-all">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
