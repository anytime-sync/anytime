import { dayWindow, resolveLocalInput, validDate } from './day-window';
export type Norm = {
  title: string;
  due_at: string | null;
  due_date?: string | null;
  is_all_day?: boolean;
  time_kind?: 'deadline';
  schedule_timezone?: string;
  list: string | null;
  is_completed: boolean;
};

export function parseImport(
  format: string,
  content: string,
  timezone = 'UTC',
): Norm[] {
  switch (format) {
    case 'ticktick':
      return parseTickTick(content, timezone);
    case 'todoist':
      return parseTodoist(content, timezone);
    case 'ics':
      return parseIcs(content, timezone);
    case 'generic':
      return parseGenericCsv(content, timezone);
    default:
      throw new Error('unknown_format');
  }
}

/** TickTick CSV columns include: Folder Name, Title, Tags, Content,
 *  Is Check list, Start Date, Due Date, Reminder, Repeat, Priority, Status. */
function parseTickTick(text: string, timezone: string): Norm[] {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => c.toLowerCase().trim());
  const titleIdx = header.indexOf('title');
  const folderIdx = header.indexOf('folder name');
  const dueIdx = header.indexOf('due date');
  const statusIdx = header.indexOf('status');
  if (titleIdx < 0) return [];
  return rows
    .slice(1)
    .filter((r) => r[titleIdx])
    .map((r) => ({
      title: String(r[titleIdx]).trim(),
      list: folderIdx >= 0 ? String(r[folderIdx] ?? '').trim() || null : null,
      ...parseDate(dueIdx >= 0 ? r[dueIdx] : null, timezone),
      // TickTick: Status 0=normal, 1=completed, 2=archived
      is_completed: statusIdx >= 0 && String(r[statusIdx]).trim() === '1',
    }));
}

/** Todoist CSV: TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, AUTHOR, RESPONSIBLE, DATE, DATE_LANG, TIMEZONE, ... */
function parseTodoist(text: string, timezone: string): Norm[] {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => c.toLowerCase().trim());
  const typeIdx = header.indexOf('type');
  const contentIdx = header.indexOf('content');
  const dateIdx = header.indexOf('date');
  const zoneIdx = header.indexOf('timezone');
  if (contentIdx < 0) return [];
  // Todoist exports include section/note rows too — only keep type=task.
  return rows
    .slice(1)
    .filter(
      (r) =>
        r[contentIdx] &&
        (typeIdx < 0 || String(r[typeIdx]).toLowerCase() === 'task'),
    )
    .map((r) => ({
      title: String(r[contentIdx]).trim(),
      list: null, // Todoist single-CSV exports don't include project per row
      ...parseDate(
        dateIdx >= 0 ? r[dateIdx] : null,
        timezone,
        zoneIdx >= 0 ? r[zoneIdx]?.trim() : undefined,
      ),
      is_completed: false,
    }));
}

/** Apple Reminders / Calendar .ics export — VTODO blocks. */
function parseIcs(text: string, timezone: string): Norm[] {
  const out: Norm[] = [];
  const blocks = text
    .replace(/\r?\n[ \t]/g, '')
    .split(/BEGIN:VTODO/i)
    .slice(1);
  if (!blocks.length && /BEGIN:VEVENT/i.test(text))
    throw new Error('This task importer supports VTODO, not calendar VEVENT.');
  for (const block of blocks) {
    const end = block.search(/END:VTODO/i);
    if (end < 0) throw new Error('Incomplete VTODO');
    const lines = block.slice(0, end).split(/\r?\n/);
    let title = '',
      completed = false;
    let due:
      | Pick<
          Norm,
          | 'due_at'
          | 'due_date'
          | 'is_all_day'
          | 'time_kind'
          | 'schedule_timezone'
        >
      | undefined;
    let start: typeof due;
    for (const line of lines) {
      const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/i.exec(line);
      if (!m) continue;
      const [, key, params, value] = m;
      if (key.toUpperCase() === 'SUMMARY')
        title = value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
      if (key.toUpperCase() === 'RRULE')
        throw new Error(
          'Recurring VTODO import requires review; recurrence was not discarded.',
        );
      if (key.toUpperCase() === 'STATUS')
        completed = value.trim().toUpperCase() === 'COMPLETED';
      if (!['DUE', 'DTSTART'].includes(key.toUpperCase())) continue;
      const isDate = /;VALUE=DATE(?:;|$)/i.test(params);
      const zone = /;TZID=("[^"]+"|[^;]+)/i
        .exec(params)?.[1]
        .replace(/^"|"$/g, '');
      let parsed: NonNullable<typeof due>;
      if (isDate) {
        if (!/^\d{8}$/.test(value)) throw new Error('Invalid ICS VALUE=DATE');
        parsed = parseDate(
          `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
          timezone,
        );
      } else {
        const date = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(
          value.trim(),
        );
        if (!date)
          throw new Error(
            'Unsupported ICS date-time; use VALUE=DATE, UTC or an IANA TZID.',
          );
        const [, y, mo, d, hh, mm, ss, z] = date;
        parsed = parseDate(
          `${y}-${mo}-${d}T${hh}:${mm}:${ss}${z}`,
          timezone,
          zone,
        );
      }
      if (key.toUpperCase() === 'DUE') due = parsed;
      else start = parsed;
    }
    if (title)
      out.push({
        title,
        list: null,
        ...(due ?? start ?? { due_at: null }),
        is_completed: completed,
      });
  }
  return out;
}

/** Generic CSV with columns: title, due, list, completed. */
function parseGenericCsv(text: string, timezone: string): Norm[] {
  const rows = csvRows(text);
  if (!rows.length) return [];
  const header = rows[0]!.map((c) => c.toLowerCase().trim());
  const titleIdx = header.indexOf('title');
  const dueIdx = header.indexOf('due');
  const listIdx = header.indexOf('list');
  const completedIdx = header.indexOf('completed');
  if (titleIdx < 0) return [];
  return rows
    .slice(1)
    .filter((r) => r[titleIdx])
    .map((r) => ({
      title: String(r[titleIdx]).trim(),
      list: listIdx >= 0 ? String(r[listIdx] ?? '').trim() || null : null,
      ...parseDate(dueIdx >= 0 ? r[dueIdx] : null, timezone),
      is_completed:
        completedIdx >= 0 &&
        /^(true|1|yes|y)$/i.test(String(r[completedIdx]).trim()),
    }));
}

/* ---------- helpers ---------- */

/** Minimal CSV parser handling quoted commas and double-quote escapes. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  let cell = '';
  let row: string[] = [];
  let inQuote = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuote = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.length && r.some((c) => c.length));
}

function parseDate(
  input: unknown,
  accountZone: string,
  sourceZone?: string,
): Pick<
  Norm,
  'due_at' | 'due_date' | 'is_all_day' | 'time_kind' | 'schedule_timezone'
> {
  const value = String(input ?? '')
    .trim()
    .replace(' ', 'T');
  if (!value) return { due_at: null };
  for (const zone of [accountZone, sourceZone].filter(Boolean)) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: zone });
    } catch {
      throw new Error('Unsupported timezone: ' + zone);
    }
  }
  if (validDate(value))
    return {
      due_at: dayWindow(value, accountZone).start.toISOString(),
      due_date: value,
      is_all_day: true,
      time_kind: 'deadline',
      schedule_timezone: accountZone,
    };
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(
      value,
    ) &&
    validDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value))
  )
    return {
      due_at: new Date(value).toISOString(),
      due_date: null,
      is_all_day: false,
      time_kind: 'deadline',
      schedule_timezone: sourceZone || accountZone,
    };
  if (!sourceZone)
    throw new Error(
      'Floating or unsupported date-time: include a UTC offset or IANA timezone.',
    );
  try {
    new Intl.DateTimeFormat('en', { timeZone: sourceZone });
  } catch {
    throw new Error('Unsupported timezone: ' + sourceZone);
  }
  return {
    due_at: resolveLocalInput(value, sourceZone),
    due_date: null,
    is_all_day: false,
    time_kind: 'deadline',
    schedule_timezone: sourceZone,
  };
}
