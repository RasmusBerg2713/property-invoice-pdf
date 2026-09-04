import { z } from "zod";

export const MaintenanceRequest = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  cause: z.enum(["tenant_damage", "wear_and_tear", "landlord_upgrade"]),
  laborCents: z.number().int().nonnegative(),
  partsCents: z.number().int().nonnegative(),
  completedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const TenantDocument = z.object({
  kind: z.enum(["lease", "id_scan", "insurance_certificate"]),
  reference: z.string().min(1),
  signedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const InspectionReminder = z.object({
  area: z.string().min(1),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statutory: z.boolean(),
});

export const InvoiceOrder = z.object({
  orderId: z.string().min(1),
  unit: z.string().min(1),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tenant: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
  }),
  rentCents: z.number().int().positive(),
  maintenance: z.array(MaintenanceRequest).default([]),
  documents: z.array(TenantDocument).default([]),
  inspections: z.array(InspectionReminder).default([]),
});

export type InvoiceOrder = z.infer<typeof InvoiceOrder>;
export type MaintenanceRequest = z.infer<typeof MaintenanceRequest>;

export type InvoiceLine = { label: string; amountCents: number };

/**
 * Who pays for a completed maintenance request.
 *
 * Tenant damage is recharged. Wear and tear and landlord upgrades stay with the
 * owner, so they appear on the statement at zero -- the tenant still sees the work
 * that happened in their home, without being billed for it.
 */
export function rechargeCents(request: MaintenanceRequest): number {
  return request.cause === "tenant_damage" ? request.laborCents + request.partsCents : 0;
}

export function buildLines(order: InvoiceOrder): InvoiceLine[] {
  const lines: InvoiceLine[] = [{ label: `Rent to ${order.periodEnd}`, amountCents: order.rentCents }];
  for (const request of order.maintenance) {
    const amountCents = rechargeCents(request);
    lines.push({
      label: amountCents > 0
        ? `Maintenance ${request.id}: ${request.summary}`
        : `Maintenance ${request.id}: ${request.summary} (covered by owner)`,
      amountCents,
    });
  }
  return lines;
}

export function totalCents(lines: InvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Initials only. A statement travels through mail and printers; the full name does not need to. */
export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]!.toUpperCase()}.`)
    .join(" ");
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function renderInvoiceHtml(order: InvoiceOrder): string {
  const lines = buildLines(order);
  const rows = lines
    .map((line) => `<tr><td>${escapeHtml(line.label)}</td><td class="n">${money(line.amountCents)}</td></tr>`)
    .join("\n");
  const docs = order.documents
    .map((doc) => `<li>${escapeHtml(doc.kind)} &middot; ref ${escapeHtml(doc.reference)} &middot; signed ${doc.signedOn}</li>`)
    .join("\n");
  const reminders = order.inspections
    .map((item) => `<li>${escapeHtml(item.area)} due ${item.dueOn}${item.statutory ? " (statutory)" : ""}</li>`)
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{font:13px/1.5 -apple-system,Helvetica,sans-serif;color:#111;margin:40px}
h1{font-size:20px;margin:0 0 4px}
table{border-collapse:collapse;width:100%;margin:20px 0}
td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
.n{text-align:right;font-variant-numeric:tabular-nums}
.total td{font-weight:600;border-top:2px solid #111}
ul{padding-left:18px}
</style></head><body>
<h1>Statement ${escapeHtml(order.orderId)}</h1>
<p>Unit ${escapeHtml(order.unit)} &middot; tenant ${escapeHtml(initials(order.tenant.fullName))} &middot; period ending ${order.periodEnd}</p>
<table><thead><tr><th>Item</th><th class="n">Amount</th></tr></thead><tbody>
${rows}
<tr class="total"><td>Due</td><td class="n">${money(totalCents(lines))}</td></tr>
</tbody></table>
<h2>Documents on file</h2><ul>${docs || "<li>none</li>"}</ul>
<h2>Upcoming inspections</h2><ul>${reminders || "<li>none scheduled</li>"}</ul>
</body></html>`;
}
