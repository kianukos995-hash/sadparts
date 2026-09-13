"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import type { Client } from "@/lib/types";

function emptyClient(): Client {
  return {
    id: crypto.randomUUID(),
    name: "",
    phone: "",
    inn: "",
    discountPercent: 0,
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

export default function ClientsPage() {
  const { ready, clients, upsertClient, removeClient } = useAvtoPrice();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Client>(emptyClient());

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю клиентов…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Скидка клиента применяется к цене с наценкой склада при сборке заказа.
          </p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyClient());
            setOpen(true);
          }}
        >
          <Plus />
          Добавить клиента
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Клиентов нет. Добавьте розницу или СТО, чтобы считать цену со скидкой.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead className="hidden md:table-cell">Телефон</TableHead>
              <TableHead className="hidden lg:table-cell">ИНН</TableHead>
              <TableHead className="text-right">Скидка</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => {
                      setDraft(client);
                      setOpen(true);
                    }}
                  >
                    {client.name}
                  </button>
                  {client.notes ? (
                    <p className="text-xs text-muted-foreground">{client.notes}</p>
                  ) : null}
                </TableCell>
                <TableCell className="hidden md:table-cell">{client.phone || "—"}</TableCell>
                <TableCell className="hidden font-mono text-xs lg:table-cell">
                  {client.inn || "—"}
                </TableCell>
                <TableCell className="text-right">{client.discountPercent}%</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (confirm(`Удалить «${client.name}»?`)) void removeClient(client.id);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.createdAt && clients.some((item) => item.id === draft.id) ? "Клиент" : "Новый клиент"}</DialogTitle>
            <DialogDescription>
              Скидка вычитается после наценки: 1000 ₽, наценка 18%, скидка 8% → 1085.60 ₽.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Название">
              <Input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="СТО Север"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Телефон">
                <Input
                  value={draft.phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </Field>
              <Field label="ИНН">
                <Input
                  value={draft.inn}
                  onChange={(event) => setDraft((prev) => ({ ...prev, inn: event.target.value }))}
                />
              </Field>
            </div>
            <Field label="Скидка, %">
              <Input
                type="number"
                min={0}
                max={90}
                value={draft.discountPercent}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    discountPercent: Math.max(0, Number.parseFloat(event.target.value) || 0),
                  }))
                }
              />
            </Field>
            <Field label="Комментарий">
              <Textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              disabled={draft.name.trim().length < 2}
              onClick={() => {
                void upsertClient({ ...draft, name: draft.name.trim() }).then(() => {
                  toast.success("Клиент сохранён");
                  setOpen(false);
                });
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
