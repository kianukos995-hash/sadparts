import { inspectOrderPrices, lineNeedsReprice, needsReprice } from "../src/lib/reprice";
import { createDemoOffers, createDemoSuppliers } from "../src/lib/seed";
import { createDemoRepriceOrders } from "../src/lib/demo-warehouses";
import { DEFAULT_PRICE_BANDS } from "../src/lib/price-bands";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

async function main() {
  const suppliers = createDemoSuppliers();
  const offers = createDemoOffers(suppliers);
  const warehouses = new Set(
    offers.filter((item) => item.supplierId === "sup-rossko" && item.sku === "0986424811").map((item) => item.warehouse),
  );
  assert(warehouses.size >= 6, `мало складов Росско: ${warehouses.size}`);
  const orders = createDemoRepriceOrders();
  const sto = orders.find((item) => item.id === "ord-reprice-sto")!;
  const changes = await inspectOrderPrices(sto, suppliers, offers, DEFAULT_PRICE_BANDS, 18, null);
  assert(needsReprice(changes), "демо-заказ должен требовать перепроценку");
  assert(changes.some((item) => item.missing && lineNeedsReprice(item)), "пропавший артикул");
  assert(changes.some((item) => item.stockShortage || item.offerMismatch || item.missing), "остаток или склад");
  console.log("reprice-check ok", warehouses.size, "складов на 0986424811");
}

void main();
