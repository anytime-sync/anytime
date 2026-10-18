import { beforeEach,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({user:{id:'owner'} as {id:string}|null,results:{} as Record<string,any>,calls:[] as unknown[][],allowed:true,model:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:state.user}})},from:(table:string)=>{
  const chain:any={then:(resolve:any)=>Promise.resolve(state.results[table]??{data:null,error:null}).then(resolve)};
  for(const method of ['select','eq','neq','is','or','order','limit','gt','lt','in','upsert','maybeSingle']) chain[method]=(...args:unknown[])=>{state.calls.push([table,method,...args]);return chain;};
  return chain;
}})}));
vi.mock('@/lib/billing',()=>({getUserPlan:async()=> 'pro'}));
vi.mock('@/lib/feature-flags',()=>({canUseFeature:async()=>state.allowed}));
vi.mock('@/lib/anthropic',()=>({MODELS:{fast:'test'},getAnthropic:()=>({messages:{create:state.model}})}));
vi.mock('@/lib/ai-rate-limit',()=>({checkAiBudget:async()=>({ok:true}),logAiCall:async()=>{}}));
import { POST as findTime } from '@/app/api/ai/find-time/route';
import { POST as brief } from '@/app/api/ai/action-brief/route';
import { POST as meeting } from '@/app/api/ai/prep-meeting/route';
const id='11111111-1111-4111-8111-111111111111';
const request=(body:unknown)=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{state.user={id:'owner'};state.allowed=true;state.results={};state.calls=[];state.model.mockReset();});
for (const [name, handler] of [['brief', brief], ['meeting', meeting], ['find time', findTime]] as const) {
  it(`retires ${name} without source reads or provider calls, regardless of authentication`, async () => {
    for (const user of [null, { id: 'owner' }]) {
      state.user = user;
      const response = await handler(request({ task_id: id, tz: 'UTC' }));
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ error: 'feature_retired' });
      expect(state.calls).toEqual([]);
      expect(state.model).not.toHaveBeenCalled();
    }
  });
}
