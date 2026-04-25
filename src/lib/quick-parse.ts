import * as chrono from "chrono-node";

export type ParsedQuickInput = {
  title: string;
  due_at: string | null;
  is_all_day: boolean;
  priority: 0 | 1 | 3 | 5;
  tagNames: string[];
  projectName?: string;
};

/**
 * Parse a TickTick-style quick add string:
 *   "Buy milk tomorrow 5pm #shopping #errands !1 ~groceries"
 *   - dates via chrono-node
 *   - #tag adds tags
 *   - !1 / !2 / !3 / !4 set priority (1=high, 4=none)
 *   - ~list  routes the task to that list (by name; created if missing — handled upstream)
 */
export function parseQuickInput(raw: string): ParsedQuickInput {
  let s = raw.trim();
  // priority
  let priority: 0 | 1 | 3 | 5 = 0;
  const pMatch = s.match(/(^|\s)!([1-4])(\s|$)/);
  if (pMatch) {
    const n = parseInt(pMatch[2]!, 10);
    priority = n === 1 ? 5 : n === 2 ? 3 : n === 3 ? 1 : 0;
    s = s.replace(pMatch[0], " ").trim();
  }
  // tags
  const tagNames: string[] = [];
  s = s.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_, lead, name) => {
    tagNames.push(name);
    return lead;
  }).trim();
  // project (~list)
  let projectName: string | undefined;
  const lMatch = s.match(/(^|\s)~([\p{L}\p{N}_-]+)/u);
  if (lMatch) {
    projectName = lMatch[2];
    s = s.replace(lMatch[0], " ").trim();
  }

  // chrono date
  let due_at: string | null = null;
  let is_all_day = true;
  const results = chrono.parse(s, new Date(), { forwardDate: true });
  if (results.length) {
    const r = results[0]!;
    const start = r.start;
    if (start) {
      const known = (k: string) => start.isCertain(k as any);
      is_all_day = !(known("hour") || known("minute"));
      const d = start.date();
      due_at = d.toISOString();
      // remove the matched substring
      s = (s.slice(0, r.index) + s.slice(r.index + r.text.length)).replace(/\s+/g, " ").trim();
    }
  }

  return {
    title: s.replace(/\s+/g, " ").trim(),
    due_at,
    is_all_day,
    priority,
    tagNames,
    projectName,
  };
}
