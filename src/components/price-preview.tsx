"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface PricePreview {
  title: string;
  innerName?: string;
  headers: string[];
  rows: Record<string, string>[];
  total: number;
  warnings?: string[];
}

export function PricePreviewCard({
  preview,
  label,
  onLabelChange,
  fileName,
  showTable = true,
}: {
  preview: PricePreview;
  label: string;
  onLabelChange: (value: string) => void;
  fileName: string;
  showTable?: boolean;
}) {
  const headers = preview.headers.slice(0, 10);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <Label>Название прайса</Label>
        <Input
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder={preview.title || fileName}
        />
        <p className="text-xs text-muted-foreground">
          {fileName}
          {preview.innerName && preview.innerName !== fileName ? ` → ${preview.innerName}` : ""} · ~
          {preview.total.toLocaleString("ru-RU")} строк
        </p>
      </label>
      {preview.warnings?.length ? (
        <Alert>
          <AlertTitle>Файл кривой, но читается</AlertTitle>
          <AlertDescription>{preview.warnings.slice(0, 4).join(" · ")}</AlertDescription>
        </Alert>
      ) : null}
      {showTable ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 8).map((row, index) => (
                <tr key={index} className="border-t">
                  {headers.map((header) => (
                    <td key={header} className="max-w-48 truncate px-2 py-1.5 whitespace-nowrap">
                      {row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
