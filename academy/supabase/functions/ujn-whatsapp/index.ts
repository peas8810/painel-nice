import {api,rpc,hash,boundedBytes,contact,incoming,flush,esc,id} from '../ujn-central/shared.ts';
import {resolveService,SERVICES} from '../ujn-central/engine.mjs';
export async function signature(body:string,header:string|null,secret:string){if(!secret||!/^sha256=[a-f0-9]{64}$/.test(header||''))return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));let diff=0;for(let i=0;i<32;i++)diff|=bytes[i]^parseInt(header!.slice(7+i*2,9+i*2),16);return diff===0;}
Deno.serve(async req=>{
 const reply=(v:string,status=200)=>new Response(v,{status});const url=new URL(req.url);let cfg;
 try{cfg=await rpc('ujn_channel_config',{p_id:id(url.searchParams.get('channel'))});}catch{return reply('Channel unavailable',503);}
 if(!cfg)return reply('Channel unavailable',503);const secrets=cfg.secrets||{};
 if(req.method==='GET')return secrets.verify_token&&url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===secrets.verify_token?reply(url.searchParams.get('hub.challenge')||''):reply('Invalid challenge',403);
 if(req.method!=='POST')return reply('Method not allowed',405);if(!cfg.enabled||!secrets.token||!secrets.app_secret)return reply('Channel inactive',503);
 let raw;try{raw=new TextDecoder().decode(await boundedBytes(new Response(req.body,{headers:req.headers}),200000));}catch{return reply('Payload too large',413);}
 if(!await signature(raw,req.headers.get('x-hub-signature-256'),secrets.app_secret))return reply('Unauthorized',401);
 let payload;try{payload=JSON.parse(raw);}catch{return reply('Invalid JSON',400);}if(payload.object!=='whatsapp_business_account')return reply('Ignored');
 const graph='https://graph.facebook.com/'+cfg.graph_version;
 const send=async(phone:string,text:string,event:string)=>{
  const delivered=(await api('/rest/v1/academy_chat_deliveries?select=sent_at&id=eq.'+esc(event)))[0];if(delivered?.sent_at)return;
  if(!await rpc('academy_chat_delivery_claim',{p_id:event}))throw Error('BUSY');
  try{const r=await fetch(graph+'/'+cfg.phone_number_id+'/messages',{method:'POST',headers:{authorization:'Bearer '+secrets.token,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'text',text:{body:text.slice(0,4096),preview_url:false}}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Delivery failed');await api('/rest/v1/academy_chat_deliveries?id=eq.'+esc(event),'PATCH',{sent_at:new Date().toISOString()});}catch(e){await api('/rest/v1/academy_chat_deliveries?id=eq.'+esc(event),'PATCH',{lease_until:new Date(0).toISOString()});throw e;}
 };
 const menu='Olá! Você está na central UJN. Escolha um serviço:\n'+Object.values(SERVICES).map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\nPara mudar de serviço, escreva TROCAR SERVIÇO. Não envie senhas nem dados de cartão. Privacidade: https://www.protocolo.me/academy/privacidade/';
 try{
 for(const entry of payload.entry||[])for(const change of entry.changes||[]){const v=change.value||{};if(v.metadata?.phone_number_id!==cfg.phone_number_id)continue;
 for(const s of v.statuses||[])if(s.status==='failed')await api('/rest/v1/ujn_outbox?provider_id=eq.'+esc(s.id),'PATCH',{state:'FAILED',error:'A Meta informou falha de entrega.'});
 for(const m of v.messages||[]){if(!/^\d{8,15}$/.test(m.from)||typeof m.id!=='string'||m.id.length>140)continue;const at=Number(m.timestamp)*1000;if(!Number.isFinite(at)||Date.now()-at>23*3600000||at>Date.now()+300000)continue;
 const event='ujnwa:'+await hash(cfg.id+':'+m.id),text=String(m.text?.body||m.button?.text||m.interactive?.button_reply?.title||'').slice(0,2500),link=text.trim().match(/^VINCULAR ([a-f0-9]{64})$/i);
 if(link){const uid=await rpc('academy_chat_link_redeem',{p_hash:await hash(link[1].toLowerCase()),p_phone:m.from});if(uid)await contact(uid,m.from);await send(m.from,uid?'Conta vinculada por 30 dias.\n\n'+menu:'Código inválido ou expirado. Gere outro em https://www.protocolo.me/academy/atendimento/',event);continue;}
 const bound=(await api('/rest/v1/academy_chat_links?select=user_id&phone=eq.'+m.from+'&expires_at=gt.'+esc(new Date().toISOString())))[0];
 if(/^desconectar$/i.test(text.trim())){if(bound)await api('/rest/v1/academy_chat_links?user_id=eq.'+bound.user_id,'DELETE');await send(m.from,'Conta desconectada. Seus pedidos continuam no site.',event);continue;}
 if(bound){const a=await api('/auth/v1/admin/users/'+bound.user_id);if(!a?.id||a.deleted_at||(a.banned_until&&Date.parse(a.banned_until)>Date.now()))throw Error('Invalid account');}
 const cid=await contact(bound?.user_id||null,m.from),c=(await api('/rest/v1/ujn_contacts?select=current_service&id=eq.'+cid))[0];let service=c.current_service;
 if(/^trocar servi[cç]o$/i.test(text.trim())){await api('/rest/v1/ujn_contacts?id=eq.'+cid,'PATCH',{current_service:null});await send(m.from,menu,event);continue;}
 // Numbered answers select a sector only at the main menu, never inside a form.
 const selected=!service?resolveService(text):null;if(selected){service=selected;await api('/rest/v1/ujn_contacts?id=eq.'+cid,'PATCH',{current_service:service});}
 if(!service){await send(m.from,menu,event);continue;}
 let file;const media=m.document||m.image;if(media?.id){if(!/^\d+$/.test(media.id))throw Error('Invalid media');file={name:media.filename||'foto.jpg',bytes:async()=>{const r=await fetch(graph+'/'+media.id,{headers:{authorization:'Bearer '+secrets.token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Reenvie o arquivo.');const d=await r.json(),location=new URL(d.url);if(location.protocol!=='https:'||!(location.hostname.endsWith('.fbsbx.com')||location.hostname==='lookaside.facebook.com')||Number(d.file_size)>10485760)throw Error('Arquivo inválido ou maior que 10 MB.');return boundedBytes(await fetch(location,{headers:{authorization:'Bearer '+secrets.token},redirect:'error',signal:AbortSignal.timeout(20000)}));}};}
 if(!file&&!text){await send(m.from,'Envie texto, PDF, DOCX, JPG ou PNG de até 10 MB. Áudios ainda não são transcritos.',event);continue;}
 const result=await incoming(cid,service,event,selected?'Olá':text,bound?.user_id||null,cfg.id,file);await flush(result.conversation);
 }
 }
 return reply('OK');
 }catch{return reply('Retry later',503);}
});
