"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { invoiceTitle, rublesInWords } from "@/lib/money-words";
import { includedVat, lineCaption, priceOrder } from "@/lib/order-price";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function OrderPrintInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { ready, orders, clients, settings } = useAvtoPrice();
  const order = orders.find((item) => item.id === params.id);
  const from = searchParams.get("from") || "";

  if (!ready) return <p className="p-8 text-sm">Готовлю накладную…</p>;
  if (!order) return <p className="p-8 text-sm">Заказ не найден.</p>;

  const client = clients.find((item) => item.id === order.clientId);
  const priced = priceOrder(order, client, settings.priceBands, order.markupPercent || settings.markupPercent);
  const vat = includedVat(priced.totals.sell, settings.vatPercent ?? 0);
  const paid = order.paidAmount ?? 0;
  const rest = Math.max(0, priced.totals.sell - paid);
  const sumText = priced.totals.sell.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const backHref =
    from || (order.status === "draft" ? `/cart?id=${order.id}` : `/orders/${order.id}`);

  function goBack() {
    if (from) {
      router.push(from);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  }

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
      <style>{`
        @media print {
          body { background: white !important; }
          nav, header, aside, [data-app-shell] { display: none !important; }
        }
      `}</style>
      <div className="mb-4 flex items-start justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-black")}
            onClick={goBack}
          >
            Назад
          </button>
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-black")}
          >
            К заказу {order.number}
          </Link>
        </div>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => window.print()}
        >
          Печать
        </button>
      </div>
      <p className="text-xs font-semibold">{settings.sellerTitle || "SadParts"}</p>
      <p className="mb-4 text-xs font-semibold whitespace-pre-wrap">{settings.sellerAddress}</p>
      <h1 className="mb-4 text-xl font-bold">{invoiceTitle(order.number, order.createdAt)}</h1>
      <table className="mb-4 w-full text-sm">
        <tbody>
          <tr>
            <td className="w-32 py-0.5">Заказчик:</td>
            <td>{client?.name || "—"}</td>
          </tr>
          <tr>
            <td className="py-0.5">Телефон:</td>
            <td>{client?.phone || ""}</td>
          </tr>
          <tr>
            <td className="py-0.5">Автомобиль:</td>
            <td>
              {order.car || client?.car || ""}
              {order.vin || client?.vin ? ` · VIN ${order.vin || client?.vin}` : ""}
            </td>
          </tr>
          <tr>
            <td className="py-0.5">Год / номер:</td>
            <td>
              {order.year || client?.year || ""} {(order.plate || client?.plate) ?? ""}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mb-2 text-sm font-semibold">Запасные части и материалы</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border px-2 py-1 text-left">Номер</th>
            <th className="border px-2 py-1 text-left">Наименование</th>
            <th className="border px-2 py-1 text-right">Кол-во</th>
            <th className="border px-2 py-1"> </th>
            <th className="border px-2 py-1 text-right">Цена</th>
            <th className="border px-2 py-1 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {priced.lines.map((line) => (
            <tr key={line.id}>
              <td className="border px-2 py-1 font-mono">{line.sku}</td>
              <td className="border px-2 py-1">{lineCaption(line)}</td>
              <td className="border px-2 py-1 text-right">{line.qty}</td>
              <td className="border px-2 py-1 text-center">шт</td>
              <td className="border px-2 py-1 text-right">{line.sell.toFixed(2)}</td>
              <td className="border px-2 py-1 text-right">{line.sum.toFixed(2)}</td>
            </tr>
          ))}
          <tr>
            <td className="border px-2 py-1" colSpan={2}>
              Итого:
            </td>
            <td className="border px-2 py-1 text-right">{priced.totals.qty}</td>
            <td className="border px-2 py-1" />
            <td className="border px-2 py-1" />
            <td className="border px-2 py-1 text-right font-semibold">{sumText}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 grid gap-1 text-sm">
        <p>
          Итого: <b>{sumText}</b>
        </p>
        <p>
          {(settings.vatPercent ?? 0) > 0 ? "В том числе НДС:" : "НДС не облагается:"}{" "}
          {vat.toFixed(2)}
        </p>
        <p>Сумма оплаты: {paid.toFixed(2)}</p>
        <p>Остаток к оплате: {rest.toFixed(2)}</p>
        <p className="mt-2">
          Всего наименований {priced.lines.length}, на сумму {sumText}
        </p>
        <p className="font-medium">{rublesInWords(priced.totals.sell)}</p>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <p>Отпустил: ________________</p>
        <p>Получил: ________________</p>
      </div>
    </div>
  );
}

export default function OrderPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">Готовлю накладную…</p>}>
      <OrderPrintInner />
    </Suspense>
  );
}
