import { readStore } from "@/lib/server-store";
import { fail, requireUser } from "@/lib/session";
import type { StoreSnapshot, Supplier } from "@/lib/types";

function publicSupplier(supplier: Supplier, hideSecrets: boolean): Supplier {
  if (!hideSecrets) return supplier;
  return {
    ...supplier,
    apiKey: supplier.apiKey ? "••••" : "",
    apiKey2: supplier.apiKey2 ? "••••" : "",
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const store = await readStore();
    const hide = user.role === "client" || user.role === "guest";
    const next: StoreSnapshot = {
      ...store,
      suppliers: store.suppliers.map((item) => publicSupplier(item, hide)),
      moneyMovements: hide ? [] : store.moneyMovements,
      supplierBills: hide ? [] : store.supplierBills,
      orders:
        hide && user.clientId
          ? store.orders.filter((order) => order.clientId === user.clientId)
          : store.orders,
    };
    return Response.json(next);
  } catch (error) {
    return fail(error);
  }
}
