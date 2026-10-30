const URL=Deno.env.get("SUPABASE_URL")||"";
const SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const MP=Deno.env.get("MP_ACCESS_TOKEN")||"";
const enable=Deno.env.get("ACADEMY_ENABLE_PAYMENTS")==="sandbox";
const ORIGINS=new Set(["https://www.protocolo.me","https://protocolo.me"]);
function reply(body,status=200,origin=""){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","access-control-allow-origin":ORIGINS.has(origin)?origin:"https://www.protocolo.me","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"}})}
async function api(path,{method="GET",body,token=SR,apikey=SR}={}){
 const r=await fetch(URL+path,{method,headers:{"apikey":apikey,"authorization":"Bearer "+token,"content-type":"application/json","prefer":"return=representation"},body:body?JSON.stringify(body):undefined});
 const text=await r.text();let parsed;try{parsed=JSON.parse(text)}catch{parsed=text}
 if(!r.ok)throw new Error("Database error "+r.status+" "+String(text).slice(0,100));
 return parsed;
}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS")return reply({},200,origin);
 if(req.method!=="POST")return reply({error:"Method not allowed"},405,origin);
 if(origin&&!ORIGINS.has(origin))return reply({error:"Origin denied"},403,origin);
 if(!URL||!SR||!ANON||!MP||!enable)return reply({error:"Checkout disabled until configured and tested in sandbox"},503,origin);
 try{
  const bearer=req.headers.get("authorization")||"";
  if(!bearer.startsWith("Bearer "))return reply({error:"Login required"},401,origin);
  const uid=await api("/auth/v1/user",{token:bearer.slice(7),apikey:ANON});
  if(!uid?.id)return reply({error:"Invalid session"},401,origin);
  const admin=await api("/rest/v1/academy_admin_members?select=user_id&enabled=eq.true&role=eq.SUPER_ADMIN&user_id=eq."+encodeURIComponent(uid.id));
  if(!admin?.length)return reply({error:"Access denied"},403,origin);
  const body=await req.json(),id=String(body?.request_id||"");
  if(!/^[0-9a-f-]{36}$/.test(id))return reply({error:"Invalid request"},400,origin);
  const releases=await api("/rest/v1/academy_payment_releases?select=*&request_id=eq."+encodeURIComponent(id));
  const release=releases[0];if(!release)return reply({error:"Protocol not released for payment"},409,origin);
  if(release.payment_status==="PAGO_CONFIRMADO"||release.payment_status==="ESTORNADO")return reply({error:"Payment no longer available"},409,origin);
  if(release.checkout_url)return reply({checkout_url:release.checkout_url,existing:true},200,origin);
  const requests=await api("/rest/v1/academy_requests?select=id,user_id,activity,status&status=eq.APROVADO&id=eq."+encodeURIComponent(id));
  const protocol=requests[0];if(!protocol)return reply({error:"Administrative approval required"},409,origin);
  const approvals=await api("/rest/v1/academy_approvals?select=request_id&request_id=eq."+encodeURIComponent(id));if(!approvals.length)return reply({error:"Valid approval missing"},409,origin);
  const recipient=await api("/auth/v1/admin/users/"+protocol.user_id);if(!recipient?.email)return reply({error:"Student email missing"},409,origin);
  const mpBody={items:[{id:"ACADEMY-PRIMEIRA-VIA",title:"Protocolo Academy - certificação documental",quantity:1,currency_id:"BRL",unit_price:release.amount_cents/100}],external_reference:id,
    payer:{email:recipient.email},notification_url:URL+"/functions/v1/academy-mp-webhook",
    back_urls:{success:"https://www.protocolo.me/academy/portal/",pending:"https://www.protocolo.me/academy/portal/",failure:"https://www.protocolo.me/academy/portal/"}};
  const response=await fetch("https://api.mercadopago.com/checkout/preferences",{method:"POST",headers:{"authorization":"Bearer "+MP,"content-type":"application/json","X-Idempotency-Key":id},body:JSON.stringify(mpBody)});
  const preference=await response.json();
  if(!response.ok||!preference.id||!/^https:\/\//.test(preference.init_point||""))return reply({error:"Checkout provider could not create a valid preference"},502,origin);
  await api("/rest/v1/academy_payment_releases?request_id=eq."+encodeURIComponent(id),{method:"PATCH",body:{checkout_url:preference.init_point,mp_preference_id:String(preference.id),payment_status:"AGUARDANDO_PAGAMENTO"}});
  await api("/rest/v1/academy_email_outbox?on_conflict=request_id,kind",{method:"POST",body:{request_id:id,kind:"PAYMENT_INVITATION",recipient:recipient.email,status:"PENDENTE"}}).catch(()=>null);
  return reply({checkout_url:preference.init_point,email_status:"PENDENTE",message:"Checkout created; email invitation queued for delivery"},200,origin);
 }catch(e){return reply({error:"Checkout could not be started",detail:String(e?.message||e).slice(0,100)},500,origin)}
});
