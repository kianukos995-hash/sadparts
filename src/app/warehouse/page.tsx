"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";
import { emptyPurchaseLine } from "@/lib/warehouse";
import type { PurchaseLine } from "@/lib/types";

export default function WarehousePage() {
  return (
    <RoleGate allow={["admin", "organization", "manager"]}>
      <WarehouseInner />
    </RoleGate>
  );
}

function WarehouseInner() {
  const { user } = useAuth();
  const { ready, suppliers, clients, warehouseLots, warehouseDocs, createWarehouseReceipt } =
    useAvtoPrice();
  const [tab, setTab] = useState("stock");
  const [lines, setLines] = useState<PurchaseLine[]>([emptyPurchaseLine()]);
  const [supplierId, setSupplierId] = useState("");
  const [party, setParty] = useState("");

  const incoming = useMemo(
    () => warehouseDocs.filter((item) => item.kind === "in"),
    [warehouseDocs],
  );
  const outgoing = useMemo(
    () => warehouseDocs.filter((item) => item.kind === "out"),
    [warehouseDocs],
  );

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю склад…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Склад</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Два остатка не смешиваются: в проценке — «у поставщика» (каталог/API). Здесь — только
          принятый товар на своём складе. Приход увеличивает свой остаток, расход при проведении
          заказа со своего склада — уменьшает.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="flex-wrap justify-start">
          <TabsTrigger value="stock">Остатки</TabsTrigger>
          <TabsTrigger value="in">Приход</TabsTrigger>
          <TabsTrigger value="out">Расход</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          {warehouseLots.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
              Свой склад пуст. Примите товар документом прихода (из ЗП или от поставщика).
            </p>
          ) : (
            <DocTable
              headers={["Артикул", "Бренд", "Кол-во", "Склад"]}
              rows={warehouseLots.map((lot) => [
                lot.sku,
                lot.brand,
                String(lot.qty),
                lot.warehouse,
              ])}
            />
          )}
        </TabsContent>

        <TabsContent value="in" className="mt-4">
          <div className="mb-6 grid gap-3 rounded-xl border p-4">
            <p className="text-sm font-medium">Новый приход</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <Label>Поставщик</Label>
                <select
                  className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                  value={supplierId}
                  onChange={(event) => {
                    setSupplierId(event.target.value);
                    const name = suppliers.find((item) => item.id === event.target.value)?.name;
                    if (name) setParty(name);
                  }}
                >
                  <option value="">не выбран</option>
                  {suppliers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <Label>Контрагент / партия</Label>
                <Input value={party} onChange={(event) => setParty(event.target.value)} />
              </label>
            </div>
            {lines.map((line, index) => (
              <div key={line.id} className="grid gap-2 sm:grid-cols-4">
                <Input
                  placeholder="Артикул"
                  value={line.sku}
                  onChange={(event) =>
                    setLines(lines.map((item, i) => (i === index ? { ...item, sku: event.target.value } : item)))
                  }
                />
                <Input
                  placeholder="Бренд"
                  value={line.brand}
                  onChange={(event) =>
                    setLines(lines.map((item, i) => (i === index ? { ...item, brand: event.target.value } : item)))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(event) =>
                    setLines(
                      lines.map((item, i) =>
                        i === index ? { ...item, qty: Math.max(1, Number(event.target.value) || 1) } : item,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="Склад"
                  value={line.warehouse}
                  onChange={(event) =>
                    setLines(
                      lines.map((item, i) =>
                        i === index ? { ...item, warehouse: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setLines([...lines, emptyPurchaseLine()])}>
                <Plus />
                Строка
              </Button>
              <Button
                onClick={() => {
                  void createWarehouseReceipt({
                    supplierId: supplierId || undefined,
                    party: party || "поставщик",
                    lines: lines.map((line) => ({
                      sku: line.sku,
                      brand: line.brand,
                      name: line.name,
                      qty: line.qty,
                      warehouse: line.warehouse || "основной",
                    })),
                  })
                    .then(() => {
                      toast.success("Приход проведён · свой склад увеличен");
                      setLines([emptyPurchaseLine()]);
                    })
                    .catch((error: unknown) =>
                      toast.error(error instanceof Error ? error.message : "Ошибка"),
                    );
                }}
              >
                Провести приход
              </Button>
            </div>
          </div>
          <DocsList
            docs={incoming}
            partyLabel={(id) =>
              suppliers.find((item) => item.id === id)?.name || id
            }
          />
        </TabsContent>

        <TabsContent value="out" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Расход создаётся автоматически, когда заказ проводится со своего склада. Гость и клиент
            этот раздел не видят.
          </p>
          <DocsList
            docs={outgoing}
            partyLabel={(id) => clients.find((item) => item.id === id)?.name || id}
          />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Книга {user?.role === "admin" ? "администратора" : "организации"}. Чужие склады не
        показываются.
      </p>
    </div>
  );
}

function DocsList({
  docs,
  partyLabel,
}: {
  docs: ReturnType<typeof useAvtoPrice>["warehouseDocs"];
  partyLabel: (id: string) => string;
}) {
  if (docs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        Документов нет.
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      {docs.map((doc) => (
        <div key={doc.id} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {doc.number} · {doc.kind === "in" ? "приход" : "расход"}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(doc.at)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {partyLabel(doc.clientId || doc.supplierId || doc.party)}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="pr-3 font-medium">Артикул</th>
                  <th className="pr-3 font-medium">Бренд</th>
                  <th className="pr-3 text-right font-medium">Кол-во</th>
                  <th className="font-medium">Склад</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((line, index) => (
                  <tr key={`${doc.id}-${index}`}>
                    <td className="pr-3 font-mono text-xs">{line.sku}</td>
                    <td className="pr-3">{line.brand}</td>
                    <td className="pr-3 text-right">{line.qty}</td>
                    <td>{line.warehouse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
