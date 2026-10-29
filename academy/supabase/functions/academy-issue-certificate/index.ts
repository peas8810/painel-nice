import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";
const URL=Deno.env.get("SUPABASE_URL")||"",SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const SECRET=Deno.env.get("ACADEMY_SIGNING_SECRET")||"";
const enabled=Deno.env.get("ACADEMY_ENABLE_ISSUANCE")==="sandbox";
const BASE="https://www.protocolo.me/academy/validar/";
function response(status,x){return new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","access-control-allow-origin":"https://www.protocolo.me","access-control-allow-headers":"authorization,apikey,content-type"}})}
async function api(path,method="GET",payload,key=SR){
 const r=await fetch(URL+path,{method,headers:{"apikey":key,"authorization":"Bearer "+key,"content-type":"application/json","prefer":"return=representation"},body:payload===undefined?undefined:JSON.stringify(payload)});
 const content=await r.text();if(!r.ok)throw Error("Backend "+r.status+" "+content.slice(0,100));return content?JSON.parse(content):[];
}
async function authorized(req){
 const auth=req.headers.get("authorization")||"";
 if(auth==="Bearer "+SR)return true;
 const token=auth.replace(/^Bearer /,"");
 if(!token)return false;
 const user=await fetch(URL+"/auth/v1/user",{headers:{"apikey":ANON,"authorization":"Bearer "+token}});
 if(!user.ok)return false;
 const u=await user.json();const roles=await api("/rest/v1/academy_admin_members?select=user_id&user_id=eq."+encodeURIComponent(u.id)+"&enabled=eq.true");
 return roles.length>0;
}
async function hmac(message){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message))),x=>x.toString(16).padStart(2,"0")).join("")}
async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("")}
function pngData(raw){const b64=raw.split(",")[1],bin=atob(b64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes}
function fit(s,max=100){return String(s??"").replace(/[\r\n\t]+/g," ").slice(0,max)}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return response(200,{});
 if(req.method!=="POST")return response(405,{error:"Method"});
 if(!URL||!SR||!ANON||SECRET.length<32||!enabled)return response(503,{error:"Certificate issuer disabled until sandbox configuration and tests"});
 try{
  if(!(await authorized(req)))return response(403,{error:"Administrative authorization required"});
  const input=await req.json(),id=String(input.request_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(id))return response(400,{error:"Invalid request"});
  const [payments,requests,approvals,evidences,certs]=await Promise.all([
   api("/rest/v1/academy_payment_releases?select=payment_status,mp_payment_id&request_id=eq."+id),
   api("/rest/v1/academy_requests?select=*&id=eq."+id),
   api("/rest/v1/academy_approvals?select=hours_verified&request_id=eq."+id),
   api("/rest/v1/academy_evidence?select=id,review_status&request_id=eq."+id),
   api("/rest/v1/academy_certificates?select=*&request_id=eq."+id)]);
  const pay=payments[0],p=requests[0],approval=approvals[0],cert=certs[0];
  if(!pay||pay.payment_status!=="PAGO_CONFIRMADO"||!pay.mp_payment_id||!p||p.status!=="APROVADO"||!approval||!cert)return response(409,{error:"Missing approved protocol or verified payment"});
  if(evidences.length===0||evidences.some(x=>x.review_status!=="VALIDADO"))return response(409,{error:"All evidence must be validated"});
  if(cert.status==="EMITIDO")return response(200,{issued:true,code:cert.certificate_code,existing:true});
  if(cert.status!=="PENDENTE_EMISSAO")return response(409,{error:"Certificate not eligible"});
  const student=await api("/auth/v1/admin/users/"+p.user_id);
  const fullName=fit(student.user_metadata?.full_name||student.email?.split("@")[0]||"Estudante",90);
  const hours=Number(approval.hours_verified);
  const sign=await hmac([cert.certificate_code,p.id,p.user_id,hours].join("|"));
  const verifyURL=BASE+"?codigo="+encodeURIComponent(cert.certificate_code);
  const reportURL=verifyURL+"&tipo=relatorio";
  const doc=await PDFDocument.create(),page=doc.addPage([842,595]);
  const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(.07,.17,.25),teal=rgb(.02,.43,.45);
  page.drawRectangle({x:0,y:0,width:842,height:595,color:rgb(.975,.986,.987)});
  page.drawRectangle({x:25,y:25,width:792,height:545,borderColor:teal,borderWidth:2});
  const line=(text,x,y,size=14,strong=false,color=navy)=>page.drawText(fit(text,120),{x,y,size,font:strong?bold:regular,color});
  line("EDITORA UJN | PROTOCOLO ACADEMY",55,532,13,true,teal);
  line("CERTIFICADO DE ATIVIDADE DOCUMENTADA",55,473,23,true);
  line("Certificamos, mediante verificacao documental independente, que",55,434,13);
  line(fullName,55,406,20,true);
  line("apresentou evidencias da seguinte atividade:",55,376,13);
  line(fit(p.activity,78),55,348,15,true);
  line("Periodo: "+fit(p.start_date,10)+" a "+fit(p.end_date,10),55,312,12);
  line("Carga horaria documentalmente verificada: "+hours+" hora(s)",55,285,13,true,teal);
  line("Registro publico: "+cert.certificate_code,55,255,11,true);
  line("Assinatura de integridade: "+sign.slice(0,24).toUpperCase(),55,233,9);
  const qrA=await doc.embedPng(pngData(await QRCode.toDataURL(verifyURL,{width:160,margin:1,errorCorrectionLevel:"M"})));
  const qrB=await doc.embedPng(pngData(await QRCode.toDataURL(reportURL,{width:160,margin:1,errorCorrectionLevel:"M"})));
  page.drawImage(qrA,{x:525,y:95,width:100,height:100});page.drawImage(qrB,{x:662,y:95,width:100,height:100});
  line("Autenticidade",535,83,9);line("Relatorio",687,83,9);
  line("Este documento comprova a analise da Editora UJN; nao garante aproveitamento de horas por instituicoes.",55,55,9);
  const binary=await doc.save(),digest=await sha256(binary),path=p.user_id+"/"+p.id+"/"+cert.certificate_code+".pdf";
  const upload=await fetch(URL+"/storage/v1/object/academy-certificados/"+path,{method:"POST",headers:{"apikey":SR,"authorization":"Bearer "+SR,"content-type":"application/pdf","x-upsert":"false"},body:binary});
  if(!upload.ok&&upload.status!==409)throw Error("Storage failed "+upload.status);
  await api("/rest/v1/academy_certificates?request_id=eq."+id,"PATCH",{status:"EMITIDO",pdf_path:path,pdf_sha256:digest,signature_hmac:sign,issued_at:new Date().toISOString()});
  await api("/rest/v1/academy_event_log","POST",{request_id:id,event_type:"CERTIFICADO_EMITIDO",metadata:{code:cert.certificate_code,pdf_sha256:digest}});
  await api("/rest/v1/academy_email_outbox?on_conflict=request_id,kind","POST",{request_id:id,kind:"CERTIFICATE_READY",recipient:student.email,status:"PENDENTE"}).catch(()=>null);
  return response(200,{issued:true,code:cert.certificate_code});
 }catch(e){return response(500,{error:"Certificate could not be issued",detail:String(e?.message||e).slice(0,110)})}
});