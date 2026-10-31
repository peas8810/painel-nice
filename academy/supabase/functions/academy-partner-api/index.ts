const SB=Deno.env.get('SUPABASE_URL')||'',SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'x-academy-key,content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
const send=(status,body)=>new Response(JSON.stringify(body),{status,headers});
async function rest(path,method='GET',body){
 const res=await fetch(SB+'/rest/v1/'+path,{method,headers:{'apikey':SERVICE,'authorization':'Bearer '+SERVICE,'content-type':'application/json','prefer':'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await res.text();if(!res.ok)throw Error('Database request rejected ('+res.status+')');
 return text?JSON.parse(text):null;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(req.method))return send(405,{error:'method_not_allowed'});
 if(!SB||!SERVICE)return send(503,{error:'service_not_configured'});
 const key=req.headers.get('x-academy-key')||'';
 if(!/^aca_live_[a-f0-9]{64}$/.test(key))return send(401,{error:'invalid_api_key'});
 try{
  const url=new URL(req.url);
  const path=url.pathname.replace(/\/+$/,'');
  const isCreate=path.endsWith('/v1/issuance-requests')&&req.method==='POST';
  const isGet=path.match(/\/v1\/issuance-requests\/([a-f0-9-]{36})$/)&&req.method==='GET';
  if(!isCreate&&!isGet)return send(404,{error:'unknown_endpoint'});
  const session=await rest('rpc/academy_api_authorize','POST',{p_key:key,p_scope:isCreate?'requests:create':'requests:read'});
  if(!session)return send(403,{error:'invalid_scope_or_inactive_institution'});
  if(isCreate){
   const contentLength=Number(req.headers.get('content-length')||0);
   if(contentLength>16384)return send(413,{error:'payload_too_large'});
   const raw=await req.text();if(raw.length>16384)return send(413,{error:'payload_too_large'});
   let p;try{p=JSON.parse(raw)}catch{return send(400,{error:'invalid_json'})}
   if(!p||typeof p!=='object'||Array.isArray(p))return send(400,{error:'invalid_payload'});
   const string=(name,max)=>typeof p[name]==='string'&&p[name].trim().length<=max?p[name].trim():null;
   const external_id=string('external_id',120),student_name=string('student_name',200),student_email=string('student_email',320),activity=string('activity',180);
   const hours=Number(p.hours);
   const date=v=>v==null||v===''?null:/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))?v:undefined;
   const start_date=date(p.start_date),end_date=date(p.end_date);
   if(!external_id||external_id.length>120||!student_name||student_name.length<2||!student_email||!/^\S+@\S+\.\S+$/.test(student_email)||!activity||activity.length<3||!Number.isFinite(hours)||hours<=0||hours>1000||start_date===undefined||end_date===undefined||(start_date&&end_date&&end_date<start_date))return send(422,{error:'validation_failed',required:['external_id','student_name','student_email','activity','hours']});
   const metadata=p.metadata&&typeof p.metadata==='object'&&!Array.isArray(p.metadata)?p.metadata:{};
   if(JSON.stringify(metadata).length>4000)return send(422,{error:'metadata_too_large'});
   const created=await rest('rpc/academy_api_submit_request','POST',{p_key_id:session.key_id,p_tenant_id:session.tenant_id,p_external_id:external_id,p_student_name:student_name,p_student_email:student_email,p_activity:activity,p_hours:hours,p_start_date:start_date,p_end_date:end_date,p_metadata:metadata});
   if(!created?.id)return send(500,{error:'creation_failed'});
   return send(created.created?202:200,{id:created.id,external_id:created.external_id,status:created.status,created_at:created.created_at,idempotent:!created.created,message:'Recebido para análise. Nenhum certificado foi emitido.'});
  }
  const id=isGet[1];
  const rows=await rest('academy_external_requests?select=id,external_id,status,certificate_code,created_at,updated_at&tenant_id=eq.'+encodeURIComponent(session.tenant_id)+'&id=eq.'+encodeURIComponent(id));
  if(!rows?.length)return send(404,{error:'not_found'});
  return send(200,rows[0]);
 }catch(e){
  const msg=String(e?.message||e);
  if(msg.includes('Limite de requisições'))return send(429,{error:'rate_limit'});
  if(msg.includes('Conflicting duplicate external_id'))return send(409,{error:'conflicting_external_id'});
  return send(500,{error:'internal_error'});
 }
});