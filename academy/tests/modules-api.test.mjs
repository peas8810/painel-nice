import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import * as core from '../supabase/functions/academy-modules/core.mjs';
const source=fs.readFileSync(new URL('../supabase/functions/academy-modules/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',request='00000000-0000-4000-8000-000000000003',evidence='00000000-0000-4000-8000-000000000004';
function harness(){let handler;const tables={academy_requests:[{id:request,user_id:owner,status:'ENVIADA'}],academy_evidence:[{id:evidence,request_id:request,user_id:owner,file_path:owner+'/'+request+'/test.pdf',file_name:'test.pdf'}],academy_flow_sessions:[],academy_share_links:[],academy_admin_members:[],academy_tenant_members:[],academy_regulation_clauses:[],academy_document_integrity:[]};
 const env={SUPABASE_URL:'https://backend.invalid',SUPABASE_SERVICE_ROLE_KEY:'private',SUPABASE_ANON_KEY:'public'};
 vm.runInNewContext(source,{...core,URL,Response,Request,TextEncoder,TextDecoder,crypto,Uint8Array,QRCode:{toDataURL:async()=> 'data:image/png;base64,test'},Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},fetch:async(url,opts={})=>{
  const u=new URL(url);if(u.pathname==='/auth/v1/user'){const user=opts.headers.authorization==='Bearer owner'?owner:opts.headers.authorization==='Bearer other'?other:null;return new Response(JSON.stringify({id:user}),{status:user?200:401});}
  if(u.pathname.startsWith('/storage/'))return new Response('%PDF-test',{headers:{'content-type':'application/pdf'}});
  const table=u.pathname.split('/').at(-1);const rows=tables[table]||[];
  const filtered=rows.filter(row=>[...u.searchParams].every(([key,value])=>{if(['select','order','limit'].includes(key))return true;if(value.startsWith('eq.'))return String(row[key])===value.slice(3);if(value==='is.null')return row[key]==null;if(value.startsWith('gt.'))return row[key]>value.slice(3);return true;}));
  const method=opts.method||'GET';let result=filtered;
  if(method==='POST'){const row={id:crypto.randomUUID(),...JSON.parse(opts.body)};(tables[table]||= []).push(row);result=[row];}
  if(method==='PATCH'){for(const row of filtered)Object.assign(row,JSON.parse(opts.body));}
  return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
 }});
 return {tables,call:async(body,user='owner')=>handler(new Request('https://backend.invalid/functions/v1/academy-modules',{method:'POST',headers:user?{authorization:'Bearer '+user}:{},body:JSON.stringify(body)}))};
}
test('Flow requires owner, same account on resolution and valid expiry',async()=>{
 const h=harness();assert.equal((await h.call({action:'flow_create',request_id:request},'other')).status,404);
 const r=await (await h.call({action:'flow_create',request_id:request})).json();const token=new URL(r.link).hash.slice(6);
 assert.equal((await h.call({action:'flow_resolve',token},'other')).status,404);
 assert.equal((await h.call({action:'flow_resolve',token})).status,200);
 await h.call({action:'flow_revoke',id:r.id});assert.equal((await h.call({action:'flow_resolve',token})).status,404);
});
test('Share enforces owner, expiry and revocation on anonymous download',async()=>{
 const h=harness();assert.equal((await h.call({action:'share_create',kind:'evidence',id:evidence,hours:1},'other')).status,404);
 const r=await (await h.call({action:'share_create',kind:'evidence',id:evidence,hours:1})).json(),token=new URL(r.link).hash.slice(7);
 assert.equal((await h.call({action:'share_download',token},null)).status,200);
 await h.call({action:'share_revoke',id:r.id},'other');assert.equal((await h.call({action:'share_download',token},null)).status,200);
 await h.call({action:'share_revoke',id:r.id});assert.equal((await h.call({action:'share_download',token},null)).status,404);
 const second=await (await h.call({action:'share_create',kind:'evidence',id:evidence,hours:1})).json();h.tables.academy_share_links.at(-1).expires_at='2000-01-01';assert.equal((await h.call({action:'share_download',token:new URL(second.link).hash.slice(7)},null)).status,404);
});
test('SecureDocs hashes actual stored bytes, is idempotent, and rejects another account',async()=>{
 const h=harness();assert.equal((await h.call({action:'document_seal',id:evidence},'other')).status,404);
 const a=await (await h.call({action:'document_seal',id:evidence})).json();assert.equal(a.sha256,await core.hash(new TextEncoder().encode('%PDF-test')));
 await h.call({action:'document_seal',id:evidence});assert.equal(h.tables.academy_document_integrity.length,1);
});
test('institution operations reject unaffiliated and unauthenticated users',async()=>{
 const h=harness();assert.equal((await h.call({action:'team_save',tenant_id:request,user_id:owner,role:'OWNER'})).status,403);
 assert.equal((await h.call({action:'regulations',tenant_id:request})).status,403);
 assert.equal((await h.call({action:'inventory'},null)).status,401);
});
