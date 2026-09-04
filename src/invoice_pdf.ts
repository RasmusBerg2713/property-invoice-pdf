import { infrai, type GeneratedPdf } from "./infrai_client.ts";
import { renderInvoiceHtml, type InvoiceOrder } from "./invoice_lines.ts";

/**
 * Render the statement HTML to a stored PDF. The order id is the idempotency key,
 * so re-sending the same statement returns the same document.
 */
export async function generateInvoicePdf(order: InvoiceOrder): Promise<GeneratedPdf> {
  const result = await infrai.pdf.generate(
    {
      html: renderInvoiceHtml(order),
      page_size: "A4",
      orientation: "portrait",
      store: true,
    },
    `invoice-${order.orderId}`,
  );

  return result.job_id ? await waitForJob(result.job_id) : result;
}

async function waitForJob(jobId: string): Promise<GeneratedPdf> {
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 750));
    const job = await infrai.pdf.job.get(jobId);
    if (job.url || job.pdf) return job;
  }
  throw new Error(`PDF job ${jobId} still rendering after 15s`);
}
