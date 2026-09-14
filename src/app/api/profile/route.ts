import { fail, jsonUser, requireUser } from "@/lib/session";
import { updateProfile } from "@/lib/auth-store";
import { readStore, upsertClient } from "@/lib/server-store";
import type { PriceView } from "@/lib/types";

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      fio?: string;
      phone?: string;
      carMake?: string;
      carModel?: string;
      vin?: string;
      plate?: string;
      year?: string;
      color?: string;
      priceView?: PriceView;
    };
    const next = await updateProfile(user.id, body);
    if (next.clientId) {
      const store = await readStore();
      const client = store.clients.find((item) => item.id === next.clientId);
      if (client) {
        const car =
          [next.carMake ?? client.carMake, next.carModel ?? client.carModel]
            .filter(Boolean)
            .join(" ")
            .trim() || client.car;
        await upsertClient({
          ...client,
          name: next.fio || next.name || client.name,
          fio: next.fio ?? client.fio,
          phone: next.phone ?? client.phone,
          email: next.email || client.email,
          carMake: next.carMake ?? client.carMake,
          carModel: next.carModel ?? client.carModel,
          car,
          vin: next.vin ?? client.vin,
          plate: next.plate ?? client.plate,
          year: next.year ?? client.year,
          color: next.color ?? client.color,
          priceView: next.priceView ?? client.priceView,
        });
      }
    }
    return jsonUser(next);
  } catch (error) {
    return fail(error);
  }
}
