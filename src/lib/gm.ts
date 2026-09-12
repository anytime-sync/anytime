import { z } from 'zod';
import { validDate } from './day-window';
const date = z.string().refine(v => v === '' || validDate(v), 'Use a valid date');
export const gmSchema = z.object({
  version: z.literal(1),
  category: z.enum(['Action', 'P&L', 'Strategy', 'Business review']),
  state: z.enum(['Verify', 'Active', 'Waiting', 'Decision', 'Closed']),
  owner: z.string().max(200),
  commitment: date, followUp: date, verified: date,
  outcome: z.string().max(2000), nextAction: z.string().max(2000),
  evidence: z.string().max(2000),
}).refine(v => v.state !== 'Closed' || v.evidence.trim().length > 0, 'Record closure evidence before closing');
export type GM = z.infer<typeof gmSchema>;
export const emptyGM: GM = { version: 1, category: 'Action', state: 'Verify', owner: '', commitment: '', followUp: '', verified: '', outcome: '', nextAction: '', evidence: '' };
const marker = /^<!-- firstlight-gm:v1\n([\s\S]*?)\n-->\n?/;
export function readGM(notes: string | null): GM | null {
  const match = (notes ?? '').match(marker);
  if (!match) return null;
  try { const result = gmSchema.safeParse(JSON.parse(match[1])); return result.success ? result.data : null; } catch { return null; }
}
export function writeGM(notes: string | null, value: GM): string {
  const parsed = gmSchema.parse(value);
  return `<!-- firstlight-gm:v1\n${JSON.stringify(parsed)}\n-->\n${(notes ?? '').replace(marker, '')}`;
}
export function needsAttention(value: GM, today: string): boolean {
  return value.state !== 'Closed' && (value.state === 'Verify' || value.state === 'Decision' || !!value.commitment && value.commitment < today || !!value.followUp && value.followUp <= today);
}
