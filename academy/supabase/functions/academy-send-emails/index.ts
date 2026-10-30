const URL=Deno.env.get("SUPABASE_URL")||"",SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const API=Deno.env.get("RESEND_API_KEY")||"",FROM=Deno.env.get("ACADEMY_EMAIL_FROM")||"";
function out(status,data){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}})}
async function db(path,method="GET",body){const r=await fetch(URL+path,{method,headers:{"apikey":SERVICE,"authorization":"Bearer "+SERVICE,"content-type":"application/json","prefer":"return=representation"},body:body?JSON.stringify(body):undefined});const txt=await r.text();if(!r.ok)throw Error("DB "+r.status);return txt?JSON.parse(txt):[]}
async function validate(req){const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");if(!token)return false;const r=await fetch(URL+"/auth/v1/user",{headers:{"apikey":ANON,"authorization":"Bearer "+token}});if(!r.ok)return false;const user=await r.json();const a=await db("/rest/v1/academy_admin_members?select=user_id&enabled=eq.true&user_id=eq."+encodeURIComponent(user.id));return a.length>0}
function safeCheckout(raw){try{const u=new URL(raw);return u.protocol==="https:"&&(u.hostname==="www.mercadopago.com.br"||u.hostname==="mercadopago.com.br"||u.hostname==="www.mercadopago.com"||u.hostname==="mercadopago.com"||u.hostname==="sandbox.mercadopago.com.br"||u.hostname==="sandbox.mercadopago.com")?u.toString():null}catch{return null}}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return out(405,{error:"Method"});
 if(!URL||!SERVICE||!ANON||!API||!FROM)return out(503,{error:"Email provider not configured"});
 if(!(await validate(req)))return out(403,{error:"Administrative access required"});
 try{
  const rows=await db("/rest/v1/rpc/academy_claim_email_outbox","POST",{});
  if(!rows.length)return out(200,{processed:0});
  job=rows[0];let subject="",html="";
  if(job.kind==="PAYMENT_INVITATION"){
   const rows=await db("/rest/v1/academy_payment_releases?select=checkout_url,payment_status&request_id=eq."+job.request_id);
   const p=rows[0],link=p&&safeCheckout(p.checkout_url);
   if(!p||p.payment_status!=="AGUARDANDO_PAGAMENTO"||!link)throw Error("No valid checkout link");
   subject="Protocolo Academy — atividade aprovada e pagamento disponível";
   html='<p>Sua atividade foi aprovada após análise documental.</p><p>Para continuar, acesse o <a href="'+link+'">pagamento seguro do Mercado Pago</a>.</p><p>O certificado será emitido somente após a confirmação do pagamento.</p>';
  }else if(job.kind==="CERTIFICATE_READY"){
   const cert=await db("/rest/v1/academy_certificates?select=status&request_id=eq."+job.request_id);
   if(!cert.length||cert[0].status!=="EMITIDO")throw Error("Certificate not ready");
   subject="Protocolo Academy — certificado disponível";
   html='<p>Seu certificado está disponível no <a href="https://www.protocolo.me/academy/portal/">portal do aluno</a>.</p>';
  }else throw Error("Unknown message kind");
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+API,"content-type":"application/json","Idempotency-Key":"academy-email-"+job.id},body:JSON.stringify({from:FROM,to:[job.recipient],subject,html})});
  const result=await r.json();
  if(!r.ok||!result.id)throw Error("Email provider rejected request");
  await db("/rest/v1/academy_email_outbox?id=eq."+job.id,"PATCH",{status:"ENVIADO",delivered_at:new Date().toISOString(),provider_message_id:result.id,last_error:null});
  return out(200,{processed:1,sent:true});
 }catch(e){if(job){try{await db("/rest/v1/academy_email_outbox?id=eq."+job.id,"PATCH",{status:"FALHOU",last_error:String(e?.message||e).slice(0,180)})}catch{}}return out(502,{error:"Delivery failed; retained for retry"})}
});