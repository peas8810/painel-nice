// Mercado Pago webhook: signature verification + seller/amount/reference checks.
// Always fails closed if MP_WEBHOOK_SECRET, MP_ACCESS_TOKEN, MP_COLLECTOR_ID or sandbox gate are missing.
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"",SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const TOKEN=Deno.env.get("MP_ACCESS_TOKEN")||"",SECRET=Deno.env.get("MP_WEBHOOK_SECRET")||"";
const SELLER=Deno.env.get("MP_COLLECTOR_ID")||"";
const enabled=Deno.env.get("ACADEMY_ENABLE_PAYMENTS")==="sandbox";
function response(status,msg){return new Response(JSON.stringify({message:msg}),{status,headers:{"content-type":"application/json"}})}
function constantTime(a,b){if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a[i]^b[i];return v===0}
async function hmac(secret,text){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(text));
 return new Uint8Array(signature);
}
function parseHex(s){if(!/^[a-f0-9]{64}$/i.test(s))return null;return new Uint8Array(s.match(/../g).map(x=>parseInt(x,16)))}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return response(405,"Method not allowed");
 if(!SUPABASE_URL||!SERVICE||!TOKEN||!SECRET||!SELLER||!enabled)return response(503,"Webhook disabled until configured and validated");
 try{
  const u=new URL(req.url),headers=req.headers;
  const sig=headers.get("x-signature")||"",requestId=headers.get("x-request-id")||"";
  const data=await req.json();if(data.type!=="payment")return response(200,"Ignored notification type");
  const id=String(u.searchParams.get("data.id")||data.data?.id||"");
  if(!/^\d{4,30}$/.test(id)||!requestId)return response(401,"Bad signature inputs");
  const ts=/\bts=(\d+)\b/.exec(sig)?.[1],hex=/\bv1=([a-f0-9]{64})\b/i.exec(sig)?.[1];if(!ts||!hex)return response(401,"Unsigned notification");
  const epoch=Number(ts)>1e12?Number(ts)/1000:Number(ts);
  if(Math.abs(Date.now()/1000-epoch)>3600)return response(401,"Expired notification timestamp");
  const manifest="id:"+id.toLowerCase()+";request-id:"+requestId+";ts:"+ts+";";
  const expected=await hmac(SECRET,manifest),received=parseHex(hex);
  if(!received||!constantTime(expected,received))return response(401,"Invalid signature");
  // Never trust status/reference/amount from the webhook itself.
  const remote=await fetch("https://api.mercadopago.com/v1/payments/"+id,{headers:{"authorization":"Bearer "+TOKEN}});
  if(!remote.ok)return response(502,"Payment provider lookup failed");
  const payment=await remote.json();
  if(String(payment.id)!==id||String(payment.collector_id)!==SELLER)return response(422,"Seller mismatch");
  const reference=String(payment.external_reference||"");
  if(!/^[0-9a-f-]{36}$/i.test(reference))return response(422,"Unknown order reference");
  const amount=Math.round(Number(payment.transaction_amount)*100),currency=String(payment.currency_id||"");
  if(!Number.isSafeInteger(amount)||amount<=0||currency!=="BRL")return response(422,"Invalid payment amount/currency");
  const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/academy_payment_provider_reconcile",{method:"POST",headers:{"authorization":"Bearer "+SERVICE,"apikey":SERVICE,"content-type":"application/json"},body:JSON.stringify({p_request:reference,p_payment_id:id,p_status:String(payment.status||""),p_amount_cents:amount,p_currency:currency,p_collector:SELLER})});
  if(!r.ok)return response(409,"Reconciliation blocked");
  return response(200,"Payment notification reconciled");
 }catch(e){return response(500,"Webhook processing error")}
});