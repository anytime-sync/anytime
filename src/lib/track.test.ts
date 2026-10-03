import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(()=>({ insert:vi.fn(), user:true }));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({auth:{getUser:async()=>({data:{user:state.user?{id:'owner'}:null}})},from:()=>({insert:state.insert})})}));
import { track, trackPageview } from './track';
beforeEach(()=>{
 vi.clearAllMocks();state.user=true;state.insert.mockResolvedValue({error:null});
 const store = new Map<string,string>([['fl.analyticsEnabled','1']]); const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)};
 vi.stubGlobal('window',{location:{origin:'https://firstlight.to'}});vi.stubGlobal('navigator',{doNotTrack:'0'});vi.stubGlobal('localStorage',storage);vi.stubGlobal('sessionStorage',storage);
});
const settle=()=>new Promise(r=>setTimeout(r,0));
it('records counts but strips task titles, unknown properties and arbitrary strings',async()=>{
 track('activation.saved',{count:3,title:'Private task',source:'private-note'});await settle();
 expect(state.insert).toHaveBeenCalledWith({user_id:'owner',event_name:'activation.saved',properties:{count:3}});
});
it('absolute app routes record one active event per account/day/session',async()=>{
 trackPageview('https://firstlight.to/app/today?private=value');await settle();
 trackPageview('https://firstlight.to/app/next7');await settle();
 expect(state.insert).toHaveBeenCalledTimes(1);
});
it('honors browser do-not-track and ignores unauthenticated visitors',async()=>{
 vi.stubGlobal('navigator',{doNotTrack:'1'});track('activation.saved');await settle();expect(state.insert).not.toHaveBeenCalled();
 vi.stubGlobal('navigator',{doNotTrack:'0'});state.user=false;track('activation.saved');await settle();expect(state.insert).not.toHaveBeenCalled();
});

afterEach(()=>vi.unstubAllGlobals());
it('does not measure usage without explicit opt-in',async()=>{
 localStorage.setItem('fl.analyticsEnabled','0');track('activation.saved');await settle();expect(state.insert).not.toHaveBeenCalled();
});
