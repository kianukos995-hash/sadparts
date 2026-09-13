export function getByPath(source: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) return source;
  return trimmed.split(".").reduce<unknown>((acc, segment) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[segment];
  }, source);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function richTextValue(value: unknown) {
  if (!value || typeof value !== "object" || !("richText" in value)) return "";
  const runs = (value as { richText?: unknown }).richText;
  if (!Array.isArray(runs)) return "";
  return runs
    .map((run) => {
      if (typeof run === "string") return run;
      if (run && typeof run === "object" && "text" in run) {
        return String((run as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

export function stringifyCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stringifyCell).filter(Boolean).join(" ").trim();
  if (typeof value !== "object") return String(value);
  const rich = richTextValue(value);
  if (rich) return rich.trim();
  const record = value as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  const href = typeof record.hyperlink === "string" ? record.hyperlink.trim() : "";
  if (text && href && text !== href) return `${text} ${href}`;
  if (text) return text;
  if (href) return href;
  if ("result" in record) return stringifyCell(record.result);
  return "";
}
