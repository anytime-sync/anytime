/**
 * notes.ts — utilities for the notes domain.
 *
 *   - parseLinks(body) → string[]   extracts [[wiki link]] targets
 *   - slugify(s)        → string    used to match wiki links to titles
 */

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

/**
 * Parse `[[Wiki Link Title]]` references out of a markdown body.
 * Returns slug-form strings, deduplicated, in document order.
 */
export function parseLinks(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = WIKI_LINK_RE.exec(body)) !== null) {
    const slug = slugify(m[1]);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}
