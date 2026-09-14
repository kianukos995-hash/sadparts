import { ownerLabel, ownerFromUnknown, normalizeAccessKey, keyNeedsCar } from "../src/lib/access-keys";
import { canEditAccessKey, visibleAccessKeys } from "../src/lib/scope";
import type { AccessKeyRecord, PublicUser } from "../src/lib/types";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

function user(partial: Partial<PublicUser> & Pick<PublicUser, "id" | "role">): PublicUser {
  return {
    email: `${partial.id}@sadparts.local`,
    name: partial.id,
    status: "active",
    ...partial,
  };
}

function main() {
  assert(normalizeAccessKey(" sp-key-demo1 ") === "SP-KEY-DEMO1", "нормализация ключа");
  assert(ownerLabel({ fio: "Клюева Дарья", phone: "+7 495 000-11-22" }).includes("Клюева"), "подпись владельца");
  assert(ownerLabel({}).includes("без владельца"), "пустой владелец");
  assert(keyNeedsCar("client") && keyNeedsCar("guest") && !keyNeedsCar("manager"), "авто только клиенту и гостю");
  const parsed = ownerFromUnknown({ fio: " Иван ", extra: 1, phone: 12 });
  assert(parsed.fio === "Иван" && parsed.phone === "", "разбор владельца без лишних полей");

  const admin = user({ id: "usr-admin", role: "admin" });
  const org = user({ id: "usr-org", role: "organization", organizationId: "org-1" });
  const manager = user({ id: "usr-mgr", role: "manager", organizationId: "org-1" });
  const client = user({ id: "usr-cli", role: "client" });

  const adminKey: AccessKeyRecord = {
    id: "k1",
    key: "SP-ADMIN-1",
    role: "client",
    status: "active",
    issuedByUserId: "usr-admin",
    issuedByRole: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const orgKey: AccessKeyRecord = {
    ...adminKey,
    id: "k2",
    key: "SP-ORG-1",
    issuedByUserId: "usr-org",
    issuedByRole: "organization",
    organizationId: "org-1",
  };
  const mgrKey: AccessKeyRecord = {
    ...orgKey,
    id: "k3",
    key: "SP-MGR-1",
    issuedByUserId: "usr-mgr",
    issuedByRole: "manager",
  };

  assert(canEditAccessKey(admin, adminKey) && canEditAccessKey(admin, mgrKey), "админ правит все ключи");
  assert(canEditAccessKey(org, orgKey) && canEditAccessKey(org, mgrKey) && !canEditAccessKey(org, adminKey), "орг — только свои");
  assert(canEditAccessKey(manager, mgrKey) && !canEditAccessKey(manager, orgKey) && !canEditAccessKey(manager, adminKey), "менеджер — только выданные им");
  assert(!canEditAccessKey(client, mgrKey), "клиент ключи не правит");

  const visibleMgr = visibleAccessKeys(manager, [adminKey, orgKey, mgrKey]);
  assert(visibleMgr.length === 1 && visibleMgr[0].id === "k3", "менеджер не видит ключи админа");
  const visibleOrg = visibleAccessKeys(org, [adminKey, orgKey, mgrKey]);
  assert(visibleOrg.length === 2 && !visibleOrg.some((item) => item.id === "k1"), "орг не видит ключ админа");

  console.log("key-login-check: ok");
}

main();
