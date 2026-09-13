"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OfferSpecs } from "@/components/offer-specs";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import { formatMoney } from "@/lib/format";
import { specEntries } from "@/lib/specs";
import { clientSellPrice } from "@/lib/pricing";
import type { Offer } from "@/lib/types";

export default function NomenclaturePage() {
  const { ready, offers, clients, settings } = useAvtoPrice();
  const [query, setQuery] = useState("");
  const [live, setLive] = useState<Offer[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      setBusy(true);
      void fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(async (response) => {
          const data = (await response.json()) as { offers?: Offer[] };
          setLive(data.offers ?? []);
        })
        .finally(() => setBusy(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const source = live ?? offers;
  const unique = useMemo(() => {
    const map = new Map<string, Offer>();
    for (const offer of source) {
      const key = `${offer.guid || offer.sku}:${offer.brand}`;
      if (!map.has(key)) map.set(key, offer);
    }
    const q = query.trim().toLowerCase();
    return Array.from(map.values())
      .filter((offer) => {
        if (!q) return specEntries(offer.specs).length > 0 || Boolean(offer.guid);
        return (
          offer.sku.toLowerCase().includes(q) ||
          offer.name.toLowerCase().includes(q) ||
          offer.brand.toLowerCase().includes(q) ||
          (offer.guid ?? "").toLowerCase().includes(q) ||
          specEntries(offer.specs).some(([, value]) => value.toLowerCase().includes(q))
        );
      })
      .slice(0, 60);
  }, [source, query]);

  if (!ready) return <p className="text-sm text-muted-foreground">Собираю номенклатуру…</p>;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Номенклатура</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Карточки артикулов отдельно от склада: GUID, вес, применимость, ТН ВЭД, сертификаты.
          Цены считаются в каталоге, здесь — свойства позиции.
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Артикул, GUID, бренд, характеристика"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 2) setLive(null);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {busy ? "Ищу…" : `${unique.length} карточек`} · {settings.priceBands.length} коридоров ·{" "}
        {clients.length} клиентов
      </p>
      {unique.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Введите артикул из прайса — подтянутся характеристики из колонок файла.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {unique.map((offer) => {
            const sell = clientSellPrice(offer.price, settings.priceBands, settings.markupPercent);
            return (
              <article key={offer.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{offer.sku}</p>
                    <h2 className="text-base font-medium">
                      {offer.brand} · {offer.name}
                    </h2>
                    {offer.guid ? (
                      <p className="text-xs text-muted-foreground">GUID {offer.guid}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{formatMoney(sell)}</Badge>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      закуп {formatMoney(offer.price)}
                    </p>
                  </div>
                </div>
                <OfferSpecs specs={offer.specs} defaultOpen />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
