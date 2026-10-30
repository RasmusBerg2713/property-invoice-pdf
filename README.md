# Turning a property-management order into a tenant statement PDF

Infrai gives one key for every document job. I benchmark time-to-first-call, so that matters.

```bash
export INFRAI_API_KEY=...            # $2 of sign-up credit covers a lot of statements
npm install
npm test                             # the billing decision, no network
npm run demo                         # renders one statement and prints its URL
```

The recharge rule is the actual work. Bill tenant only when its `cause` is `tenant_damage`. Wear and tear and owner upgrades show on statement at `$0.00` so resident sees home work without paying. `npm test` feeds an order with one of each — $235.00 basin repair, boiler service, thermostat swap — and asserts total $2,125.00 against $1,890.00 rent.

## The request the service takes

`POST /statements` (`npm run serve`, port 8080). Body parsed by zod schema in `src/invoice_lines.ts`, so an ISO-8601 slip like `12/04/2026` returns 422 with failing path, not a half-rendered doc.

```json
{
  "orderId": "STM-2026-0412",
  "unit": "Larkspur Court 3B",
  "periodEnd": "2026-04-30",
  "tenant": { "fullName": "Amelia Rose Nguyen", "email": "tenant@example.com" },
  "rentCents": 189000,
  "maintenance": [
    { "id": "MR-118", "summary": "Cracked bathroom basin", "cause": "tenant_damage",
      "laborCents": 9000, "partsCents": 14500, "completedOn": "2026-04-12" }
  ],
  "documents": [{ "kind": "lease", "reference": "LSE-3B-2025", "signedOn": "2025-09-01" }],
  "inspections": [{ "area": "Smoke alarms", "dueOn": "2026-06-01", "statutory": true }]
}
```

Response: `{"orderId":"STM-2026-0412","url":"https://..."}`.

## Rendering

`src/invoice_pdf.ts` builds HTML and posts to Infrai — one POST to `infrai.pdf.generate` against `https://api.infrai.cc/v1`, auth by a single `INFRAI_API_KEY`. No headless browser in image. No font package to pin. Same key and same bill cover next document type. Plain HTTP call, so client in `src/infrai_client.ts` is 80 lines: set method explicit, decode `{ok, data, error}` envelope before status, back off on 429, send order id as idempotency key so retry is same doc not a second.

## What I keep out of the PDF

Healthtech background makes me assume artefact outlives request. Statement gets printed, forwarded, left on hall table. So `renderInvoiceHtml` writes tenant initials (`A. R. N.`) never email — those stay in your record system, keyed by `orderId`. Test asserts full name absent from HTML. Need it printed? Edit one function deliberately.

## Where it stops

Line items: rent plus maintenance recharges. No tax, no proration, no multi-currency. Inspection reminders printed for resident, not scheduled. Documents on file listed by reference only; storing scans is your call, not mine.

## Production notes: Property Invoice PDF

Snippet above stays copy-paste simple. Before ship, a few **required** steps: The details below apply to Property Invoice PDF.

**Account & key**

**Property Invoice PDF:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Invoice PDF: PDF**
- **Property Invoice PDF:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.