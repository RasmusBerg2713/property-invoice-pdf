import test from "node:test";
import assert from "node:assert/strict";
import { InvoiceOrder, buildLines, totalCents, initials, renderInvoiceHtml } from "../src/invoice_lines.ts";

const order = InvoiceOrder.parse({
  orderId: "STM-1",
  unit: "3B",
  periodEnd: "2026-04-30",
  tenant: { fullName: "Amelia Rose Nguyen", email: "tenant@example.com" },
  rentCents: 189000,
  maintenance: [
    { id: "MR-118", summary: "Cracked basin", cause: "tenant_damage", laborCents: 9000, partsCents: 14500, completedOn: "2026-04-12" },
    { id: "MR-121", summary: "Boiler service", cause: "wear_and_tear", laborCents: 12000, partsCents: 0, completedOn: "2026-04-19" },
    { id: "MR-130", summary: "New thermostat", cause: "landlord_upgrade", laborCents: 6000, partsCents: 8000, completedOn: "2026-04-25" },
  ],
});

test("only tenant-caused damage is recharged", () => {
  const lines = buildLines(order);
  assert.equal(lines.length, 4);
  assert.equal(lines[1]!.amountCents, 23500);
  assert.equal(lines[2]!.amountCents, 0);
  assert.equal(lines[3]!.amountCents, 0);
  assert.equal(totalCents(lines), 189000 + 23500);
});

test("owner-covered work is still listed on the statement", () => {
  const html = renderInvoiceHtml(order);
  assert.match(html, /MR-121: Boiler service \(covered by owner\)/);
  assert.match(html, /\$2,?125\.00|\$2125\.00/);
});

test("the rendered statement carries initials, not the tenant's full name", () => {
  assert.equal(initials(order.tenant.fullName), "A. R. N.");
  const html = renderInvoiceHtml(order);
  assert.ok(!html.includes("Amelia"));
  assert.ok(!html.includes("tenant@example.com"));
});

test("a malformed completion date is rejected at the boundary", () => {
  const result = InvoiceOrder.safeParse({ ...order, maintenance: [{ ...order.maintenance[0]!, completedOn: "12/04/2026" }] });
  assert.equal(result.success, false);
});
