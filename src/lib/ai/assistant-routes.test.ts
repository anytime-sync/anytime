import { beforeEach,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({user:{id:'owner'} as {id:string}|null,results:{} as Record<string,any>,calls:[] as unknown[][],model:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:state.user}})},from:(table:string)=>{
  const chain:any={then:(resolve:any)=>Promise.resolve(state.results[table]??{data:null,error:null}).then(resolve)};
  for(const method of ['select','eq','neq','is','or','order','limit','gt','lt','in','upsert','maybeSingle']) chain[method]=(...args:unknown[])=>{state.calls.push([table,method,...args]);return chain;};
  return chain;
}})}));
vi.mock('@/lib/anthropic',()=>({MODELS:{fast:'test'},getAnthropic:()=>({messages:{create:state.model}})}));
vi.mock('@/lib/ai-rate-limit',()=>({checkAiBudget:async()=>({ok:true}),logAiCall:async()=>{}}));
import { POST as brief } from '@/app/api/ai/action-brief/route';
import { POST as meeting } from '@/app/api/ai/prep-meeting/route';
const id='11111111-1111-4111-8111-111111111111';
const request=(body:unknown)=>new Request('http://localhost/api',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{state.user={id:'owner'};state.results={};state.calls=[];state.model.mockReset();});
it('requires authentication before reading sources or calling the model',async()=>{
  state.user=null;expect((await brief(request({}))).status).toBe(401);expect(state.calls).toEqual([]);expect(state.model).not.toHaveBeenCalled();
});
it('fails closed when one source query fails',async()=>{
  state.results.tasks={data:null,error:{message:'offline'}};
  expect((await brief(request({tz:'UTC'}))).status).toBe(503);expect(state.model).not.toHaveBeenCalled();
});
it('does not charge a model call for an empty source set',async()=>{
  state.results.tasks={data:[],error:null};state.results.calendar_events={data:[],error:null};
  const response=await brief(request({tz:'UTC'}));expect(response.status).toBe(200);expect(state.model).not.toHaveBeenCalled();
  expect(state.calls).toContainEqual(['tasks','eq','user_id','owner']);expect(state.calls).toContainEqual(['calendar_events','eq','user_id','owner']);
});
it('rejects inaccessible meeting tasks before reading notes or calling AI',async()=>{
  state.results.tasks={data:null,error:null};expect((await meeting(request({task_id:id}))).status).toBe(404);
  expect(state.calls).toContainEqual(['tasks','eq','user_id','owner']);expect(state.model).not.toHaveBeenCalled();
});
it('uses saved meeting evidence, ignores spoofed client notes, and exposes citations',async()=>{
  state.results.tasks={data:{id,title:'Saved meeting',notes:'Verified saved context',project_id:null,due_at:null},error:null};
  state.results.notes={data:[],error:null};
  state.model.mockResolvedValue({model:'test',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify({actions:[{title:'Review evidence',why:'Recorded context',nextAction:'Verify the outcome',sourceIds:[`task:${id}`]}],missingContext:[]})}]});
  const response=await meeting(request({task_id:id,title:'Spoofed',notes:'Do not use me'}));expect(response.status).toBe(200);
  const sent=state.model.mock.calls[0][0].messages[0].content;expect(sent).toContain('Verified saved context');expect(sent).not.toContain('Do not use me');
  expect((await response.json()).sources[0].id).toBe(`task:${id}`);
});
