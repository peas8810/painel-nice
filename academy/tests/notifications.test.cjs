const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../supabase/functions/academy-dispatch-notifications/index.ts'),'utf8');
async function run(link){
 let handler;const calls=[];
 const values={SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test',SUPABASE_ANON_KEY:'test',RESEND_API_KEY:'test',ACADEMY_EMAIL_FROM:'test@example.invalid',ACADEMY_DISPATCH_CRON_SECRET:'test-cron'};
 const response=x=>new Response(JSON.stringify(x),{status:200});
 vm.runInNewContext(code,{URL,Response,Deno:{env:{get:k=>values[k]},serve:fn=>handler=fn},fetch:async(url,opts)=>{
  calls.push({url,opts});
  if(url.includes('academy_claim_notification'))return response([{id:1,kind:'PAYMENT_RELEASED',channel:'EMAIL',user_id:'user',request_id:'request',recipient:'student@example.invalid'}]);
  if(url.includes('delivery_enabled'))return response(true);
  if(url.includes('academy_payment_releases'))return response([{checkout_url:link,payment_status:'AGUARDANDO_PAGAMENTO'}]);
  if(url==='https://api.resend.com/emails')return response({id:'test-provider-id'});
  return response([]);
 }});
 const result=await handler(new Request('https://example.invalid',{method:'POST',headers:{'x-academy-cron-secret':'test-cron'}}));
 return {body:await result.json(),calls};
}
test('payment notification accepts provider URL without shadowing the URL constructor',async()=>{
 const r=await run('https://www.mercadopago.com.br/checkout/test');assert.equal(r.body.status,'accepted_by_provider');assert.ok(r.calls.some(x=>x.url==='https://api.resend.com/emails'));
});
test('untrusted payment URL never reaches email provider',async()=>{
 const r=await run('https://mercadopago.com.br.evil.invalid/checkout');assert.equal(r.body.status,'FAILED');assert.ok(!r.calls.some(x=>x.url==='https://api.resend.com/emails'));
});
