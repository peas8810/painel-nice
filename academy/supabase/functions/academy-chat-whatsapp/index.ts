import {api,rpc,hash,processTurn,boundedBytes,BASE,SR} from '../academy-chat/backend.ts';
import {providerSettings} from '../academy-chat/provider-config.ts';
export async function signature(body:string,header:string|null,secret:string){if(!secret||!/^sha256=[a-f0-9]{64}$/.test(header||''))return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)));let diff=0;for(let i=0;i<32;i++)diff|=bytes[i]^parseInt(header!.slice(7+i*2,9+i*2),16);return diff===0;}
Deno.serve(async req=>{
 const reply=(s:string,status=200)=>new Response(s,{status});let get;try{get=await providerSettings();}catch{return reply('Configuration unavailable',503);}
 const u=new URL(req.url),secret=get('META_APP_SECRET'),token=get('META_WHATSAPP_TOKEN'),phone=get('META_WHATSAPP_PHONE_NUMBER_ID'),version=get('META_GRAPH_VERSION');
 if(req.method==='GET')return get('META_WHATSAPP_VERIFY_TOKEN')&&u.searchParams.get('hub.mode')==='subscribe'&&u.searchParams.get('hub.verify_token')===get('META_WHATSAPP_VERIFY_TOKEN')?reply(u.searchParams.get('hub.challenge')||''):reply('Invalid challenge',403);
 if(req.method!=='POST')return reply('Method not allowed',405);
 if(!secret||!token||!phone||!/^v\d+\.\d+$/.test(version))return reply('WhatsApp not configured',503);
 let raw;try{raw=new TextDecoder().decode(await boundedBytes(new Response(req.body,{headers:req.headers}),200000));}catch{return reply('Payload too large',413);}
 if(!await signature(raw,req.headers.get('x-hub-signature-256'),secret))return reply('Unauthorized',401);
 let payload;try{payload=JSON.parse(raw);}catch{return reply('Invalid JSON',400);}if(payload.object!=='whatsapp_business_account')return reply('Ignored');
 const graph='https://graph.facebook.com/'+version;
 const send=async(to:string,text:string)=>{const r=await fetch(graph+'/'+phone+'/messages',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:text.slice(0,4096),preview_url:false}}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Delivery failed');};
 try{
 for(const entry of payload.entry||[])for(const change of entry.changes||[]){const value=change.value||{};if(value.metadata?.phone_number_id!==phone)continue;
 // Preserve delivery receipts from the existing notification/identity integration.
 for(const status of value.statuses||[])if(['delivered','read','failed'].includes(status.status))await rpc('academy_record_whatsapp_receipt',{p_provider_id:status.id,p_state:status.status,p_error:status.status==='failed'?'Falha informada pela Meta':null});
 for(const m of value.messages||[]){if(!/^\d{8,15}$/.test(m.from)||typeof m.id!=='string'||m.id.length>140)continue;
 const timestamp=Number(m.timestamp)*1000;if(!Number.isFinite(timestamp)||Date.now()-timestamp>23*3600000||timestamp>Date.now()+300000)continue;
 const event='wa:'+m.id;
 const delivery=(await api('/rest/v1/academy_chat_deliveries?select=id,sent_at&id=eq.'+encodeURIComponent(event)))[0];if(delivery?.sent_at)continue;
 const text=String(m.text?.body||m.button?.text||m.interactive?.button_reply?.title||'').slice(0,2500);
 const link=text.trim().match(/^VINCULAR ([a-f0-9]{64})$/i);
 let output;
 if(link){const uid=await rpc('academy_chat_link_redeem',{p_hash:await hash(link[1].toLowerCase()),p_phone:m.from});output=uid?'Seu WhatsApp foi vinculado à sua conta por 30 dias. Digite Menu para começar. Você pode desconectar no portal.':'Código inválido ou expirado. Gere outro no chat do portal.';}
 else{
 const bound=(await api('/rest/v1/academy_chat_links?select=user_id,expires_at&phone=eq.'+m.from+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())))[0];
 if(!bound)output='Olá! Para acessar seus pedidos com segurança, entre em https://www.protocolo.me/academy/portal/#academy-chat e escolha “Conectar WhatsApp”. Não envie senhas nem documentos antes de vincular a conta. Atendimento: contato@ujn.ojsbr.com.';
 else if(/^desconectar$/i.test(text.trim())){await api('/rest/v1/academy_chat_links?user_id=eq.'+bound.user_id,'DELETE');output='WhatsApp desconectado. Seus pedidos continuam no portal.';}
 else{
 const account=await api('/auth/v1/admin/users/'+bound.user_id);if(!account?.id||account.deleted_at||(account.banned_until&&Date.parse(account.banned_until)>Date.now()))throw Error('Invalid account');
 let file;const media=m.document||m.image;
 if(media?.id){if(!/^\d+$/.test(media.id))throw Error('Invalid media');file={name:media.filename||'foto.jpg',bytes:async()=>{const info=await fetch(graph+'/'+media.id,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});if(!info.ok)throw Error('Não foi possível receber o arquivo. Envie novamente.');const data=await info.json();const location=new URL(data.url);if(location.protocol!=='https:'||!(location.hostname.endsWith('.fbsbx.com')||location.hostname==='lookaside.facebook.com')||Number(data.file_size)>10485760)throw Error('Arquivo inválido ou maior que 10 MB.');return boundedBytes(await fetch(location,{headers:{authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)}));}};}
 if(!file&&!text)output='Neste momento, envie texto, uma foto JPG/PNG ou um PDF. Áudios ainda não são transcritos. Digite Menu para ver as opções.';
 else {const r=await processTurn(bound.user_id,event,'whatsapp',{text,file});output=r.text+(r.links?.length?'\n\n'+r.links.map((x:any)=>x.label+': '+x.url).join('\n'):'')+(r.choices?.length?'\n\nOpções — escreva uma delas:\n'+r.choices.join(' · '):'');}
 }
 }
 // Claim outbound delivery so concurrent retries do not send in parallel.
 const claim=await rpc('academy_chat_delivery_claim',{p_id:event});if(!claim)throw Error('Delivery already processing');
 try{await send(m.from,output);await api('/rest/v1/academy_chat_deliveries?id=eq.'+encodeURIComponent(event),'PATCH',{sent_at:new Date().toISOString()});}catch(e){await api('/rest/v1/academy_chat_deliveries?id=eq.'+encodeURIComponent(event),'PATCH',{lease_until:new Date(0).toISOString()});throw e;}
 }
 }
 return reply('OK');
 }catch{return reply('Retry later',503);}
});
