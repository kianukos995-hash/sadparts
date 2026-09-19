import type {
  AppSettings,
  Client,
  Offer,
  Organization,
  PriceBand,
  PublicSettings,
  PublicUser,
  StoreSnapshot,
  Supplier,
} from "@/lib/types";
import { bandsForRole, defaultGuestBands } from "@/lib/roles";
import { clientPriceBreakdown, clientSellPrice, type PriceBreakdown } from "@/lib/pricing";
import { canSeeCost, orgAsClient } from "@/lib/scope";
import { sanitizeBands } from "@/lib/price-bands";
import { overlayMailboxSettings } from "@/lib/price-mailbox";

export type ViewerPriceContext = {
  role: PublicUser["role"];
  seeCost: boolean;
  client?: Client | null;
  org?: Organization | null;
  adminBands: PriceBand[];
  guestBands: PriceBand[];
  sellBands: PriceBand[];
  fallbackMarkup: number;
  maxMarkup?: number;
};

export function organizationOf(user: PublicUser | null | undefined, store: StoreSnapshot) {
  if (!user?.organizationId) return undefined;
  return store.organizations?.find((item) => item.id === user.organizationId);
}

export function viewerPriceContext(
  user: PublicUser | null | undefined,
  store: Pick<StoreSnapshot, "clients" | "organizations">,
  settings: Pick<AppSettings, "priceBands" | "guestPriceBands" | "managerPriceBands" | "markupPercent">,
): ViewerPriceContext {
  const org = user?.organizationId
    ? store.organizations?.find((item) => item.id === user.organizationId)
    : undefined;
  const client = user?.clientId
    ? store.clients.find((item) => item.id === user.clientId)
    : undefined;
  const sellBands = bandsForRole(
    user?.role,
    settings.priceBands,
    settings.guestPriceBands,
    settings.managerPriceBands,
    org?.priceBands,
    Boolean(org) && user?.role !== "admin",
  );
  return {
    role: user?.role ?? "guest",
    seeCost: canSeeCost(user?.role, user?.seeCost),
    client,
    org,
    adminBands: sanitizeBands(settings.priceBands),
    guestBands: settings.guestPriceBands?.length
      ? sanitizeBands(settings.guestPriceBands)
      : defaultGuestBands(),
    sellBands,
    fallbackMarkup: settings.markupPercent,
    maxMarkup: org?.maxMarkup,
  };
}

export function costBasis(buy: number, ctx: ViewerPriceContext): number {
  const viaOrg =
    ctx.org &&
    (ctx.role === "organization" ||
      ctx.role === "manager" ||
      (ctx.role === "client" && Boolean(ctx.client?.organizationId)));
  if (viaOrg && ctx.org) {
    return clientSellPrice(buy, ctx.adminBands, ctx.fallbackMarkup, orgAsClient(ctx.org));
  }
  return buy;
}

function withCaps(client: Client | null | undefined, maxMarkup?: number): Client | null | undefined {
  if (!client && maxMarkup == null) return client;
  if (!client) {
    return {
      id: "cap",
      name: "",
      phone: "",
      inn: "",
      discountPercent: 0,
      notes: "",
      createdAt: "",
      maxMarkup,
    };
  }
  return {
    ...client,
    maxMarkup: client.maxMarkup ?? maxMarkup,
  };
}

export function breakdownForViewer(
  buy: number,
  ctx: ViewerPriceContext,
  selectedClient?: Client | null,
): PriceBreakdown {
  if (ctx.role === "guest") {
    return clientPriceBreakdown(buy, ctx.guestBands, ctx.fallbackMarkup, ctx.client);
  }
  const basis = costBasis(buy, ctx);
  if (ctx.role === "client") {
    return clientPriceBreakdown(
      basis,
      ctx.sellBands,
      ctx.fallbackMarkup,
      withCaps(ctx.client, ctx.maxMarkup),
    );
  }
  const target = withCaps(selectedClient ?? ctx.client, ctx.maxMarkup);
  return clientPriceBreakdown(basis, ctx.sellBands, ctx.fallbackMarkup, target);
}

export function sellForViewer(
  buy: number,
  ctx: ViewerPriceContext,
  selectedClient?: Client | null,
) {
  return breakdownForViewer(buy, ctx, selectedClient).sell;
}

export function publicOffer(
  offer: Offer,
  ctx: ViewerPriceContext,
  selectedClient?: Client | null,
): Offer {
  const buy = offer.price;
  const sell = sellForViewer(buy, ctx, selectedClient);
  if (ctx.seeCost) {
    return {
      ...offer,
      costPrice: buy,
      sellPrice: sell,
    };
  }
  return {
    ...offer,
    price: sell,
    sellPrice: sell,
    costPrice: undefined,
    prevPrice: undefined,
    priceDelta: undefined,
  };
}

export function publicSupplier(supplier: Supplier, hideSecrets: boolean): Supplier {
  if (!hideSecrets) return supplier;
  return {
    ...supplier,
    apiKey: supplier.apiKey ? "••••" : "",
    apiKey2: supplier.apiKey2 ? "••••" : "",
  };
}

export function publicSettingsFor(
  user: PublicUser | null | undefined,
  settings: AppSettings,
  org?: Organization | null,
): PublicSettings {
  const pinned = overlayMailboxSettings(settings);
  const role = user?.role;
  const telegramConfigured = Boolean(settings.telegramToken.trim());
  const base: PublicSettings = {
    telegramConfigured,
    telegramUsername: role === "admin" ? settings.telegramUsername : "",
    telegramPolling: role === "admin" ? settings.telegramPolling : false,
    telegramTokenMasked: role === "admin" ? "" : "",
    markupPercent: 0,
    moscowHubNote: settings.moscowHubNote,
    priceBands: [],
    guestPriceBands: [],
    managerPriceBands: [],
    sellerTitle: isDeskLike(role) ? settings.sellerTitle : "",
    sellerAddress: isDeskLike(role) ? settings.sellerAddress : "",
    vatPercent: isDeskLike(role) ? settings.vatPercent : 0,
    telegramNotifyChatId: role === "admin" ? settings.telegramNotifyChatId : "",
    telegramChats: role === "admin" ? settings.telegramChats ?? [] : [],
    showAdminPricing: role === "admin",
    maxMarkup: org?.maxMarkup ?? null,
    organizationPriceBands: org?.priceBands,
    priceMailboxAddress: isDeskLike(role) ? pinned.priceMailboxAddress : "",
    priceMailboxImapHost: role === "admin" ? pinned.priceMailboxImapHost : "",
    priceMailboxImapPort: role === "admin" ? pinned.priceMailboxImapPort : 993,
    priceMailboxImapUser: role === "admin" ? pinned.priceMailboxImapUser : "",
  };
  if (role === "admin") {
    return {
      ...base,
      telegramTokenMasked: maskLike(settings.telegramToken),
      markupPercent: settings.markupPercent,
      priceBands: settings.priceBands,
      guestPriceBands: settings.guestPriceBands?.length
        ? settings.guestPriceBands
        : defaultGuestBands(),
      managerPriceBands: settings.managerPriceBands?.length
        ? settings.managerPriceBands
        : settings.priceBands,
      showAdminPricing: true,
    };
  }
  if (role === "organization" || role === "manager") {
    const bands = bandsForRole(
      role,
      settings.priceBands,
      settings.guestPriceBands,
      settings.managerPriceBands,
      org?.priceBands,
      true,
    );
    return {
      ...base,
      markupPercent: org?.markupPercent ?? settings.markupPercent,
      priceBands: bands,
      organizationPriceBands: org?.priceBands ?? bands,
      maxMarkup: org?.maxMarkup ?? null,
    };
  }
  return base;
}

function isDeskLike(role?: PublicUser["role"]) {
  return role === "admin" || role === "organization" || role === "manager";
}

function maskLike(token: string) {
  const value = token.trim();
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
