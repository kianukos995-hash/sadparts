import {
  applyOrgCapsToClient,
  applyOrgCapsToOrg,
  orgAllowsClientKeys,
  orgKeyStatus,
} from "../src/lib/org-policy";
import type { Client, Organization } from "../src/lib/types";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

function org(partial: Partial<Organization> & Pick<Organization, "id" | "name">): Organization {
  return {
    id: partial.id,
    name: partial.name,
    inn: "",
    phone: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "usr-admin",
    discountPercent: partial.discountPercent ?? 5,
    markupPercent: partial.markupPercent ?? 20,
    maxMarkup: partial.maxMarkup,
    maxDiscountPercent: partial.maxDiscountPercent,
    accessKey: partial.accessKey,
    adminControlsClients: partial.adminControlsClients,
    priceBands: partial.priceBands,
  };
}

function client(partial: Partial<Client> & Pick<Client, "id" | "name" | "organizationId">): Client {
  return {
    id: partial.id,
    name: partial.name,
    phone: "",
    inn: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    discountPercent: partial.discountPercent ?? 12,
    markupPercent: partial.markupPercent ?? 40,
    maxMarkup: partial.maxMarkup,
    organizationId: partial.organizationId,
    bandMarkups: partial.bandMarkups,
  };
}

function main() {
  const cabinet = org({
    id: "org-1",
    name: "Кабинет",
    accessKey: "SP-ORG-1",
    maxMarkup: 18,
    maxDiscountPercent: 8,
    markupPercent: 25,
    discountPercent: 12,
    priceBands: [{ id: "b1", min: 0, max: null, markupPercent: 30 }],
  });
  const cappedOrg = applyOrgCapsToOrg(cabinet);
  assert(cappedOrg.markupPercent === 18, "наценка организации режется потолком");
  assert(cappedOrg.discountPercent === 12, "скидка организации задаётся админом и не режется потолком клиентов");
  assert(cappedOrg.priceBands?.[0].markupPercent === 18, "коридоры организации режутся потолком");

  const sto = client({
    id: "cli-1",
    name: "СТО",
    organizationId: "org-1",
    discountPercent: 20,
    markupPercent: 40,
    maxMarkup: 50,
    bandMarkups: { b1: 33 },
  });
  const cappedClient = applyOrgCapsToClient(sto, cappedOrg);
  assert(cappedClient.markupPercent === 18, "наценка клиента не выше потолка организации");
  assert(cappedClient.discountPercent === 8, "скидка клиента не выше потолка организации");
  assert(cappedClient.maxMarkup === 18, "потолок клиента не выше организации");
  assert(cappedClient.bandMarkups?.b1 === 18, "коридоры клиента режутся");

  const stranger = applyOrgCapsToClient({ ...sto, organizationId: "org-other" }, cappedOrg);
  assert(stranger.markupPercent === 40, "чужой клиент не трогается");

  assert(orgAllowsClientKeys(cabinet), "с ключом организация выдаёт доступ");
  assert(!orgAllowsClientKeys({ ...cabinet, adminControlsClients: true }), "после отзыва ключ не выдаёт");
  assert(orgKeyStatus({ ...cabinet, adminControlsClients: true }) === "taken", "статус ключ забран");
  assert(orgKeyStatus(cabinet) === "active", "статус ключ выдан");
  assert(orgKeyStatus(org({ id: "x", name: "x" })) === "none", "статус ключ не выдан");
  console.log("org-policy-check ok");
}

main();
