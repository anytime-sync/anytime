/**
 * voyage.ts — Voyage AI embeddings client.
 * https://docs.voyageai.com/reference/embeddings-api
 *
 * Models:
 *   - voyage-3 → 1024-dim (we use this; matches search_embeddings.embedding column)
 *   - voyage-3-lite → 512-dim (cheaper; if we ever need to scale)
 *
 * Pure transport — no DB, no Supabase. Caller persists to search_embeddings.
 *
 * Free tier (as of 2026-05): generous for individual use. Costs jump
 * past 50M tokens/month — we're nowhere near that.
 */

const VOYAGE_BASE = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_MODEL = "voyage-3";

export type VoyageEmbedResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
};

function getKey(): string {
  const k = process.env.VOYAGE_API_KEY;
  if (!k) throw new Error("VOYAGE_API_KEY not set");
  return k;
}

/**
 * Embed a batch of texts. Voyage accepts up to 128 inputs per call,
 * 32k tokens total. We chunk if caller passes more than that.
 *
 * input_type: "document" for the items being indexed, "query" for
 * search queries. They use slightly different model heads internally.
 */
export async function embedBatch(
  texts: string[],
  opts: {
    inputType?: "document" | "query";
    model?: string;
  } = {}
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = opts.model ?? DEFAULT_MODEL;
  const inputType = opts.inputType ?? "document";

  // Trim each input to ~8k chars (~2k tokens) so a single doc can't
  // explode the request budget.
  const safeTexts = texts.map((t) =>
    t.length > 8000 ? t.slice(0, 8000) : t
  );

  // Chunk into batches of 100 to leave headroom under the 128 limit.
  const out: number[][] = [];
  const CHUNK = 100;
  for (let i = 0; i < safeTexts.length; i += CHUNK) {
    const slice = safeTexts.slice(i, i + CHUNK);
    const res = await fetch(VOYAGE_BASE, {
      method: "POST",
      headers: {
        authorization: `Bearer ${getKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: slice,
        model,
        input_type: inputType,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`voyage_embed_failed: ${res.status} ${text}`);
    }
    const j = (await res.json()) as VoyageEmbedResponse;
    // Voyage returns sorted by `index` — guard anyway.
    const sorted = j.data.slice().sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

export async function embedOne(
  text: string,
  opts?: { inputType?: "document" | "query"; model?: string }
): Promise<number[]> {
  const [v] = await embedBatch([text], opts);
  return v;
}
