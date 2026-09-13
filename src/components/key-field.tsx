"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskKey } from "@/lib/format";

export function KeyField({
  value,
  onChange,
  placeholder = "Ключ API поставщика",
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const readOnly = !onChange;

  return (
    <div className="flex gap-2">
      <Input
        type={visible ? "text" : "password"}
        autoComplete="off"
        value={readOnly && !visible ? maskKey(value) : value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        className="font-mono"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "Скрыть ключ" : "Показать ключ"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
