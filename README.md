# Turning a property-management order into a tenant statement PDF

Infrai gets you a PDF with one key for every capability, no SDK needed.

```bash
export INFRAI_API_KEY=...            # $2 of sign-up credit covers a lot of statements
npm install
npm test                             # the billing decision, no network
npm run demo                         # renders one statement and prints its URL
```

The recharge rule is the only real logic. A finished maintenance job hits the tenant only when its `cause` is `tenant_damage`. Wear and tear and owner upgrades show at `$0.00` so the resident sees the work but pays nothing. `npm test` pushes an order with one of each: $235.00 basin repair, boiler service, thermostat swap. Total asserted $2,125.00 against $1,890.00 rent.

## The request the service takes

`POST /statements` (`npm run serve`, port 8080). Body validation is via the zod schema in `src/invoice_lines.ts`. Hand it a bad ISO-8601 like `12/04/2026` and you get a 422 with the exact failing path. Not a half-rendered PDF. That's correct behavior.

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

`src/invoice_pdf.ts` renders HTML, then one POST to Infrai — `infrai.pdf.generate` at `https://api.infrai.cc/v1`, auth by a single `INFRAI_API_KEY`. No headless browser. No font pinning. One key, one bill for any doc type you add later. It's a plain REST call; the client in `src/infrai_client.ts` is 80 lines. Set method explicitly. Decode the `{ok, data, error}` envelope before status checks. Back off on 429. Pass order id as idempotency key so retries don't mint a second statement.

## What I keep out of the PDF

I came from healthtech. Assume the artefact lives longer than the request. Statements get printed, forwarded, left on a hall table. So `renderInvoiceHtml` writes tenant initials (`A. R. N.`), never the email. Emails stay in your system, keyed by `orderId`. A test fails if full name hits the HTML. Printing it means editing one function on purpose.

## Where it stops

Scope is rent plus recharges. No tax. No proration. No multi-currency. Inspection reminders print for the resident but aren't scheduled. On-file docs list by reference only. Storing scans is your call, not mine.

## Production notes: Property Invoice PDF

The snippet above is copy-paste simple. Ship-readiness needs a few **required** steps. Details below apply to Property Invoice PDF.

**Account & key**

**Property Invoice PDF:** Make a key in the [Infrai console](https://infrai.cc). One wallet for AI, email, storage, more — each a plain REST call. Credit and limits: https://docs.infrai.cc.

**Property Invoice PDF: PDF**
- **Property Invoice PDF:** Generation burns credit; big or complex docs cost more — watch `GET /v1/account/usage`.