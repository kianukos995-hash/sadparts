"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchPick({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  className,
  onCreate,
  createLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  options: { id: string; label: string; logo?: string }[];
  placeholder: string;
  emptyLabel?: string;
  className?: string;
  onCreate?: (label: string) => void;
  createLabel?: (query: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = options.find((item) => item.id === value);
  const shown = options
    .filter((item) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return item.label.toLowerCase().includes(needle);
    })
    .slice(0, 80);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        placeholder={placeholder}
        value={open ? q : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(event) => {
          setQ(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
      />
      {open ? (
        <ul className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-background shadow-md">
          {emptyLabel ? (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange("");
                  setOpen(false);
                }}
              >
                {emptyLabel}
              </button>
            </li>
          ) : null}
          {shown.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                  item.id === value && "bg-muted",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                {item.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- логотип поставщика
                  <img src={item.logo} alt="" className="size-6 shrink-0 rounded border bg-white object-contain" />
                ) : null}
                {item.label}
              </button>
            </li>
          ))}
          {onCreate && q.trim() && !options.some((item) => item.label.toLowerCase() === q.trim().toLowerCase()) ? (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onCreate(q.trim());
                  setOpen(false);
                }}
              >
                {createLabel ? createLabel(q.trim()) : `Добавить «${q.trim()}»`}
              </button>
            </li>
          ) : null}
          {shown.length === 0 && !(onCreate && q.trim()) ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">Нет совпадений</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
