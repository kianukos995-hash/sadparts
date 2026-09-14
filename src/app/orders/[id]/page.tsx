"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { OrderEditor } from "@/components/order-editor";
import { OrderActionsSidebar } from "@/components/order-actions";
import { RosskoCheckout } from "@/components/rossko-checkout";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { cn } from "@/lib/utils";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { ready, orders } = useAvtoPrice();
  const order = orders.find((item) => item.id === params.id);

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю заказ…</p>;
  if (!order) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 py-10">
        <p className="text-sm text-muted-foreground">Заказ не найден.</p>
        <Link href="/orders" className={cn(buttonVariants({ variant: "outline" }))}>
          К списку заказов
        </Link>
      </div>
    );
  }

  const listHref = order.status === "draft" ? "/cart" : "/orders";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => router.push(listHref)}>
          Назад
        </Button>
        <Link href={listHref} className="text-sm text-muted-foreground hover:underline">
          {order.status === "draft" ? "Корзина" : "Список заказов"}
        </Link>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="grid gap-4">
          <OrderEditor
            order={order}
            listHref={listHref}
            onAssembled={() => router.push(`/orders/${order.id}`)}
            onDeleted={() => router.push(listHref)}
            onReturnedToCart={() => router.push(`/cart?id=${order.id}`)}
          />
          <RosskoCheckout order={order} />
        </div>
        <OrderActionsSidebar
          order={order}
          onPosted={() => router.push(`/orders/${order.id}`)}
          onSaved={(next) =>
            router.push(next.status === "draft" ? `/cart?id=${next.id}` : `/orders/${next.id}`)
          }
        />
      </div>
    </div>
  );
}
