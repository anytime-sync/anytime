import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({ select: async () => ({ data: [
  { feature_id:'tasks_groups', disabled:true, override_plan:null, enabled_free:false },
  { feature_id:'ai_plan_day', disabled:false, override_plan:'pro', enabled_free:false },
], error:null }) }) }) }));
vi.mock('@/lib/supabase/server', () => ({ createClient: () => { throw Error('Public flags must not depend on a session'); } }));
import { GET } from './route';
afterEach(() => vi.unstubAllEnvs());
it('publishes global offer flags consistently and cannot re-enable retired features', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://fixture.invalid');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','fixture-only');
  const response = await GET();
  const body = await response.json();
  expect(body.rows).toHaveLength(2);
  expect(body.disabled).toContain('tasks_groups');
  expect(body.rows.find((row: {feature_id:string}) => row.feature_id === 'ai_plan_day').disabled).toBe(true);
  expect(response.headers.get('Cache-Control')).toContain('public');
});
