import { createServer } from "node:http";
import { InvoiceOrder } from "./invoice_lines.ts";
import { generateInvoicePdf } from "./invoice_pdf.ts";
import { InfraiError } from "./infrai_client.ts";

const PORT = Number(process.env.PORT ?? 8080);

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/statements") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "POST /statements" }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    void (async () => {
      try {
        const parsed = InvoiceOrder.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        if (!parsed.success) {
          res.writeHead(422, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_order", issues: parsed.error.issues }));
          return;
        }
        const pdf = await generateInvoicePdf(parsed.data);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ orderId: parsed.data.orderId, url: pdf.url ?? null }));
      } catch (err) {
        // A rejected argument is the caller's problem, not a server fault: pass the
        // status through instead of collapsing everything into a 500.
        if (err instanceof InfraiError && err.status < 500) {
          res.writeHead(err.status, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: err.code }));
          return;
        }
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "statement_render_failed" }));
      }
    })();
  });
});

server.listen(PORT, () => console.log(`statements on http://127.0.0.1:${PORT}/statements`));
