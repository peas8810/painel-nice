const URL=Deno.env.get("SUPABASE_URL")||"",SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",SECRET=Deno.env.get("RESEND_WEBHOOK_SECRET")||"";
const reply=(msg,status=200)=>new Response(msg,{status,headers:{"content-type":"text/plain"}});
async function valid(raw,headers){
 const id=headers.get("svix-id")||"",stamp=headers.get("svix-timestamp")||"",signature=headers.get("svix-signature")||"";
 if(!SECRET.startsWith("whsec_")||!id||!/^[0-9]+$/.test(stamp))return false;
 if(Math.abs(Date.now()/1000-Number(stamp))>300)return false;
 let secretBytes;try{secretBytes=Uint8Array.from(atob(SECRET.slice(6)),c=>c.charCodeAt(0))}catch{return false}
 const key=await crypto.subtle.importKey("raw",secretBytes,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(id+"."+stamp+"."+raw)));
 const signatures=signature.split(" ").filter(x=>x.startsWith("v1,"));
 for(const item of signatures){let provided;try{provided=Uint8Array.from(atob(item.slice(3)),x=>x.charCodeAt(0))}catch{continue}
 if(provided.length!==signed.length)continue;let diff=0;for(let i=0;i<signed.length;i++)diff|=signed[i]^provided[i];if(diff===0)return true}
 return false;
}
Deno.serve(async request=>{
 if(request.method!=="POST")return reply("Method not allowed",405);
 if(!URL||!SR||!SECRET)return reply("Webhook not configured",503);
 const raw=await request.text();if(raw.length>200000)return reply("Oversized event",413);
 if(!(await valid(raw,request.headers)))return reply("Invalid signature",401);
 let event;try{event=JSON.parse(raw)}catch{return reply("Invalid JSON",400)}
 const kinds={"email.delivered":"delivered","email.bounced":"bounced","email.complained":"complained"};
 const state=kinds[event.type];if(!state)return reply("Ignored",200);
 const id=event.data?.email_id||event.data?.id;
 if(typeof id!=="string"||id.length>150)return reply("Missing email ID",200);
 const response=await fetch(URL+"/rest/v1/rpc/academy_record_email_receipt",{method:"POST",headers:{apikey:SR,authorization:"Bearer "+SR,"content-type":"application/json"},body:JSON.stringify({p_provider_id:id,p_state:state,p_error:state==="delivered"?null:"Resend: "+state})});
 return reply(response.ok?"OK":"Unable to update delivery state",response.ok?200:500);
});