const base=Deno.env.get('SUPABASE_URL')||'', service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'', anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
const headers={'content-type':'application/json','access-control-allow-origin':'https://www.protocolo.me','access-control-allow-headers':'authorization,apikey,content-type','cache-control':'no-store'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply(200,{});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 try{
  const auth=req.headers.get('authorization');if(!auth)return reply(401,{error:'Login required'});
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:anon,authorization:auth}});
  if(!userResponse.ok)return reply(401,{error:'Invalid session'});
  const user=await userResponse.json();
  const access=await fetch(base+'/rest/v1/academy_admin_members?select=user_id&enabled=eq.true&role=eq.SUPER_ADMIN&user_id=eq.'+encodeURIComponent(user.id),{headers:{apikey:service,authorization:'Bearer '+service}});
  if(!access.ok||!(await access.json()).length)return reply(403,{error:'Superadministrator required'});
  const groups={
   'Pagamento de teste':['MP_ACCESS_TOKEN','MP_WEBHOOK_SECRET','MP_COLLECTOR_ID'],
   'Certificado':['ACADEMY_SIGNING_SECRET'],
   'E-mail':['RESEND_API_KEY','ACADEMY_EMAIL_FROM','RESEND_WEBHOOK_SECRET'],
   'WhatsApp':['META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','META_WHATSAPP_VERIFY_TOKEN'],
   'Agendamento de avisos':['ACADEMY_DISPATCH_CRON_SECRET'],
   'Assistência por IA':['OPENAI_API_KEY']
  };
  const checks=Object.entries(groups).map(([name,keys])=>({name,configured:keys.every(k=>Boolean(Deno.env.get(k))),missing:keys.filter(k=>!Deno.env.get(k))}));
  const signing=Deno.env.get('ACADEMY_SIGNING_SECRET')||'';
  return reply(200,{checks,signing_key_length_valid:signing.length>=32,payment_mode:Deno.env.get('ACADEMY_ENABLE_PAYMENTS')==='sandbox'?'sandbox':'disabled',issuance_mode:Deno.env.get('ACADEMY_ENABLE_ISSUANCE')==='sandbox'?'sandbox':'disabled',commercial_release:false,message:'Configuração não comprova funcionamento. Pagamento, entrega de avisos, emissão e validação precisam de teste integrado. A versão atual opera em homologação.'});
 }catch{return reply(503,{error:'Não foi possível verificar a configuração'});}
});
