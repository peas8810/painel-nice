const URL=Deno.env.get("SUPABASE_URL")||"",SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",SECRET=Deno.env.get("ACADEMY_SIGNING_SECRET")||"";
function out(status,x){return new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"content-type,apikey,authorization","access-control-allow-methods":"GET,OPTIONS"}})}
async function api(path){const r=await fetch(URL+path,{headers:{"apikey":SR,"authorization":"Bearer "+SR}});if(!r.ok)throw Error("Backend unavailable");return await r.json()}
async function digest(text){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return new Uint8Array(await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(text)))}
function unhex(hex){if(!/^[0-9a-f]{64}$/i.test(hex||""))return null;return new Uint8Array(hex.match(/../g).map(x=>parseInt(x,16)))}
function equal(a,b){if(!b||a.length!==b.length)return false;let s=0;for(let i=0;i<a.length;i++)s|=a[i]^b[i];return s===0}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return out(200,{});
 if(req.method!=="GET")return out(405,{error:"Use GET"});
 if(!URL||!SR||SECRET.length<32)return out(503,{error:"Verificação pública ainda não habilitada"});
 const url=new URL(req.url),code=String(url.searchParams.get("codigo")||"").trim().toUpperCase();
 if(!/^ACA-[A-F0-9]{18}$/.test(code))return out(400,{valid:false,error:"Código inválido"});
 try{
  const rows=await api("/rest/v1/academy_certificates?select=*&certificate_code=eq."+encodeURIComponent(code));
  if(!rows.length)return out(404,{valid:false,error:"Código não localizado"});
  const cert=rows[0];
  if(cert.status!=="EMITIDO")return out(200,{valid:false,status:cert.status,error:"O documento não está ativo"});
  const reqs=await api("/rest/v1/academy_requests?select=id,user_id,activity,start_date,end_date,hours_verified,status&id=eq."+cert.request_id);
  const p=reqs[0];if(!p||p.status!=="APROVADO")return out(200,{valid:false,error:"Protocolo sem aprovação vigente"});
  const pays=await api("/rest/v1/academy_payment_releases?select=payment_status&request_id=eq."+p.id);
  if(pays[0]?.payment_status!=="PAGO_CONFIRMADO")return out(200,{valid:false,error:"Pagamento sem confirmação vigente"});
  const approvals=await api("/rest/v1/academy_approvals?select=hours_verified,created_at&request_id=eq."+p.id);
  const hours=Number(approvals[0]?.hours_verified??NaN);
  if(!Number.isFinite(hours))return out(200,{valid:false,error:"Horas de aprovação não localizadas"});
  const h=await digest([cert.certificate_code,p.id,p.user_id,hours].join("|"));
  if(!equal(h,unhex(cert.signature_hmac)))return out(200,{valid:false,error:"Integridade documental não confirmada"});
  const student=await api("/auth/v1/admin/users/"+p.user_id);
  const name=student.user_metadata?.full_name||"Estudante identificado no registro privado";
  const report=url.searchParams.get("tipo")==="relatorio";
  let evidence_count;
  if(report){const evidences=await api("/rest/v1/academy_evidence?select=id&request_id=eq."+p.id);evidence_count=evidences.length}
  return out(200,{valid:true,status:"ATIVO",code,name,activity:p.activity,hours,period:{start:p.start_date,end:p.end_date},issued_at:cert.issued_at,issuer:"Editora Unified Journals Network - UJN LTDA",qualification:"Atestado de verificação documental independente. Aceitação das horas depende da instituição destinatária.",...(report?{documentos_verificados:evidence_count,analise_concluida_em:approvals[0]?.created_at}: {})});
 }catch{return out(500,{error:"Consulta indisponível"})}
});