// Admin-only transfer of archived Google Drive originals into private Supabase Storage.
const URL=Deno.env.get("SUPABASE_URL")||"",SR=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
function out(status,payload){return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json"}})}
async function api(path,{method="GET",body,token=SR,apikey=SR}={}){
 const res=await fetch(URL+path,{method,headers:{"apikey":apikey,"authorization":"Bearer "+token,"content-type":"application/json","prefer":"return=representation"},body:body===undefined?undefined:JSON.stringify(body)});
 const txt=await res.text();if(!res.ok)throw Error("Supabase HTTP "+res.status);
 return txt?JSON.parse(txt):[];
}
function decode64(s){const binary=atob(s.replace(/\s+/g,""));const array=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)array[i]=binary.charCodeAt(i);return array}
function shaHex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{
 if(req.method!=="POST")return out(405,{error:"Method not allowed"});
 if(!SR||!URL||!ANON)return out(503,{error:"Not configured"});
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 if(!jwt)return out(401,{error:"Login required"});
 try{
  const user=await api("/auth/v1/user",{token:jwt,apikey:ANON});
  const member=await api("/rest/v1/academy_admin_members?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&enabled=eq.true");
  if(!member?.length)return out(403,{error:"Not authorized"});
  const pending=await api("/rest/v1/rpc/academy_migration_pending_blobs",{method:"POST",body:{}});
  const result=[];
  for(const item of pending.slice(0,20)){
   const x=await api("/rest/v1/rpc/academy_migration_blob",{method:"POST",body:{p_id:item.source_evidence_id}});
   const buffer=decode64(x.base64);
   const hash=shaHex(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)));
   if(hash!==x.sha256)throw Error("Checksum mismatch for "+x.id);
   const ext=x.mime==="application/pdf"?"pdf":x.mime==="text/plain"?"txt":x.mime==="image/png"?"png":"jpg";
   const path=encodeURIComponent(x.id)+"/original."+ext;
   const upload=await fetch(URL+"/storage/v1/object/academy-legado/"+path,{
    method:"POST",headers:{"apikey":SR,"authorization":"Bearer "+SR,"content-type":x.mime,"x-upsert":"true"},body:buffer
   });
   if(!upload.ok)throw Error("Storage upload failed: "+upload.status);
   await api("/rest/v1/academy_legacy_evidence_index?source_id=eq."+encodeURIComponent(x.id),{method:"PATCH",body:{migrated_storage_path:decodeURIComponent(path)}});
   result.push({source_id:x.id,bytes:buffer.length,verified:true});
  }
  return out(200,{transferred:result.length,files:result});
 }catch(e){return out(500,{error:"Transfer interrupted; source archive intact",detail:String(e?.message||e).slice(0,120)})}
});