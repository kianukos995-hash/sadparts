import assert from "node:assert/strict";
import { xmlToTable } from "../src/lib/parse-feed";
import {
  flattenRosskoParts,
  isRosskoSoapXml,
  parseCheckoutDetails,
  parseCheckoutResult,
  parseOrdersResult,
  parseSearchResult,
  parseSoapXml,
} from "../src/lib/rossko-soap";
import {
  GET_CHECKOUT_DETAILS_XML,
  GET_CHECKOUT_XML,
  GET_ORDERS_XML,
  GET_SEARCH_XML,
} from "../src/lib/rossko-soap-fixtures";

const search = parseSearchResult(parseSoapXml(GET_SEARCH_XML));
assert.equal(search.success, true);
assert.equal(search.parts.length, 1);
assert.equal(search.parts[0].guid, "NSIN0000086407");
assert.equal(search.parts[0].partnumber, "333114");
assert.equal(search.parts[0].stocks.length, 2);
assert.equal(search.parts[0].stocks[0].id, "HST154");
assert.equal(search.parts[0].stocks[0].price, 2449.85);
assert.equal(search.parts[0].stocks[0].delivery, 0);
assert.equal(search.parts[0].crosses[0].partnumber, "290074");
assert.equal(flattenRosskoParts(search.parts).length, 2);
assert.equal(isRosskoSoapXml(GET_SEARCH_XML), true);

const table = xmlToTable(GET_SEARCH_XML);
assert.ok(table.headers.includes("guid") || table.headers.includes("Номенклатура"));
assert.equal(table.rows[0].Артикул || table.rows[0].partnumber, "333114");
assert.equal(table.rows[0].id || table.rows[0].stock, "HST154");

const details = parseCheckoutDetails(parseSoapXml(GET_CHECKOUT_DETAILS_XML));
assert.equal(details.deliveries[0].id, "000000001");
assert.equal(details.payments[1].id, 2);
assert.equal(details.addresses[0].id, 112233);
assert.deepEqual(details.addresses[0].deliveryIds, ["000000002", "000000003", "000000004"]);
assert.equal(details.companies[0].requisites, "ИНН 0123456789");

const checkout = parseCheckoutResult(parseSoapXml(GET_CHECKOUT_XML));
assert.equal(checkout.orderIds[0], "1234567");
assert.equal(checkout.items[0].partnumber, "IQ16TT#4");
assert.equal(checkout.items[0].stock, "HST123");
assert.equal(checkout.errors[0].message, "Нет в наличии");

const orders = parseOrdersResult(parseSoapXml(GET_ORDERS_XML));
assert.equal(orders.orders[0].id, "1234567");
assert.equal(orders.orders[0].deliveryType, "Курьерская доставка");
assert.equal(orders.orders[0].parts[0].guid, "NSII0009734515");
assert.equal(orders.orders[0].parts[0].status, 1);

console.log("rossko soap fixtures: ok");
