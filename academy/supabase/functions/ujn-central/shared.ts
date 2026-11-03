import {api,rpc,BASE,SR,processTurn,hash,boundedBytes} from '../academy-chat/backend.ts';
import {serviceTurn,SERVICES} from './engine.mjs';
export {api,rpc,BASE,SR,hash,boundedBytes};
export const id=(v:any)=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))throw Error('Identificador inválido');return v;};
export const esc=(v:any)=>encodeURIComponent(String(v));
export async function agent(user:string,service?:string){return rpc(service?'ujn_access':'ujn_super',service?{p_user:user,p_service:service}:{p_user:user});}
export async function contact(user:string|null,phone:string|null=null){return rpc('ujn_contact',{p_user:user,p_phone:phone});}
export async function conversation(cid:string){const r=(await api('/rest/v1/ujn_conversations?select=*&id=eq.'+id(cid)))[0];if(!r)throw Error('Atendimento não encontrado');return r;}
export async function saveFile(c:any,file:any,event:string){
 const bytes=await file.bytes();if(!bytes.length||bytes.length>10485760)throw Error('Envie um arquivo de até 10 MB.');let mime,ext;
 if(bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70){mime='application/pdf';ext='pdf';}
 else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){mime='image/jpeg';ext='jpg';}
 else if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)){mime='image/png';ext='png';}
 else if(/\.docx$/i.test(file.name)&&bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4&&new TextDecoder().decode(bytes).includes('word/document.xml')){mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';ext='docx';}
 else throw Error('Envie PDF, DOCX, JPG ou PNG.');
 const digest=await hash(event),aid=digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-8'+digest.slice(17,20)+'-'+digest.slice(20,32),path=c.contact_id+'/'+c.id+'/'+aid+'.'+ext;
 const existing=await api('/rest/v1/ujn_attachments?select=id&id=eq.'+aid);if(existing.length)return aid;
 const r=await fetch(BASE+'/storage/v1/object/ujn-atendimento/'+path,{method:'POST',headers:{apikey:SR,authorization:'Bearer '+SR,'content-type':mime,'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(20000)});if(!r.ok){const error=await r.json().catch(()=>({}));if(r.status!==409&&String(error.statusCode)!=='409')throw Error('Falha no recebimento do arquivo.');}
 await api('/rest/v1/ujn_attachments','POST',{id:aid,conversation_id:c.id,contact_id:c.contact_id,file_path:path,file_name:String(file.name||'documento.'+ext).slice(0,240),mime});return aid;
}
export async function incoming(contactId:string,service:string,event:string,text:string,userId:string|null,channel:string|null=null,file?:any){
 if(!Object.hasOwn(SERVICES,service))throw Error('Escolha um serviço.');
 const result=await rpc('ujn_ingest',{p_contact:contactId,p_service:service,p_event:event,p_text:file?'Arquivo: '+String(file.name).slice(0,240):text,p_channel:channel});const c=result.conversation;
 if(result.duplicate){if(file&&c.state!=='BOT')await saveFile(c,file,event);return {conversation:c.id,reply:result.reply,duplicate:true};}
 // Files addressed to a human are retained in the same private conversation.
 if(c.state!=='BOT'){if(file)await saveFile(c,file,event);return {conversation:c.id,waiting:true};}
 let response;
 try{response=await serviceTurn(c,{text,file,event,userId},{academy:(uid:string,e:string,i:any)=>processTurn(uid,'ujn:'+e,channel?'whatsapp':'web',i),upload:(f:any)=>saveFile(c,f,event)});}catch(e){response={text:e.message||'Não foi possível concluir. Tente novamente.',choices:['Continuar','Falar com uma pessoa'],state:c.bot_state,handoff:false,links:[]};}
 const saved=await rpc('ujn_bot_reply',{p_id:c.id,p_event:event,p_revision:c.revision,p_text:response.text,p_payload:{text:response.text,choices:response.choices,links:response.links},p_state:response.state,p_handoff:response.handoff});return {conversation:c.id,reply:saved.paused?null:response};
}
export async function dispatch(outboxId:string){
 const o=await rpc('ujn_outbox_claim',{p_id:id(outboxId)});if(!o)return {state:'UNCHANGED'};
 try{
 const config=await rpc('ujn_channel_config',{p_id:o.channel_id});if(!config?.enabled||!config.secrets?.token)throw Error('Canal desativado ou sem credenciais');
 const m=(await api('/rest/v1/ujn_messages?select=body,payload,conversation_id&id=eq.'+o.message_id))[0],c=await conversation(m.conversation_id);
 const owner=(await api('/rest/v1/ujn_contacts?select=user_id,phone&id=eq.'+c.contact_id))[0];if(owner?.user_id){const binding=await api('/rest/v1/academy_chat_links?select=user_id&user_id=eq.'+owner.user_id+'&phone=eq.'+o.phone+'&expires_at=gt.'+esc(new Date().toISOString()));if(!binding.length)throw Error('Vínculo da conta expirado. Consulte pelo portal.');}
 if(!c.last_customer_at||Date.now()-Date.parse(c.last_customer_at)>23*3600000){await api('/rest/v1/ujn_outbox?id=eq.'+o.id,'PATCH',{state:'NEEDS_TEMPLATE',lease_until:null,error:'Fora da janela de resposta. Aguarde nova mensagem ou use um template aprovado.'});return {state:'NEEDS_TEMPLATE'};}
 const links=(m.payload?.links||[]).map((l:any)=>l.label+': '+l.url).join('\n'),choices=(m.payload?.choices||[]).join(' · '),body=[m.body,links,choices?'Opções: '+choices:''].filter(Boolean).join('\n\n').slice(0,4096);
 const response=await fetch('https://graph.facebook.com/'+config.graph_version+'/'+config.phone_number_id+'/messages',{method:'POST',headers:{authorization:'Bearer '+config.secrets.token,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:o.phone,type:'text',text:{body,preview_url:false}}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok||!data.messages?.[0]?.id)throw Error('A Meta não confirmou o envio');
 await api('/rest/v1/ujn_outbox?id=eq.'+o.id,'PATCH',{state:'SENT',provider_id:data.messages[0].id,lease_until:null,error:null});return {state:'SENT'};
 }catch(e){await api('/rest/v1/ujn_outbox?id=eq.'+o.id,'PATCH',{state:'FAILED',lease_until:null,error:String(e.message).slice(0,200)});return {state:'FAILED'};}
}
export async function flush(cid:string){const messages=await api('/rest/v1/ujn_messages?select=id&conversation_id=eq.'+id(cid)+'&order=created_at.desc&limit=20');if(!messages.length)return;const rows=await api('/rest/v1/ujn_outbox?select=id&message_id=in.('+messages.map((m:any)=>m.id).join(',')+')&state=in.(PENDING,FAILED)&attempts=lt.5&limit=10');for(const o of rows)await dispatch(o.id);}
