const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
const headers={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,mcp-protocol-version","access-control-allow-methods":"POST,OPTIONS"};
const catalog=[{name:"academy_my_protocols",description:"Read only your own protocols",inputSchema:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:30}}}},{name:"academy_my_certificates",description:"Read only issued certificates linked to your account",inputSchema:{type:"object",properties:{}}},{name:"academy_help",description:"Explain how to submit evidence and monitor protocols",inputSchema:{type:"object",properties:{}}}];
const send=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const ok=(id,result)=>send({jsonrpc:"2.0",id,result});
const fail=(id,code,message)=>send({jsonrpc:"2.0",id,error:{code,message}});
async function get(path,token){const r=await fetch(url+"/rest/v1/"+path,{headers:{apikey:anon,authorization:token}});if(!r.ok)throw Error("Consulta recusada");return r.json()}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return send({error:"Use JSON-RPC POST"},405);
 let input;try{input=await req.json()}catch{return send({error:"Invalid JSON"},400)}
 const id=input.id??null;
 if(input.method==="initialize")return ok(id,{protocolVersion:"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"protocolo-academy",version:"0.1.0"}});
 if(input.method==="notifications/initialized")return new Response(null,{status:202,headers});
 if(input.method==="ping")return ok(id,{});
 if(input.method==="tools/list")return ok(id,{tools:catalog});
 if(input.method!=="tools/call")return fail(id,-32601,"Unknown method");
 const token=req.headers.get("authorization")||"";
 if(!token.startsWith("Bearer "))return fail(id,-32001,"Authentication required");
 const userResponse=await fetch(url+"/auth/v1/user",{headers:{apikey:anon,authorization:token}});
 if(!userResponse.ok)return fail(id,-32001,"Invalid session");
 const user=await userResponse.json();if(!user.id)return fail(id,-32001,"Invalid user");
 const name=input.params?.name; if(!catalog.some(t=>t.name===name))return fail(id,-32602,"Unknown tool");
 try{
 let result;
 if(name==="academy_help")result={message:"Entre em https://www.protocolo.me/academy/portal/, registre a atividade e anexe PDF, JPG ou PNG. O parecer e as horas são definidos pela equipe autorizada."};
 if(name==="academy_my_protocols"){const limit=Math.max(1,Math.min(30,Number(input.params?.arguments?.limit)||10));result=await get("academy_requests?select=id,activity,status,hours_declared,hours_verified,created_at&user_id=eq."+encodeURIComponent(user.id)+"&order=created_at.desc&limit="+limit,token)}
 if(name==="academy_my_certificates"){const own=await get("academy_requests?select=id&user_id=eq."+encodeURIComponent(user.id)+"&limit=500",token);result=own.length?await get("academy_certificates?select=request_id,certificate_code,status,issued_at&request_id=in.("+own.map(x=>x.id).join(",")+")&status=eq.EMITIDO",token):[]}
 return ok(id,{content:[{type:"text",text:JSON.stringify(result)}]})
 }catch{return ok(id,{isError:true,content:[{type:"text",text:"Consulta indisponível com as permissões desta conta."}]})}
});