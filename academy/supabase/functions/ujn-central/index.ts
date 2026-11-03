import {authenticated} from '../academy-chat/backend.ts';
import {api,rpc,id,esc,agent,contact,conversation,incoming,flush,dispatch,hash,BASE,boundedBytes} from './shared.ts';
import {SERVICES,validQuestions} from './engine.mjs';
const headers={'content-type':'application/json','access-control-allow-origin':'https://www.protocolo.me','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store'};
const out=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return out({error:'Método inválido'},405);
 let u;try{u=await authenticated(req);}catch{return out({error:'Entre na sua conta.'},401);}
 try{
 let b:any,file:any;const type=req.headers.get('content-type')||'';
 if(type.includes('multipart/form-data')){const bytes=await boundedBytes(new Response(req.body,{headers:req.headers}),10600000),form=await new Response(bytes,{headers:{'content-type':type}}).formData();b={action:'message',service:form.get('service'),event_id:form.get('event_id'),text:''};const f=form.get('file');if(!(f instanceof File))throw Error('Escolha um arquivo.');file={name:f.name,bytes:async()=>new Uint8Array(await f.arrayBuffer())};}
 else b=JSON.parse(new TextDecoder().decode(await boundedBytes(new Response(req.body,{headers:req.headers}),24000)));
 const uid=u.id,superuser=await agent(uid);
 const allowed=superuser?Object.keys(SERVICES):(await api('/rest/v1/ujn_agents?select=service_id&user_id=eq.'+uid+'&enabled=eq.true')).map((r:any)=>r.service_id);
 const access=async(cid:string)=>{const c=await conversation(cid);if(allowed.includes(c.service_id))return {c,operator:true};const owner=(await api('/rest/v1/ujn_contacts?select=user_id&id=eq.'+c.contact_id))[0];if(owner?.user_id!==uid)throw Error('Acesso restrito.');return {c,operator:false};};
 if(b.action==='bootstrap')return out({services:await api('/rest/v1/ujn_services?select=id,name,welcome,knowledge&enabled=eq.true'),allowed,superuser,user_id:uid});
 if(b.action==='list'){
  const columns='id,service_id,state,assigned_to,revision,created_at,updated_at';
  if(b.operator){if(!allowed.length)throw Error('Acesso restrito.');return out({conversations:await api('/rest/v1/ujn_conversations?select='+columns+'&service_id=in.('+allowed.join(',')+')&order=updated_at.desc&limit=200')});}
  const cid=await contact(uid);return out({conversations:await api('/rest/v1/ujn_conversations?select='+columns+'&contact_id=eq.'+cid+'&order=updated_at.desc&limit=100')});
 }
 if(b.action==='detail'){
  const {c,operator}=await access(id(b.id));const msgs=await api('/rest/v1/ujn_messages?select=id,sender,body,payload,created_at&conversation_id=eq.'+c.id+(operator?'':'&sender=neq.NOTE')+'&order=created_at.desc&limit=100');
  const attachments=await api('/rest/v1/ujn_attachments?select=id,file_name,mime,created_at&conversation_id=eq.'+c.id+'&order=created_at.asc');
  const deliveries=operator&&msgs.length?await api('/rest/v1/ujn_outbox?select=id,message_id,state,attempts,error&message_id=in.('+msgs.map((x:any)=>x.id).join(',')+')'):[];
  return out({conversation:{id:c.id,service_id:c.service_id,state:c.state,assigned_to:c.assigned_to,revision:c.revision},messages:msgs.reverse(),attachments,deliveries,operator});
 }
 if(b.action==='file'){
  const a=(await api('/rest/v1/ujn_attachments?select=*&id=eq.'+id(b.id)))[0];if(!a)throw Error('Arquivo não encontrado.');await access(a.conversation_id);
  const r=await api('/storage/v1/object/sign/ujn-atendimento/'+a.file_path,'POST',{expiresIn:300}),path=r.signedURL||r.signedUrl;if(!path?.startsWith('/object/sign/'))throw Error('Arquivo indisponível.');return out({url:BASE+'/storage/v1'+path});
 }
 if(b.action==='message'){
  id(b.event_id);if(typeof b.text!=='string'||b.text.length>2500)throw Error('Mensagem muito longa.');const cid=await contact(uid);
  const result=await incoming(cid,b.service,'web:'+uid+':'+b.event_id,b.text,uid,null,file);return out(result);
 }
 if(b.action==='operator'){
  const result=await rpc('ujn_operator_action',{p_user:uid,p_id:id(b.id),p_action:b.operation,p_revision:Number(b.revision),p_text:String(b.text||''),p_target:b.target||null,p_event:'agent:'+uid+':'+id(b.event_id)});await flush(b.id);return out(result);
 }
 if(b.action==='retry'){
  const o=(await api('/rest/v1/ujn_outbox?select=message_id&id=eq.'+id(b.id)))[0];if(!o)throw Error('Envio não encontrado.');const m=(await api('/rest/v1/ujn_messages?select=conversation_id&id=eq.'+o.message_id))[0];const {c,operator}=await access(m.conversation_id);if(!operator||(!superuser&&c.assigned_to!==uid))throw Error('Somente responsável pode reenviar.');return out(await dispatch(b.id));
 }
 if(b.action==='link'){
  const channels=await api('/rest/v1/ujn_channels?select=id&enabled=eq.true&limit=1');if(!channels.length)throw Error('WhatsApp ainda não ativado. Continue pelo site.');
  const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');await api('/rest/v1/academy_chat_links?user_id=eq.'+uid,'DELETE');await api('/rest/v1/academy_chat_links','POST',{user_id:uid,token_hash:await hash(token),token_expires:new Date(Date.now()+600000).toISOString()});return out({command:'VINCULAR '+token,expires_minutes:10});
 }
 if(b.action==='unlink'){await api('/rest/v1/academy_chat_links?user_id=eq.'+uid,'DELETE');return out({ok:true});}
 if(!superuser)throw Error('Acesso restrito.');
 if(b.action==='settings')return out({channels:await api('/rest/v1/ujn_channels?select=*'),agents:await api('/rest/v1/ujn_agents?select=*'),flows:await api('/rest/v1/ujn_services?select=*'),connectors:await api('/rest/v1/ujn_connectors?select=*')});
 if(b.action==='channel_save')return out({id:await rpc('ujn_channel_save',{p_user:uid,p_id:b.id?id(b.id):null,p_data:b.data,p_secrets:b.secrets||{}})});
 if(b.action==='agent_save'){if(!Object.hasOwn(SERVICES,b.service)||typeof b.email!=='string')throw Error('Dados inválidos.');return out({id:await rpc('ujn_agent_save',{p_user:uid,p_email:b.email,p_service:b.service,p_enabled:b.enabled===true})});}
 if(b.action==='flow_save'){
  if(!Object.hasOwn(SERVICES,b.service)||typeof b.welcome!=='string'||b.welcome.length<5||b.welcome.length>2000||typeof b.knowledge!=='string'||b.knowledge.length>8000)throw Error('Texto inválido.');validQuestions(b.questions);
  const old=(await api('/rest/v1/ujn_services?select=version&id=eq.'+b.service))[0];if(old.version!==b.version)throw Error('Outra pessoa alterou o fluxo. Atualize a página.');
  const changed=await api('/rest/v1/ujn_services?id=eq.'+b.service+'&version=eq.'+b.version,'PATCH',{welcome:b.welcome,knowledge:b.knowledge,questions:b.service==='academy'?[]:b.questions,version:old.version+1});if(!changed.length)throw Error('Conflito ao salvar. Atualize.');
  await api('/rest/v1/ujn_audit','POST',{actor_id:uid,action:'FLOW_SAVED',detail:{service:b.service,version:old.version+1}});return out({ok:true});
 }
 if(b.action==='connector_save'){
  const url=new URL(b.base_url);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Informe uma URL HTTPS sem credenciais.');
  await api('/rest/v1/ujn_connectors?id=eq.articlerun','PATCH',{base_url:url.href,contract_note:String(b.note||'').slice(0,4000),mode:'DISABLED',updated_at:new Date().toISOString()});return out({ok:true});
 }
 return out({error:'Ação inválida'},400);
 }catch(e){const busy=e.message==='BUSY',rate=e.message==='RATE_LIMIT';return out({error:busy?'Uma mensagem está sendo processada. Aguarde e tente novamente.':rate?'Limite de mensagens atingido. Tente mais tarde.':String(e.message||'Não foi possível concluir.').slice(0,240)},busy?409:rate?429:400);}
});
