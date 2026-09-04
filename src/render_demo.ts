import { InvoiceOrder } from "./invoice_lines.ts";
import { generateInvoicePdf } from "./invoice_pdf.ts";

const order = InvoiceOrder.parse({
  orderId: "STM-2026-0412",
  unit: "Larkspur Court 3B",
  periodEnd: "2026-04-30",
  tenant: { fullName: "Amelia Rose Nguyen", email: "tenant@example.com" },
  rentCents: 189000,
  maintenance: [
    { id: "MR-118", summary: "Cracked bathroom basin", cause: "tenant_damage", laborCents: 9000, partsCents: 14500, completedOn: "2026-04-12" },
    { id: "MR-121", summary: "Boiler service", cause: "wear_and_tear", laborCents: 12000, partsCents: 0, completedOn: "2026-04-19" },
  ],
  documents: [{ kind: "lease", reference: "LSE-3B-2025", signedOn: "2025-09-01" }],
  inspections: [{ area: "Smoke alarms", dueOn: "2026-06-01", statutory: true }],
});

const pdf = await generateInvoicePdf(order);
console.log(pdf.url ?? `inline pdf, ${pdf.pdf?.length ?? 0} base64 chars`);
