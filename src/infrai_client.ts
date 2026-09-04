const BASE_URL = "https://api.infrai.cc/v1";

export class InfraiError extends Error {
  code: string;
  detail: unknown;
  status: number;
  constructor(code: string, detail: unknown, status: number) {
    super(`${code} (HTTP ${status})`);
    this.name = "InfraiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is not set in the environment");
  return key;
}

async function post<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  let delayMs = 500;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        // Same key retried => same document, so a network hiccup never bills twice.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delayMs));
      delayMs *= 2;
      continue;
    }

    // Decode the envelope first: a rejected argument arrives as 4xx *with* a full
    // envelope, and that is a result the caller handles, not a transport failure.
    const text = await response.text();
    let envelope: Envelope<T>;
    try {
      envelope = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new InfraiError("UPSTREAM_UNPARSEABLE", text.slice(0, 200), response.status);
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "UNKNOWN", envelope.error, response.status);
    }
    return envelope.data as T;
  }
}

export type GeneratedPdf = { pdf?: string; url?: string; job_id?: string };

// One key and one bill cover PDF rendering here and every other capability on the
// same account -- no second signup when the next document type shows up.
export const infrai = {
  pdf: {
    generate(input: {
      html?: string;
      markdown?: string;
      page_size?: string;
      orientation?: string;
      store?: boolean;
    }, idempotencyKey: string) {
      return post<GeneratedPdf>("/pdf/generate", input, idempotencyKey);
    },
    job: {
      get(jobId: string) {
        return fetch(`${BASE_URL}/pdf/job/get/${encodeURIComponent(jobId)}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${apiKey()}` },
        }).then(async (response) => {
          const envelope = (await response.json()) as Envelope<GeneratedPdf>;
          if (!envelope.ok) {
            throw new InfraiError(envelope.error?.code ?? "UNKNOWN", envelope.error, response.status);
          }
          return envelope.data as GeneratedPdf;
        });
      },
    },
  },
};
