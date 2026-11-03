import test from 'node:test';import assert from 'node:assert/strict';
let handler;globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://db.invalid':'test-key'},serve:f=>handler=f};
await import('../supabase/functions/ujn-central/index.ts');
const uid='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222';
const ok=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
function mock(extra){globalThis.fetch=async(url,options)=>{const p=new URL(url).pathname;if(p==='/auth/v1/user')return ok({id:uid});if(p==='/rest/v1/rpc/ujn_super')return ok(false);if(p==='/rest/v1/ujn_agents')return ok([]);return extra(new URL(url),options);};}
const request=b=>new Request('https://central.invalid',{method:'POST',headers:{authorization:'Bearer session','content-type':'application/json'},body:JSON.stringify(b)});
test('central rejects unauthenticated requests',async()=>{const r=await handler(new Request('https://central.invalid',{method:'POST',body:'{}'}));assert.equal(r.status,401);});
test('customer cannot read administrator configuration',async()=>{mock(()=>{throw Error('Unexpected data access');});const r=await handler(request({action:'settings'}));assert.equal(r.status,400);assert.match((await r.json()).error,/Acesso restrito/);});
test('customer cannot read another contact conversation',async()=>{mock(u=>u.pathname.endsWith('ujn_conversations')?ok([{id:cid,service_id:'academy',contact_id:cid}]):ok([{user_id:cid}]));const r=await handler(request({action:'detail',id:cid}));assert.equal(r.status,400);assert.match((await r.json()).error,/Acesso restrito/);});
test('customer history excludes internal notes',async()=>{let filtered=false;mock(u=>{if(u.pathname.endsWith('ujn_conversations'))return ok([{id:cid,service_id:'academy',contact_id:cid}]);if(u.pathname.endsWith('ujn_contacts'))return ok([{user_id:uid}]);if(u.pathname.endsWith('ujn_messages')){filtered=u.searchParams.get('sender')==='neq.NOTE';return ok([]);}return ok([]);});const r=await handler(request({action:'detail',id:cid}));assert.equal(r.status,200);assert.equal(filtered,true);assert.equal((await r.json()).operator,false);});
