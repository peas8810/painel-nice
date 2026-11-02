import {providerSettings} from './provider-config.ts';
import {authenticated,api,rpc,hash,processTurn,boundedBytes} from './backend.ts';
const headers={'content-type':'application/json','access-control-allow-origin':'https://www.protocolo.me','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,OPTIONS','cache-control':'no-store'};
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return out({error:'Método inválido'},405);
 let user;try{user=await authenticated(req);}catch{return out({error:'Entre na conta para usar o assistente.'},401);}
 try{
 let b:any,file:any;const type=req.headers.get('content-type')||'';
 if(type.includes('multipart/form-data')){const bytes=await boundedBytes(new Response(req.body,{headers:req.headers}),10600000);const form=await new Response(bytes,{headers:{'content-type':type}}).formData();b={action:'message',event_id:form.get('event_id'),text:''};const f=form.get('file');if(!(f instanceof File))return out({error:'Selecione um arquivo.'},400);file={name:f.name,bytes:async()=>new Uint8Array(await f.arrayBuffer())};}
 else {const text=await req.text();if(text.length>5000)return out({error:'Mensagem muito longa'},413);b=JSON.parse(text);}
 const uid=user.id;
 if(b.action==='history'){const config=await providerSettings();const whatsappReady=['META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','META_WHATSAPP_VERIFY_TOKEN','META_GRAPH_VERSION'].every(k=>!!config(k));await rpc('academy_chat_prune',{});const messages=await api('/rest/v1/academy_chat_events?select=input,response,channel,created_at&user_id=eq.'+uid+'&response=not.is.null&order=created_at.desc&limit=30');const link=(await api('/rest/v1/academy_chat_links?select=phone,expires_at&user_id=eq.'+uid))[0];return out({messages:messages.reverse(),whatsapp_ready:whatsappReady,ai_ready:!!config('OPENAI_API_KEY'),linked:!!link?.phone&&Date.parse(link.expires_at)>Date.now(),phone_suffix:link?.phone?.slice(-4)});}
 if(b.action==='link'){const config=await providerSettings();if(!['META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','META_WHATSAPP_VERIFY_TOKEN','META_GRAPH_VERSION'].every(k=>!!config(k)))return out({error:'WhatsApp aguardando ativação pela equipe. Use o chat do site.'},503);const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');await api('/rest/v1/academy_chat_links?user_id=eq.'+uid,'DELETE');await api('/rest/v1/academy_chat_links','POST',{user_id:uid,token_hash:await hash(token),token_expires:new Date(Date.now()+600000).toISOString()});return out({command:'VINCULAR '+token,expires_minutes:10});}
 if(b.action==='unlink'){await api('/rest/v1/academy_chat_links?user_id=eq.'+uid,'DELETE');return out({ok:true});}
 if(b.action!=='message'||typeof b.event_id!=='string'||!/^[0-9a-f-]{36}$/.test(b.event_id)||(!file&&(typeof b.text!=='string'||b.text.length>2500)))return out({error:'Mensagem inválida'},400);
 return out(await processTurn(uid,'web:'+b.event_id,'web',{text:b.text||'',file}));
 }catch(e){return out({error:e.message==='BUSY'?'Uma mensagem ainda está sendo processada. Tente novamente.':e.message==='RATE_LIMIT'?'Limite de mensagens atingido. Tente mais tarde.':'Não foi possível concluir. Tente novamente.'},e.message==='BUSY'?409:e.message==='RATE_LIMIT'?429:503);}
});
