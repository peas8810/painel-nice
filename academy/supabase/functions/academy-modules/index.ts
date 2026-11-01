import QRCode from 'npm:qrcode@1.5.4';
import {uuid,tokenValid,hash,secret,active,regulationAnswer,signCredential,verifyCredential,unb64} from './core.mjs';
const BASE=Deno.env.get('SUPABASE_URL')||'',SR=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',ANON=Deno.env.get('SUPABASE_ANON_KEY')||'';
const ENDPOINT=BASE+'/functions/v1/academy-modules',SITE='https://www.protocolo.me/academy/';
const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,GET,OPTIONS','cache-control':'no-store','x-content-type-options':'nosniff'};
const out=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function id(x){if(!uuid(x))fail('Identificador inválido');return x;}
async function db(table,query='',method='GET',body){const r=await fetch(BASE+'/rest/v1/'+table+query,{method,headers:{apikey:SR,authorization:'Bearer '+SR,'content-type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)fail('Operação não concluída no banco',409);return r.status===204?[]:await r.json();}
async function session(req){const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))fail('Entre na sua conta',401);const r=await fetch(BASE+'/auth/v1/user',{headers:{apikey:ANON,authorization}});if(!r.ok)fail('Sessão inválida',401);const u=await r.json();if(!uuid(u.id))fail('Sessão inválida',401);return u;}
async function admin(user){return (await db('academy_admin_members','?select=user_id&enabled=eq.true&role=eq.SUPER_ADMIN&user_id=eq.'+user.id)).length>0;}
async function ownedRequest(user,request){const r=(await db('academy_requests','?id=eq.'+id(request)))[0];if(!r||r.user_id!==user.id)fail('Protocolo não localizado nesta conta',404);return r;}
async function tenantAccess(user,tenant){if(await admin(user))return;const m=await db('academy_tenant_members','?tenant_id=eq.'+id(tenant)+'&user_id=eq.'+user.id);if(!m.length)fail('Instituição não vinculada à conta',403);}
async function asset(user,kind,assetId){
 const table=kind==='evidence'?'academy_evidence':kind==='certificate'?'academy_certificates':null;if(!table)fail('Tipo inválido');
 const row=(await db(table,'?id=eq.'+id(assetId)))[0];if(!row)fail('Documento não encontrado',404);
 const request=await ownedRequest(user,row.request_id);
 if(kind==='certificate'&&(row.status!=='EMITIDO'||!row.pdf_path))fail('Certificado não está ativo',409);
 return {row,request,bucket:kind==='evidence'?'academy-evidencias':'academy-certificados',path:kind==='evidence'?row.file_path:row.pdf_path};
}
async function bytes(bucket,path){const r=await fetch(BASE+'/storage/v1/object/authenticated/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:SR,authorization:'Bearer '+SR}});if(!r.ok)fail('Arquivo indisponível',404);const size=Number(r.headers.get('content-length'));if(size>10485760)fail('Arquivo maior que 10 MB',413);const b=await r.arrayBuffer();if(b.byteLength>10485760)fail('Arquivo maior que 10 MB',413);return {data:b,mime:r.headers.get('content-type')||'application/octet-stream'};}
async function publishedRules(user,tenant){await tenantAccess(user,tenant);const day=new Date().toISOString().slice(0,10);return (await db('academy_regulation_clauses','?tenant_id=eq.'+id(tenant)+'&published=eq.true&valid_from=lte.'+day+'&order=created_at.desc')).filter(x=>!x.valid_until||x.valid_until>=day);}
async function certificateActive(cert){
 if(!cert||cert.status!=='EMITIDO'||cert.revoked_at)return false;
 const [r,p]=await Promise.all([db('academy_requests','?select=status&id=eq.'+cert.request_id),db('academy_payment_releases','?select=payment_status&request_id=eq.'+cert.request_id)]);
 return r[0]?.status==='APROVADO'&&p[0]?.payment_status==='PAGO_CONFIRMADO';
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return out({});
 try{
 const url=new URL(req.url);
 if(req.method==='GET'&&url.searchParams.get('resource')==='jwks'){
  const rows=await db('academy_credential_keys','?select=kid,public_jwk');return out({keys:rows.map(x=>({...x.public_jwk,kid:ENDPOINT+'?resource=key&id='+x.kid,use:'sig',alg:'ES256'}))});
 }
 if(req.method==='GET'&&url.searchParams.get('resource')==='key'){
  const k=(await db('academy_credential_keys','?select=kid,public_jwk,revoked_at&kid=eq.'+id(url.searchParams.get('id'))))[0];if(!k)fail('Chave não encontrada',404);return out({...k.public_jwk,kid:ENDPOINT+'?resource=key&id='+k.kid,use:'sig',alg:'ES256'});
 }
 if(req.method!=='POST')return out({issuer:SITE,jwks:ENDPOINT+'?resource=jwks',verification:'POST action=credential_verify'});
 if(Number(req.headers.get('content-length'))>65536)fail('Requisição muito grande',413);
 const raw=await req.text();if(raw.length>65536)fail('Requisição muito grande',413);let b;try{b=JSON.parse(raw);}catch{fail('JSON inválido');}
 if(b.action==='share_download'){
  if(!tokenValid(b.token))fail('Link inválido ou expirado',404);
  const row=(await db('academy_share_links','?token_hash=eq.'+await hash(b.token)))[0];if(!active(row))fail('Link inválido, expirado ou revogado',404);
  const a=await asset({id:row.owner_id},row.evidence_id?'evidence':'certificate',row.evidence_id||row.certificate_id);
  if(row.certificate_id&&!await certificateActive(a.row))fail('Certificado não está ativo',409);
  const file=await bytes(a.bucket,a.path);
  const latest=(await db('academy_share_links','?id=eq.'+row.id))[0];if(!active(latest))fail('Link revogado ou expirado',404);
  const filename=(a.row.file_name||'certificado.pdf').replace(/[^\p{L}\p{N}._-]/gu,'_');
  return new Response(file.data,{headers:{...headers,'content-type':file.mime,'content-disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(filename)}});
 }
 if(b.action==='credential_verify'){
  if(typeof b.jwt!=='string'||b.jwt.length>40000)fail('Credencial inválida');
  let payload,header;try{header=JSON.parse(new TextDecoder().decode(unb64(b.jwt.split('.')[0])));payload=JSON.parse(new TextDecoder().decode(unb64(b.jwt.split('.')[1])));}catch{fail('Credencial inválida');}
  const kid=String(header.kid||'').split('&id=')[1];if(!uuid(kid))return out({valid:false});
  const k=(await db('academy_credential_keys','?select=kid,public_jwk,revoked_at&kid=eq.'+kid))[0];
  if(!k||k.revoked_at||!await verifyCredential(b.jwt,k.public_jwk,ENDPOINT+'?resource=key&id='+kid,SITE))return out({valid:false});
  const credentialId=String(payload.id||'').replace('urn:uuid:','');if(!uuid(credentialId))return out({valid:false});
  const row=(await db('academy_verifiable_credentials','?id=eq.'+credentialId))[0];
  const c=row?(await db('academy_certificates','?id=eq.'+row.certificate_id))[0]:null;
  return out({valid:Boolean(row&&!row.revoked_at&&row.jwt===b.jwt&&await certificateActive(c)),signature_valid:true,issuer:SITE,credential:payload});
 }
 const user=await session(req);
 if(b.action==='inventory'){
  const requests=await db('academy_requests','?user_id=eq.'+user.id+'&order=created_at.desc&limit=100');
  const members=await db('academy_tenant_members','?user_id=eq.'+user.id);
  const institutions=members.length?await db('academy_tenants','?select=id,name&id=in.('+members.map(x=>x.tenant_id).join(',')+')'):[];
  return out({requests,evidence:await db('academy_evidence','?user_id=eq.'+user.id+'&order=created_at.desc&limit=100'),certificates:requests.length?await db('academy_certificates','?request_id=in.('+requests.map(x=>x.id).join(',')+')'):[],institutions,shares:await db('academy_share_links','?select=id,evidence_id,certificate_id,expires_at,revoked_at&owner_id=eq.'+user.id+'&order=created_at.desc&limit=100')});
 }
 if(b.action==='flow_create'){
  const r=await ownedRequest(user,b.request_id);if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(r.status))fail('Protocolo encerrado',409);
  const sessions=await db('academy_flow_sessions','?owner_id=eq.'+user.id+'&revoked_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));if(sessions.length>=10)fail('Encerre um vínculo ou aguarde sua expiração',429);
  const token=secret(),expires_at=new Date(Date.now()+15*60000).toISOString();
  const row=(await db('academy_flow_sessions','','POST',{owner_id:user.id,request_id:r.id,token_hash:await hash(token),expires_at}))[0];
  const link=SITE+'modules/#flow='+token;return out({id:row.id,link,expires_at,qr:await QRCode.toDataURL(link,{width:320,margin:2})});
 }
 if(b.action==='flow_resolve'){
  if(!tokenValid(b.token))fail('Vínculo inválido',404);
  const row=(await db('academy_flow_sessions','?token_hash=eq.'+await hash(b.token)+'&owner_id=eq.'+user.id))[0];if(!active(row))fail('Vínculo expirado ou de outra conta',404);
  const request=await ownedRequest(user,row.request_id);return out({request,session_id:row.id});
 }
 if(b.action==='flow_revoke'){await db('academy_flow_sessions','?id=eq.'+id(b.id)+'&owner_id=eq.'+user.id,'PATCH',{revoked_at:new Date().toISOString()});return out({ok:true});}
 if(b.action==='document_seal'||b.action==='document_history'){
  const a=await asset(user,'evidence',b.id);
  if(b.action==='document_seal'){
   const file=await bytes(a.bucket,a.path),digest=await hash(file.data);
   const previous=await db('academy_document_integrity','?evidence_id=eq.'+a.row.id+'&sha256=eq.'+digest);
   if(!previous.length){try{await db('academy_document_integrity','','POST',{evidence_id:a.row.id,sha256:digest,size_bytes:file.data.byteLength,recorded_by:user.id});}catch(e){if(!(await db('academy_document_integrity','?evidence_id=eq.'+a.row.id+'&sha256=eq.'+digest)).length)throw e;}}
   return out({sha256:digest,size_bytes:file.data.byteLength,meaning:'Identifica os bytes recebidos; não comprova autenticidade do conteúdo.'});
  }
  return out({integrity:await db('academy_document_integrity','?evidence_id=eq.'+a.row.id+'&order=created_at'),history:await db('academy_document_history','?select=action,actor_id,details,created_at&evidence_id=eq.'+a.row.id+'&order=id')});
 }
 if(b.action==='share_create'){
  const a=await asset(user,b.kind,b.id);const hours=Number(b.hours);if(!Number.isInteger(hours)||hours<1||hours>168)fail('Validade deve ser de 1 a 168 horas');
  const links=await db('academy_share_links','?select=id&owner_id=eq.'+user.id+'&revoked_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString()));if(links.length>=100)fail('Revogue links antigos antes de criar novos',429);
  const token=secret(),expires_at=new Date(Date.now()+hours*3600000).toISOString();
  const row=(await db('academy_share_links','','POST',{owner_id:user.id,[b.kind==='evidence'?'evidence_id':'certificate_id']:a.row.id,token_hash:await hash(token),expires_at}))[0];
  return out({id:row.id,link:SITE+'share/#token='+token,expires_at});
 }
 if(b.action==='share_revoke'){await db('academy_share_links','?id=eq.'+id(b.id)+'&owner_id=eq.'+user.id,'PATCH',{revoked_at:new Date().toISOString()});return out({ok:true});}
 if(b.action==='copilot'){
  if(typeof b.category!=='string'||b.category.length>120||typeof(b.question||'')!=='string'||(b.question||'').length>1000)fail('Consulta inválida');
  const rows=await publishedRules(user,b.tenant_id);return out(regulationAnswer(rows,b.category,Number(b.hours),b.question));
 }
 if(b.action==='regulations'){return out({rules:await publishedRules(user,b.tenant_id)});}
 if(b.action==='credential_issue'){
  const a=await asset(user,'certificate',b.id);if(!await certificateActive(a.row))fail('Certificado sem aprovação/pagamento vigente',409);
  const publicCheck=await fetch(BASE+'/functions/v1/academy-verify?codigo='+encodeURIComponent(a.row.certificate_code));if(!publicCheck.ok||!(await publicCheck.json()).valid)fail('Integridade do certificado não confirmada',409);
  const existing=(await db('academy_verifiable_credentials','?certificate_id=eq.'+a.row.id))[0];if(existing){if(existing.revoked_at)fail('Credencial revogada',409);return out({jwt:existing.jwt});}
  let key=(await db('academy_credential_keys','?active=eq.true'))[0];
  if(!key){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const record={private_jwk:await crypto.subtle.exportKey('jwk',pair.privateKey),public_jwk:await crypto.subtle.exportKey('jwk',pair.publicKey)};try{key=(await db('academy_credential_keys','','POST',record))[0];}catch{key=(await db('academy_credential_keys','?active=eq.true'))[0];}if(!key)fail('Assinatura indisponível',503);}
  const credentialId=crypto.randomUUID();const payload={'@context':['https://www.w3.org/ns/credentials/v2'],id:'urn:uuid:'+credentialId,type:['VerifiableCredential'],issuer:SITE,validFrom:new Date().toISOString(),name:'Verificação documental Academy — homologação',description:'Verificação documental independente. Não garante reconhecimento acadêmico por terceiros. Credencial de homologação.',credentialSubject:{id:'urn:uuid:'+crypto.randomUUID(),name:a.request.activity,description:a.request.hours_verified+' horas verificadas; período '+a.request.start_date+' a '+a.request.end_date},evidence:[{id:SITE+'validar/?codigo='+a.row.certificate_code,type:['https://schema.org/DigitalDocument']}]};
  const jwt=await signCredential(payload,key.private_jwk,ENDPOINT+'?resource=key&id='+key.kid);
  try{await db('academy_verifiable_credentials','','POST',{id:credentialId,certificate_id:a.row.id,owner_id:user.id,kid:key.kid,jwt});return out({jwt});}catch{const winner=(await db('academy_verifiable_credentials','?certificate_id=eq.'+a.row.id))[0];if(!winner||winner.revoked_at)fail('Emissão não concluída',409);return out({jwt:winner.jwt});}
 }
 if(b.action==='key_list'){if(!await admin(user))fail('Acesso restrito',403);return out({keys:await db('academy_credential_keys','?select=kid,active,revoked_at,created_at')});}
 if(b.action==='key_rotate'){
  if(!await admin(user))fail('Acesso restrito',403);
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const kid=await db('rpc/academy_rotate_credential_key','','POST',{p_private:await crypto.subtle.exportKey('jwk',pair.privateKey),p_public:await crypto.subtle.exportKey('jwk',pair.publicKey)});
  return out({kid});
 }
 if(b.action==='key_revoke'){if(!await admin(user))fail('Acesso restrito',403);await db('academy_credential_keys','?kid=eq.'+id(b.id),'PATCH',{active:false,revoked_at:new Date().toISOString(),private_jwk:null});return out({ok:true});}
 if(b.action==='credential_revoke'){await db('academy_verifiable_credentials','?certificate_id=eq.'+id(b.id)+'&owner_id=eq.'+user.id,'PATCH',{revoked_at:new Date().toISOString()});return out({ok:true});}
 if(!await admin(user))fail('Acesso administrativo necessário',403);
 if(b.action==='team_list')return out({members:await db('academy_tenant_members','?tenant_id=eq.'+id(b.tenant_id))});
 if(b.action==='team_save'){
  const tenant=id(b.tenant_id),member=id(b.user_id);if(!['OWNER','MANAGER','REVIEWER','STUDENT'].includes(b.role))fail('Papel inválido');
  const rows=await db('academy_tenant_members','?tenant_id=eq.'+tenant+'&user_id=eq.'+member);
  if(rows.length)await db('academy_tenant_members','?tenant_id=eq.'+tenant+'&user_id=eq.'+member,'PATCH',{role:b.role});else await db('academy_tenant_members','','POST',{tenant_id:tenant,user_id:member,role:b.role});
  await db('academy_event_log','','POST',{event_type:'EQUIPE_ATUALIZADA',actor_id:user.id,metadata:{tenant_id:tenant,user_id:member,role:b.role}});return out({ok:true});
 }
 if(b.action==='team_remove'){const tenant=id(b.tenant_id),member=id(b.user_id);await db('academy_tenant_members','?tenant_id=eq.'+tenant+'&user_id=eq.'+member,'DELETE');await db('academy_event_log','','POST',{event_type:'EQUIPE_REMOVIDA',actor_id:user.id,metadata:{tenant_id:tenant,user_id:member}});return out({ok:true});}
 if(b.action==='regulation_publish'){
  const r=b.rule;if(!r||typeof r.source_url!=='string'||!r.source_url.startsWith('https://'))fail('Fonte HTTPS obrigatória');
  const record={tenant_id:id(r.tenant_id),category:r.category,title:r.title,version:r.version,clause_text:r.clause_text,source_url:r.source_url,max_hours:r.max_hours||null,valid_from:r.valid_from,valid_until:r.valid_until||null,published:true,created_by:user.id};
  return out({rule:(await db('academy_regulation_clauses','','POST',record))[0]});
 }
 if(b.action==='regulation_unpublish'){await db('academy_regulation_clauses','?id=eq.'+id(b.id),'PATCH',{published:false});return out({ok:true});}
 if(b.action==='preliminary'){
  const r=(await db('academy_requests','?id=eq.'+id(b.request_id)))[0];if(!r)fail('Protocolo inexistente',404);
  const binding=(await db('academy_request_institutions','?request_id=eq.'+r.id))[0];if(!binding)fail('Vincule a instituição antes da análise',409);
  const rules=await publishedRules(user,binding.tenant_id),evidence=await db('academy_evidence','?request_id=eq.'+r.id);
  return out({request_id:r.id,declared_hours:r.hours_declared,evidence_count:evidence.length,pending_evidence:evidence.filter(x=>x.review_status!=='VALIDADO').length,...regulationAnswer(rules,r.activity_type,Number(r.hours_declared)),decision:'Requer análise humana'});
 }
 fail('Operação desconhecida',404);
 }catch(e){return out({error:e.status?e.message:'Serviço temporariamente indisponível'},e.status||500);}
});
