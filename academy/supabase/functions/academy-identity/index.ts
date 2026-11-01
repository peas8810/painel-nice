import {PDFDocument,StandardFonts} from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';
import {uuid,phone,snapshot,same,publicSeal,hash,otpHash,otp} from './core.mjs';
const env=k=>Deno.env.get(k)||'',BASE=env('SUPABASE_URL'),SR=env('SUPABASE_SERVICE_ROLE_KEY');
const H={'content-type':'application/json','access-control-allow-origin':'https://www.protocolo.me','access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store','x-content-type-options':'nosniff'};
const out=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:H});
const fail=(m,s=400)=>{throw Object.assign(Error(m),{status:s});};
const authHeaders={apikey:SR,authorization:'Bearer '+SR};
async function db(path,method='GET',body){const r=await fetch(BASE+'/rest/v1/'+path,{method,headers:{...authHeaders,'content-type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)fail('Operação indisponível',409);return r.status===204?null:r.json();}
async function cert(id){if(!uuid(id))fail('Certificado inválido');const c=(await db('academy_certificates?id=eq.'+id))[0];if(!c||c.status!=='EMITIDO'||c.revoked_at||!c.pdf_sha256)fail('Certificado não está disponível',409);const r=(await db('academy_requests?id=eq.'+c.request_id))[0];if(!r||r.status!=='APROVADO')fail('Protocolo não está aprovado',409);const v=await fetch(BASE+'/functions/v1/academy-verify?codigo='+encodeURIComponent(c.certificate_code));if(!v.ok||!(await v.json()).valid)fail('Integridade do certificado não confirmada',409);return {c,r,snap:snapshot(c,r)};}
const event=(s,actor,action)=>db('academy_identity_events','POST',{seal_id:s.id,actor_id:actor,action});
const ready=()=>Boolean(env('META_WHATSAPP_TOKEN')&&env('META_WHATSAPP_PHONE_NUMBER_ID')&&env('ACADEMY_IDENTITY_TEMPLATE')&&/^v\d+\.\d+$/.test(env('META_GRAPH_VERSION'))&&env('ACADEMY_IDENTITY_OTP_SECRET').length>=32);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return out({});if(req.method!=='POST')return out({error:'Use POST'},405);
 try{
 if(Number(req.headers.get('content-length'))>1500000)fail('Foto muito grande',413);const raw=await req.text();if(raw.length>1500000)fail('Foto muito grande',413);const b=JSON.parse(raw);
 if(b.action==='public'){
  if(!uuid(b.id))fail('Selo inválido');const s=(await db('academy_identity_seals?select=id,certificate_id,snapshot,revoked_at,confirmed_at,phone_confirmed_at,review_result,reviewed_at&id=eq.'+b.id))[0];if(!s)fail('Selo não encontrado',404);
  if(s.revoked_at)return out({seal:{id:s.id,status:'REVOGADO'}});const {snap}=await cert(s.certificate_id);return out({seal:publicSeal(s,snap),code:snap.code});
 }
 const authorization=req.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))fail('Entre no portal',401);
 const ur=await fetch(BASE+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),authorization}});if(!ur.ok)fail('Sessão inválida',401);const u=await ur.json();if(!uuid(u.id))fail('Sessão inválida',401);
 const isAdmin=async()=>Boolean((await db('academy_admin_members?select=user_id&enabled=eq.true&role=eq.SUPER_ADMIN&user_id=eq.'+u.id)).length);
 if(b.action==='list'){
  const rows=await db('academy_identity_seals?select=id,certificate_id,phone_confirmed_at,confirmed_at,review_result,revoked_at,created_at,selfie_sha256&owner_id=eq.'+u.id+'&order=created_at.desc');
  return out({seals:rows,whatsapp_ready:ready(),admin:await isAdmin()});
 }
 if(b.action==='queue'){
  if(!await isAdmin())fail('Acesso restrito',403);return out({seals:await db('academy_identity_seals?select=id,snapshot,confirmed_at,review_result&confirmed_at=not.is.null&revoked_at=is.null&order=created_at.desc&limit=100')});
 }
 if(b.action==='create'){
  const {c,r,snap}=await cert(b.certificate_id);if(r.user_id!==u.id)fail('Certificado de outra conta',403);
  const old=(await db('academy_identity_seals?owner_id=eq.'+u.id+'&revoked_at=is.null&certificate_id=eq.'+c.id))[0];if(old)return out({id:old.id,snapshot:old.snapshot});
  const s=(await db('academy_identity_seals','POST',{owner_id:u.id,certificate_id:c.id,snapshot:snap}))[0];await event(s,u.id,'INICIADO');return out({id:s.id,snapshot:snap});
 }
 if(!uuid(b.id))fail('Selo inválido');const s=(await db('academy_identity_seals?id=eq.'+b.id))[0];if(!s)fail('Selo não encontrado',404);
 const administrative=['review','photo'].includes(b.action);if(administrative){if(!await isAdmin())fail('Acesso restrito',403);}else if(s.owner_id!==u.id)fail('Acesso restrito',403);
 const path='academy_identity_seals?id=eq.'+s.id;
 if(b.action==='revoke'){await db(path,'PATCH',{revoked_at:new Date().toISOString(),otp_hash:null,selfie:null,phone:null});await event(s,u.id,'REVOGADO');return out({ok:true});}
 if(s.revoked_at)fail('Selo revogado',409);
 const {c,snap}=await cert(s.certificate_id);if(!same(s.snapshot,snap))fail('Dados alterados: este selo não corresponde ao certificado atual',409);
 if(b.action==='get')return out({id:s.id,snapshot:s.snapshot,seal:publicSeal(s,snap),phone_confirmed:!!s.phone_confirmed_at,selfie_received:!!s.selfie_sha256,events:await db('academy_identity_events?select=action,created_at&seal_id=eq.'+s.id+'&order=created_at.asc')});
 if(b.action==='send'){
  if(!ready())fail('WhatsApp de verificação aguarda configuração do provedor',503);if(b.consent!==true||!phone(b.phone))fail('Autorize o envio e informe telefone com +DDI');
  const code=otp(),digest=await otpHash(env('ACADEMY_IDENTITY_OTP_SECRET'),s.id,code);
  if(!await db('rpc/academy_identity_reserve','POST',{p_id:s.id,p_phone:b.phone,p_hash:digest}))fail('Aguarde 60 segundos ou limite de envios atingido',429);
  const response=await fetch('https://graph.facebook.com/'+env('META_GRAPH_VERSION')+'/'+env('META_WHATSAPP_PHONE_NUMBER_ID')+'/messages',{method:'POST',headers:{authorization:'Bearer '+env('META_WHATSAPP_TOKEN'),'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:b.phone.slice(1),type:'template',template:{name:env('ACADEMY_IDENTITY_TEMPLATE'),language:{code:'pt_BR'},components:[{type:'body',parameters:[{type:'text',text:code}]},{type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:code}]}]}})});
  if(!response.ok){await db(path+'&otp_hash=eq.'+digest,'PATCH',{otp_hash:null});fail('Provedor não aceitou o envio; tente depois',502);}await event(s,u.id,'CODIGO_ENVIADO');return out({sent:true,expires_in:300});
 }
 if(b.action==='check'){
  if(!/^\d{6}$/.test(b.code||'')||!ready())fail('Código inválido ou serviço indisponível');const digest=await otpHash(env('ACADEMY_IDENTITY_OTP_SECRET'),s.id,b.code);
  if(!await db('rpc/academy_identity_check','POST',{p_id:s.id,p_hash:digest}))fail('Código inválido, expirado ou limite de tentativas atingido');return out({verified:true});
 }
 if(b.action==='selfie'){
  if(!s.phone_confirmed_at||s.confirmed_at||b.consent!==true)fail('Confirme o telefone e autorize a foto antes de continuar');
  if(typeof b.image!=='string'||b.image.length>1400000||!b.image.startsWith('data:image/jpeg;base64,'))fail('Envie uma foto JPEG de até 1 MB');
  const binary=Uint8Array.from(atob(b.image.split(',')[1]),c=>c.charCodeAt(0));if(binary.length>1048576||binary[0]!==255||binary[1]!==216||binary[2]!==255)fail('Imagem inválida');
  await db(path+'&confirmed_at=is.null&revoked_at=is.null','PATCH',{selfie:b.image,selfie_sha256:await hash(binary),selfie_expires_at:new Date(Date.now()+30*86400000).toISOString(),review_result:null,reviewed_at:null,reviewed_by:null});await event(s,u.id,'SELFIE_RECEBIDA');return out({ok:true});
 }
 if(b.action==='confirm'){
  if(!s.phone_confirmed_at||!s.selfie||Date.parse(s.selfie_expires_at)<=Date.now()||b.accept!==true)fail('Confirme telefone, envie a selfie e aceite os dados');
  if(!s.confirmed_at){await db(path+'&revoked_at=is.null','PATCH',{confirmed_at:new Date().toISOString()});await event(s,u.id,'DADOS_CONFIRMADOS_PELO_TITULAR');}return out({ok:true});
 }
 if(b.action==='photo'){
  if(!s.selfie||Date.parse(s.selfie_expires_at)<=Date.now())fail('Foto expirada ou removida',410);await event(s,u.id,'FOTO_CONSULTADA_POR_RESPONSAVEL');return out({image:s.selfie});
 }
 if(b.action==='review'){
  if(s.owner_id===u.id)fail('Não é permitido conferir a própria identidade',403);
  if(!s.confirmed_at||!s.selfie||Date.parse(s.selfie_expires_at)<=Date.now()||!['CONFERIDA','RECUSADA'].includes(b.result)||typeof b.note!=='string'||b.note.trim().length<10)fail('Informe resultado e referência da conferência documental');
  const rows=await db(path+'&revoked_at=is.null&selfie_sha256=eq.'+s.selfie_sha256,'PATCH',{review_result:b.result,review_note:b.note.slice(0,1000),reviewed_at:new Date().toISOString(),reviewed_by:u.id});if(!rows.length)fail('Registro mudou; atualize a tela',409);await event(s,u.id,'REVISAO_'+b.result);return out({ok:true});
 }
 if(b.action==='bundle'){
  const seal=publicSeal(s,snap);if(seal.status!=='ATIVO')fail('Confirme os dados antes de baixar');
  const file=await fetch(BASE+'/storage/v1/object/authenticated/academy-certificados/'+c.pdf_path.split('/').map(encodeURIComponent).join('/'),{headers:authHeaders});if(!file.ok)fail('PDF indisponível');const bytes=await file.arrayBuffer();if(await hash(bytes)!==c.pdf_sha256)fail('Integridade do PDF não confirmada',409);
  const doc=await PDFDocument.load(bytes),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([595,842]);
  const lines=['PROTOCOLO ACADEMY | SELO DE VERIFICACAO','Anexo ao certificado '+c.certificate_code,'Registro: '+s.id,'Telefone confirmado pelo codigo de uso unico.','Dados da emissao confirmados pelo titular.',seal.identity==='CONFERIDA_POR_RESPONSAVEL'?'Identidade conferida por responsavel.':'Identidade civil ainda nao conferida.','Confirmacao: '+s.confirmed_at,'Foto e telefone permanecem privados.','Este selo nao comprova participacao na atividade.','Consulte a situacao atual no QR Code.'];
  lines.forEach((t,i)=>page.drawText(t,{x:40,y:780-i*28,size:i===0?16:11,font}));
  const link='https://www.protocolo.me/academy/identidade/?selo='+s.id,qr=await QRCode.toDataURL(link,{width:200,margin:1});const png=Uint8Array.from(atob(qr.split(',')[1]),c=>c.charCodeAt(0));page.drawImage(await doc.embedPng(png),{x:40,y:260,width:150,height:150});
  const latest=(await db(path))[0];if(latest.revoked_at||latest.review_result!==s.review_result)fail('Situação mudou; atualize antes de baixar',409);
  await event(s,u.id,'CERTIFICADO_COM_SELO_BAIXADO');return new Response(await doc.save(),{headers:{...H,'content-type':'application/pdf','content-disposition':'attachment; filename="certificado-com-selo.pdf"'}});
 }
 fail('Operação inválida');
 }catch(e){return out({error:e.status?e.message:'Não foi possível concluir a operação'},e.status||500);}
});
