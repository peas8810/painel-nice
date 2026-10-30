const URL=Deno.env.get("SUPABASE_URL")||"",SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const EMAIL_KEY=Deno.env.get("RESEND_API_KEY")||"",FROM=Deno.env.get("ACADEMY_EMAIL_FROM")||"";
const WA_TOKEN=Deno.env.get("META_WHATSAPP_TOKEN")||"",PHONE_ID=Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID")||"";
const TEMPLATE_PREFIX=Deno.env.get("ACADEMY_WHATSAPP_TEMPLATE_PREFIX")||"academy_";
const kinds={PROTOCOL_CREATED:"Protocolo registrado",PROTOCOL_UPDATED:"Protocolo atualizado",PROTOCOL_CANCELLED:"Protocolo cancelado",EVIDENCE_RECEIVED:"Comprovante recebido",EVIDENCE_APPROVED:"Comprovante validado",EVIDENCE_REJECTED:"Comprovante requer correção",PROTOCOL_APPROVED:"Protocolo aprovado",PROTOCOL_REJECTED:"Protocolo reprovado",PAYMENT_RELEASED:"Pagamento liberado",PAYMENT_CONFIRMED:"Pagamento confirmado",CERTIFICATE_READY:"Certificado disponível"};
const templates={PROTOCOL_CREATED:"protocolo_criado",PROTOCOL_UPDATED:"protocolo_atualizado",PROTOCOL_CANCELLED:"protocolo_cancelado",EVIDENCE_RECEIVED:"documento_recebido",EVIDENCE_APPROVED:"documento_validado",EVIDENCE_REJECTED:"documento_corrigir",PROTOCOL_APPROVED:"protocolo_aprovado",PROTOCOL_REJECTED:"protocolo_reprovado",PAYMENT_RELEASED:"pagamento_disponivel",PAYMENT_CONFIRMED:"pagamento_confirmado",CERTIFICATE_READY:"certificado_disponivel"};
function out(status,x){return new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","access-control-allow-origin":"https://www.protocolo.me","access-control-allow-headers":"authorization,apikey,content-type"}})}
async function db(path,method="GET",body){const r=await fetch(URL+path,{method,headers:{"apikey":SR,"authorization":"Bearer "+SR,"content-type":"application/json","prefer":"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});let text=await r.text();if(!r.ok)throw Error("Backend error "+r.status);return text?JSON.parse(text):[]}
async function authorized(req){const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");if(!token)return false;const res=await fetch(URL+"/auth/v1/user",{headers:{"apikey":ANON,"authorization":"Bearer "+token}});if(!res.ok)return false;const u=await res.json();const result=await db("/rest/v1/academy_admin_members?select=user_id&enabled=eq.true&role=eq.SUPER_ADMIN&user_id=eq."+encodeURIComponent(u.id));return result.length>0}
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return out(200,{});
 if(req.method!=="POST")return out(405,{error:"Method"});
 if(!URL||!SR||!ANON)return out(503,{error:"Backend unavailable"});
 try{
  if(!(await authorized(req)))return out(403,{error:"Only general administrator can process notifications"});
  const jobs=await db("/rest/v1/rpc/academy_claim_notification","POST",{});
  if(!jobs.length)return out(200,{processed:0});
  const job=jobs[0],statusPath="/rest/v1/academy_notification_outbox?id=eq."+job.id;
  try{
   const enabled=await db("/rest/v1/rpc/academy_notification_delivery_enabled","POST",{p_user:job.user_id,p_channel:job.channel});
   if(!enabled){await db(statusPath,"PATCH",{status:"CANCELADO",error:"User opted out"});return out(200,{processed:1,cancelled:true})}
   const title=kinds[job.kind];if(!title)throw Error("Unsupported event type");
   const portal="https://www.protocolo.me/academy/portal/";
   let extraLink=portal;
   if(job.kind==="PAYMENT_RELEASED"){const p=await db("/rest/v1/academy_payment_releases?select=checkout_url,payment_status&request_id=eq."+job.request_id);const link=p[0]?.checkout_url; if(!link||p[0]?.payment_status!=="AGUARDANDO_PAGAMENTO")throw Error("Checkout link not yet ready");const url=new URL(link);if(url.protocol!=="https:"||!url.hostname.endsWith("mercadopago.com.br"))throw Error("Untrusted payment link");extraLink=url.toString()}
   let providerId;
   if(job.channel==="EMAIL"){
    if(!EMAIL_KEY||!FROM)throw Error("Email service not configured");
    const html='<p>'+esc(title)+' no Protocolo Academy.</p><p>Protocolo: <strong>'+esc(job.request_id)+'</strong></p><p>Acesse o <a href="'+extraLink+'">Portal do Estudante</a> para consultar os detalhes e as próximas etapas.</p><p>Esta é uma mensagem transacional relacionada ao seu protocolo.</p>';
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+EMAIL_KEY,"content-type":"application/json","Idempotency-Key":"academy-notification-"+job.id},body:JSON.stringify({from:FROM,to:[job.recipient],subject:"Academy — "+title,html})});
    const d=await r.json();if(!r.ok||!d.id)throw Error("Email provider rejected request");providerId=String(d.id);
   }else{
    if(!WA_TOKEN||!PHONE_ID)throw Error("WhatsApp Business API not configured");
    if(!/^\+[1-9]\d{7,14}$/.test(job.recipient))throw Error("Invalid WhatsApp number");
    const template=TEMPLATE_PREFIX+templates[job.kind];
    const body={messaging_product:"whatsapp",to:job.recipient.slice(1),type:"template",template:{name:template,language:{code:"pt_BR"},components:[{type:"body",parameters:[{type:"text",text:String(job.request_id).slice(0,36)}]}]}};
    const r=await fetch("https://graph.facebook.com/v22.0/"+encodeURIComponent(PHONE_ID)+"/messages",{method:"POST",headers:{"authorization":"Bearer "+WA_TOKEN,"content-type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json();if(!r.ok||!d.messages?.[0]?.id)throw Error("Meta rejected notification (check approved template and phone)");providerId=d.messages[0].id;
   }
   await db(statusPath,"PATCH",{status:"ENVIADO",delivered_at:new Date().toISOString(),provider_id:providerId,error:null});
   return out(200,{processed:1,channel:job.channel,status:"accepted_by_provider"});
  }catch(e){await db(statusPath,"PATCH",{status:"FALHOU",error:String(e?.message||e).slice(0,250)});return out(200,{processed:1,status:"FAILED",message:"Check notification errors in admin"})}
 }catch(e){return out(500,{error:"Notification worker failed"})}
});