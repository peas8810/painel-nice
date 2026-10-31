const origin="https://www.protocolo.me",url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",key=Deno.env.get("OPENAI_API_KEY")||"";
const headers={"content-type":"application/json","access-control-allow-origin":origin,"access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS"};
function send(data,status=200){return new Response(JSON.stringify(data),{status,headers})}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return send({error:"Método inválido"},405);
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))return send({error:"Autenticação necessária"},401);
 const user=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,authorization:auth}});if(!user.ok)return send({error:"Sessão inválida"},401);const identity=await user.json();
 let story;try{story=(await req.json()).story}catch{return send({error:"Corpo inválido"},400)}
 if(typeof story!=="string"||story.trim().length<15||story.length>1200)return send({error:"Descreva a atividade em até 1200 caracteres"},400);
 if(!key||!service)return send({error:"Assistente de IA aguardando configuração. Utilize o formulário guiado."},503);const quota=await fetch(url+"/rest/v1/rpc/academy_claim_ai_quota",{method:"POST",headers:{apikey:service,authorization:"Bearer "+service,"content-type":"application/json"},body:JSON.stringify({p_user:identity.id})});if(!quota.ok)return send({error:"Controle de uso da IA indisponível"},503);if(!(await quota.json()))return send({error:"Limite de cinco análises diárias atingido."},429);
 const prompt="Extraia dados declarados pelo estudante para um RASCUNHO, nunca invente fatos. Responda somente JSON com activity, activity_type, start_date, end_date, hours_declared, description, missing (array de textos). Datas em YYYY-MM-DD; se ausente, null. Horas numéricas ou null. Activity até 180 caracteres, description até 1000. Não certifique, aprove ou valide qualquer dado. Descrição do estudante: "+story.trim();
 try{const result=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({model:Deno.env.get("ACADEMY_AI_MODEL")||"gpt-4.1-mini",input:prompt,max_output_tokens:550})});
 if(!result.ok)return send({error:"Serviço de IA temporariamente indisponível"},502);
 const payload=await result.json(),text=(payload.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("").replace(/^```json\s*/,"").replace(/```$/,"").trim();const raw=JSON.parse(text);const fields={};
 for(const name of ["activity","activity_type","start_date","end_date","description"]){fields[name]=typeof raw[name]==="string"?raw[name].slice(0,name==="description"?1000:180):null}
 fields.hours_declared=Number.isFinite(Number(raw.hours_declared))&&Number(raw.hours_declared)>0&&Number(raw.hours_declared)<=1000?Number(raw.hours_declared):null;
 const missing=Array.isArray(raw.missing)?raw.missing.filter(x=>typeof x==="string").slice(0,5):[];
 return send({fields,missing,requires_confirmation:true});
 }catch{return send({error:"Não foi possível interpretar a descrição. Complete os dados manualmente."},422)}
});