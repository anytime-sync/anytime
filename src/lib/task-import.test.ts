import { expect, it } from 'vitest';
import { parseImport } from './task-import';
const parse = (content: string, zone = 'UTC') =>
  (parseImport as any)('ics', content, zone);
it('ICS TZID resolves future DST and DUE takes precedence over DTSTART', () => {
  expect(
    parse(
      'BEGIN:VTODO\nSUMMARY:Fixture\nDUE;TZID=America/New_York:20260308T090000\nDTSTART;TZID=America/New_York:20260307T090000\nEND:VTODO',
    )[0].due_at,
  ).toBe('2026-03-08T13:00:00.000Z');
});
it('ICS VALUE=DATE retains civil intent at both extremes of the date line', () => {
  for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago'])
    expect(
      parse(
        'BEGIN:VTODO\nSUMMARY:Fixture\nDUE;VALUE=DATE:20261105\nEND:VTODO',
        zone,
      )[0],
    ).toMatchObject({ due_date: '2026-11-05', is_all_day: true });
});
it('Todoist TIMEZONE controls floating date-times', () => {
  expect(
    (parseImport as any)(
      'todoist',
      'TYPE,CONTENT,DATE,TIMEZONE\ntask,Fixture,2026-03-08T09:00,America/New_York',
      'UTC',
    )[0].due_at,
  ).toBe('2026-03-08T13:00:00.000Z');
});
it.each([
  'DUE;TZID=America/New_York:20261101T013000',
  'DUE;TZID=America/New_York:20260308T023000',
  'DUE;TZID=Custom/Zone:20261105T090000',
  'DUE:20261105T090000',
])(
  'rejects ambiguous or unsupported input %s instead of host parsing',
  (line) => {
    expect(() =>
      parse(`BEGIN:VTODO\nSUMMARY:Fixture\n${line}\nEND:VTODO`),
    ).toThrow();
  },
);

it('rejects an unsupported source timezone even when its value includes UTC', () => {
  expect(() =>
    parseImport(
      'todoist',
      'TYPE,CONTENT,DATE,TIMEZONE\ntask,Fixture,2026-03-08T09:00Z,Custom/Zone',
    ),
  ).toThrow('Unsupported timezone');
});
