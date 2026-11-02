import {providerSettings} from './provider-config.ts';
const BASE=Deno.env.get("SUPABASE_URL")||"",SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
function reply(body,status=200){return new Response(body,{status,headers:{"content-type":"text/plain; charset=utf-8"}})}
async function validSignature(text,signature,APP_SECRET){if(!APP_SECRET||!signature?.startsWith("sha256="))return false;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(APP_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(text)));const provided=signature.slice(7);if(provided.length!==64)return false;let mismatch=0;for(let i=0;i<signed.length;i++){const part=provided.slice(i*2,i*2+2);const n=Number.parseInt(part,16);if(!Number.isFinite(n))return false;mismatch|=signed[i]^n}return mismatch===0}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'https://www.protocolo.me','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'POST,GET,OPTIONS'}});
 let setting;try{setting=await providerSettings();}catch{return new Response(JSON.stringify({error:'Configuração temporariamente indisponível'}),{status:503,headers:{'content-type':'application/json','access-control-allow-origin':'https://www.protocolo.me'}});}
const VERIFY=setting("META_WHATSAPP_VERIFY_TOKEN"),APP_SECRET=setting("META_APP_SECRET");

 const url=new URL(req.url);
 if(req.method==="GET"){if(!VERIFY)return reply("Not configured",503);if(url.searchParams.get("hub.mode")==="subscribe"&&url.searchParams.get("hub.verify_token")===VERIFY)return reply(url.searchParams.get("hub.challenge")||"",200);return reply("Invalid challenge",403)}
 if(req.method!=="POST")return reply("Method not allowed",405);
 if(!SR||!BASE||!APP_SECRET)return reply("Webhook not configured",503);
 const body=await req.text();
 if(body.length>200000)return reply("Payload too large",413);
 if(!(await validSignature(body,req.headers.get("x-hub-signature-256"),APP_SECRET)))return reply("Unauthorized",401);
 let payload;try{payload=JSON.parse(body)}catch{return reply("Bad JSON",400)}
 if(payload.object!=="whatsapp_business_account")return reply("Ignored",200);
 let failed=false;
 for(const entry of payload.entry||[]){for(const change of entry.changes||[]){for(const item of change.value?.statuses||[]){if(!["delivered","read","failed"].includes(item.status)||typeof item.id!=="string")continue;
 const message=Array.isArray(item.errors)?item.errors.map(x=>String(x.title||x.message||"Erro")).join("; "):null;
 const response=await fetch(BASE+"/rest/v1/rpc/academy_record_whatsapp_receipt",{method:"POST",headers:{apikey:SR,authorization:"Bearer "+SR,"content-type":"application/json"},body:JSON.stringify({p_provider_id:item.id,p_state:item.status,p_error:message})});
 if(!response.ok)failed=true;
 }}}
 return reply(failed?"Processing error":"OK",failed?500:200);
});
