"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import type { Order } from "@/lib/types";

export function RosskoCheckout({ order }: { order: Order }) {
  const { suppliers, clients, refresh } = useAvtoPrice();
  const supplier = suppliers.find((item) => item.adapter === "rossko" || item.code === "ROSSKO");
  const lines = order.lines.filter((line) => line.supplierId === supplier?.id);
  const client = clients.find((item) => item.id === order.clientId);
  const [deliveryId, setDeliveryId] = useState(supplier?.rosskoDeliveryId ?? "");
  const [paymentId, setPaymentId] = useState("1");
  const [deliveries, setDeliveries] = useState<{ id: string; name: string }[]>([]);
  const [payments, setPayments] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);

  if (!supplier || lines.length === 0) return null;
  const rossko = supplier;

  async function loadDetails() {
    setBusy(true);
    try {
      const response = await fetch("/api/rossko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "details", supplierId: rossko.id }),
      });
      const data = (await response.json()) as {
        error?: string;
        details?: { deliveries: { id: string; name: string }[]; payments: { id: number; name: string }[] };
        supplier?: { rosskoDeliveryId?: string };
      };
      if (!response.ok) throw new Error(data.error || "GetCheckoutDetails не удался");
      setDeliveries(data.details?.deliveries ?? []);
      setPayments(data.details?.payments ?? []);
      setDeliveryId(data.supplier?.rosskoDeliveryId || data.details?.deliveries[0]?.id || "");
      toast.success("Способы доставки Росско получены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const response = await fetch("/api/rossko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          supplierId: rossko.id,
          orderId: order.id,
          deliveryId,
          paymentId: Number(paymentId),
          contactName: client?.name || "Менеджер",
          contactPhone: client?.phone || "+7",
          comment: order.comment,
          deliveryParts: true,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        result?: { success: boolean; message?: string; orderIds: string[]; errors: { message: string }[] };
      };
      if (!response.ok) throw new Error(data.error || "GetCheckout не удался");
      await refresh();
      if (data.result?.success) {
        toast.success(`Росско заказ ${data.result.orderIds.join(", ")}`);
      } else {
        toast.error(data.result?.message || data.result?.errors.map((item) => item.message).join("; "));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Отправка в Росско · GetCheckout</p>
      <p className="text-xs text-muted-foreground">
        {lines.length} поз. Росско. Сначала GetCheckoutDetails (доставка/оплата), затем оформление.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <Label>Доставка</Label>
          <select
            className="h-9 rounded-lg border bg-transparent px-3 text-sm"
            value={deliveryId}
            onChange={(event) => setDeliveryId(event.target.value)}
          >
            {deliveries.length === 0 ? <option value={deliveryId}>{deliveryId || "загрузить список"}</option> : null}
            {deliveries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <Label>Оплата</Label>
          <select
            className="h-9 rounded-lg border bg-transparent px-3 text-sm"
            value={paymentId}
            onChange={(event) => setPaymentId(event.target.value)}
          >
            {payments.length === 0 ? <option value="1">Безналичный</option> : null}
            {payments.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void loadDetails()}>
          GetCheckoutDetails
        </Button>
        <Button disabled={busy || lines.length === 0} onClick={() => void send()}>
          GetCheckout
        </Button>
      </div>
      {order.externalIds?.length ? (
        <p className="text-xs text-muted-foreground">Номера Росско: {order.externalIds.join(", ")}</p>
      ) : null}
    </div>
  );
}
