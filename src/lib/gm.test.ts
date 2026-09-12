import { expect, it } from 'vitest';
import { emptyGM, readGM, writeGM, needsAttention, gmSchema } from './gm';
it('preserves source notes and commitment when follow-up moves', () => {
  const first = { ...emptyGM, commitment: '2026-08-26', followUp: '2026-09-12' };
  const notes = writeGM('Original email\nSource and history', first);
  const moved = writeGM(notes, { ...readGM(notes)!, followUp: '2026-09-20' });
  expect(readGM(moved)?.commitment).toBe('2026-08-26');
  expect(moved.endsWith('Original email\nSource and history')).toBe(true);
  expect(needsAttention(readGM(moved)!, '2026-09-12')).toBe(true);
});
it('requires evidence to close, and rejects malformed metadata', () => {
  expect(gmSchema.safeParse({ ...emptyGM, state: 'Closed' }).success).toBe(false);
  expect(readGM('<!-- firstlight-gm:v1\ninvalid\n-->')).toBe(null);
});
