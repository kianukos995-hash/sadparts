import { buildSimpleEml, matchSupplierFromEmail, parseEml } from "../src/lib/email-price";
import {
  PINNED_PRICE_MAILBOX,
  mailboxSecretOk,
  overlayMailboxSettings,
  plusAliasFor,
  plusTagFromAddress,
  priceMailboxConfig,
} from "../src/lib/price-mailbox";
import { emptySupplierFromPreset, presetById, attachPresetMeta } from "../src/lib/supplier-presets";
import { DEFAULT_COLUMN_MAP, type Supplier } from "../src/lib/types";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

assert(PINNED_PRICE_MAILBOX === "prajsy@sadparts.ru", "ящик должен быть prajsy@sadparts.ru");
assert(plusAliasFor("ARMTEK") === "prajsy+armtek@sadparts.ru", plusAliasFor("ARMTEK"));
assert(plusAliasFor("rossko") === "prajsy+rossko@sadparts.ru", plusAliasFor("rossko"));
assert(plusTagFromAddress("prajsy+armtek@sadparts.ru") === "armtek", "plus-tag");
assert(plusTagFromAddress(PINNED_PRICE_MAILBOX) === "", "без плюса тега нет");

const stub: Supplier = {
  ...emptySupplierFromPreset(presetById("armtek")!),
  id: "sup-armtek",
  columnMap: { ...DEFAULT_COLUMN_MAP },
};
assert(stub.emailAlias === "prajsy+armtek@sadparts.ru", `алиас пресета: ${stub.emailAlias}`);
assert(
  attachPresetMeta({ ...stub, emailAlias: "armtek@prajsy.local" }).emailAlias === "prajsy+armtek@sadparts.ru",
  "старый @prajsy.local должен мигрировать",
);

const csv = Buffer.from("Артикул;Бренд;Цена\nW7008;MANN;1200\n", "utf8");
const eml = buildSimpleEml({
  from: "opt@armtek.ru",
  to: plusAliasFor("armtek"),
  subject: "Прайс недели",
  filename: "opt.csv",
  data: csv,
  contentType: "text/csv",
});
const parsed = parseEml(eml);
const hit = matchSupplierFromEmail(parsed, [stub]);
assert(hit.supplier?.id === "sup-armtek", `plus-адрес не сопоставил ARMTEK: ${hit.reason}`);

const bySubject = matchSupplierFromEmail(
  {
    from: "opt@armtek.ru",
    to: PINNED_PRICE_MAILBOX,
    subject: "ARMTEK прайс 19.09",
    attachments: [{ filename: "price.csv", contentType: "text/csv", data: csv }],
  },
  [stub],
);
assert(bySubject.supplier?.id === "sup-armtek", `тема на общий ящик не сопоставила: ${bySubject.reason}`);

const prevSecret = process.env.PRICE_MAILBOX_SECRET;
const prevImap = process.env.PRICE_IMAP_HOST;
process.env.PRICE_MAILBOX_SECRET = "test-mailbox-secret";
process.env.PRICE_IMAP_HOST = "";
assert(
  mailboxSecretOk(
    new Request("http://127.0.0.1/api/prices/email/inbound", {
      headers: { Authorization: "Bearer test-mailbox-secret" },
    }),
  ),
  "Bearer должен проходить",
);
assert(
  mailboxSecretOk(
    new Request("http://127.0.0.1/api/prices/email/inbound?secret=test-mailbox-secret"),
  ),
  "query secret должен проходить",
);
assert(
  mailboxSecretOk(
    new Request("http://127.0.0.1/api/prices/email/inbound", {
      headers: { "x-mailbox-secret": "test-mailbox-secret" },
    }),
  ),
  "x-mailbox-secret должен проходить",
);
assert(
  !mailboxSecretOk(new Request("http://127.0.0.1/api/prices/email/inbound")),
  "без секрета webhook закрыт",
);
assert(
  !mailboxSecretOk(
    new Request("http://127.0.0.1/api/prices/email/inbound", {
      headers: { Authorization: "Bearer wrong" },
    }),
  ),
  "чужой секрет не проходит",
);

process.env.PRICE_MAILBOX_ADDRESS = "prajsy@sadparts.ru";
const cfg = priceMailboxConfig();
assert(cfg.address === PINNED_PRICE_MAILBOX, cfg.address);
const overlay = overlayMailboxSettings({
  priceMailboxAddress: "old@prajsy.local",
  priceMailboxImapHost: "stored.example",
  priceMailboxImapPort: 143,
  priceMailboxImapUser: "stored",
});
assert(overlay.priceMailboxAddress === PINNED_PRICE_MAILBOX, "адрес из формы не должен побеждать");

if (prevSecret === undefined) delete process.env.PRICE_MAILBOX_SECRET;
else process.env.PRICE_MAILBOX_SECRET = prevSecret;
if (prevImap === undefined) delete process.env.PRICE_IMAP_HOST;
else process.env.PRICE_IMAP_HOST = prevImap;

console.log("ok ящик prajsy@sadparts.ru, plus-алиас, секрет webhook");
