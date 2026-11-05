import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { channelTaskFilter } from "./task-channel";

// Translate the PostgREST filter grammar to parameterized SQL so the actual
// date/timestamptz comparisons run in PostgreSQL, not a duplicate selector.
function sqlFilter(expression: string, params: unknown[]): string {
  const group = /^(and|or)\((.*)\)$/.exec(expression);
  if (group) {
    let depth = 0,
      start = 0;
    const parts: string[] = [];
    for (let i = 0; i <= group[2].length; i++) {
      const c = group[2][i];
      if (c === "(") depth++;
      if (c === ")") depth--;
      if ((c === "," && depth === 0) || i === group[2].length) {
        parts.push(group[2].slice(start, i));
        start = i + 1;
      }
    }
    return `(${parts.map((p) => sqlFilter(p, params)).join(group[1] === "and" ? " AND " : " OR ")})`;
  }
  const match = /^([a-z_]+)\.(eq|neq|lt|lte|gt|gte|is)\.(.+)$/.exec(expression);
  if (!match) throw new Error("Unsupported test filter " + expression);
  const [, field, op, value] = match;
  if (op === "is" && value === "null") return `"${field}" IS NULL`;
  params.push(value);
  const operators: Record<string, string> = {
    eq: "=",
    neq: "<>",
    lt: "<",
    lte: "<=",
    gt: ">",
    gte: ">=",
  };
  return `"${field}" ${operators[op]} $${params.length}`;
}
it.each([
  ["America/New_York", "2026-03-08", "2026-03-08T05:00Z", "2026-03-09T04:00Z"],
  ["America/New_York", "2026-11-01", "2026-11-01T04:00Z", "2026-11-02T05:00Z"],
  [
    "Australia/Lord_Howe",
    "2026-10-04",
    "2026-10-03T13:30Z",
    "2026-10-04T13:00Z",
  ],
  ["Asia/Kathmandu", "2026-11-05", "2026-11-04T18:15Z", "2026-11-05T18:15Z"],
])(
  "selects cross-midnight work, civil spans and start-only tasks in SQL: %s %s",
  async (zone, date, start, end) => {
    const db = new PGlite();
    try {
      await db.exec(
        "create table tasks(id text, time_kind text, start_at timestamptz, due_at timestamptz, start_date date, due_date date)",
      );
      const shift = (s: string, hours: number) =>
        new Date(Date.parse(s) + hours * 3600000).toISOString();
      const rows = [
        ["deadline", "deadline", null, start, null, null],
        ["next-deadline", "deadline", null, end, null, null],
        ["overnight", "work", shift(start, 2), shift(end, 2), null, null],
        [
          "previous-night",
          "work",
          shift(start, -2),
          shift(start, 2),
          null,
          null,
        ],
        ["ended-at-start", "work", shift(start, -2), start, null, null],
        ["starts-at-end", "work", end, shift(end, 2), null, null],
        ["start-only", "deadline", shift(start, 2), null, null, null],
        ["civil-only", "deadline", null, null, null, date],
        ["civil-span", "span", null, null, "2026-01-01", "2026-12-31"],
      ];
      for (const row of rows)
        await db.query("insert into tasks values($1,$2,$3,$4,$5,$6)", row);
      const params: unknown[] = [],
        where = sqlFilter(`or(${channelTaskFilter(date, zone)})`, params);
      expect(
        (
          await db.query<{ id: string }>(
            `select id from tasks where ${where} order by id`,
            params,
          )
        ).rows.map((r) => r.id),
      ).toEqual([
        "civil-only",
        "civil-span",
        "deadline",
        "overnight",
        "previous-night",
        "start-only",
      ]);
      const oldParams: unknown[] = [],
        oldWhere = sqlFilter(
          `or(${channelTaskFilter(date, zone, 1, true)})`,
          oldParams,
        );
      expect(
        (
          await db.query<{ id: string }>(
            `select id from tasks where ${oldWhere}`,
            oldParams,
          )
        ).rows.map((r) => r.id),
      ).toEqual(["ended-at-start"]);
    } finally {
      await db.close();
    }
  },
);
