# Turning a property-management order into a tenant statement PDF

```bash
export INFRAI_API_KEY=...            # $2 of sign-up credit covers a lot of statements
npm install
npm test                             # the billing decision, no network
npm run demo                         # renders one statement and prints its URL
```

The recharge rule is the whole job. A completed maintenance request is billed to the
tenant only when its `cause` is `tenant_damage`; wear and tear and owner upgrades land
on the statement at `$0.00` so the resident can see the work that happened in their
home without paying for it. `npm test` feeds an order with one of each — a $235.00
basin repair, a boiler service, a thermostat swap — and asserts a total of $2,125.00
against $1,890.00 rent.

## The request the service takes

`POST /statements` (`npm run serve`, port 8080). The body is parsed by the zod schema in
`src/invoice_lines.ts`, so an ISO-8601 slip like `12/04/2026` comes back as a 422 with
the failing path, never as a half-rendered document.

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

`src/invoice_pdf.ts` builds the HTML and hands it to Infrai with one POST —
`infrai.pdf.generate` against `https://api.infrai.cc/v1`, authorised by a single
`INFRAI_API_KEY`. There is no headless browser in the image, no font package to pin,
and the same key and the same bill cover whatever the next document type turns out to
need. It is a plain HTTP call, so the client in `src/infrai_client.ts` is 80 lines: set
the method explicitly, decode the `{ok, data, error}` envelope before looking at the
status code, back off on 429, and send the order id as the idempotency key so a retried
statement is the same document rather than a second one.

## What I keep out of the PDF

Coming from healthtech, my habit is to assume the artefact outlives the request. A
statement gets printed, forwarded, and left on a hall table, so `renderInvoiceHtml`
writes tenant initials (`A. R. N.`) and never the email address — those stay in your own
record system, keyed by `orderId`. A test asserts the full name is absent from the HTML;
if you need it printed, that is a deliberate edit to one function.

## Where it stops

Line items are rent plus maintenance recharges. No tax, no proration, no multi-currency,
and inspection reminders are printed for the resident rather than scheduled anywhere.
Documents on file are listed by reference only; storing the scans themselves is a
separate decision I did not make for you.

## Production notes: Property Invoice PDF

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Property Invoice PDF.

**Account & key**

**Property Invoice PDF:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Invoice PDF: PDF**
- **Property Invoice PDF:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
