// Server-only. Vault values are never returned to clients or logged.
export async function providerSettings(){
 const base=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const values:Record<string,string>={};
 if(base&&key){
  const r=await fetch(base+'/rest/v1/rpc/academy_provider_read',{method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw Error('Provider configuration unavailable');
  Object.assign(values,await r.json());
 }
 return (name:string)=>values[name]??Deno.env.get(name)??'';
}
