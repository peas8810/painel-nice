const URL=Deno.env.get('SUPABASE_URL')||'',ANON=Deno.env.get('SUPABASE_ANON_KEY')||'',KEY=Deno.env.get('OPENAI_API_KEY')||'',SR=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const origin='https://www.protocolo.me';
function respond(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','access-control-allow-origin':origin,'access-control-allow-headers':'authorization,apikey,content-type','access-control-allow-methods':'POST,OPTIONS'}})}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return respond({});
 if(req.method!=='POST')return respond({error:'Método não permitido'},405);
 if(!KEY)return respond({error:'A leitura por IA aguarda configuração administrativa.'},503);
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return respond({error:'Sessão necessária'},401);
 const userResp=await fetch(URL+'/auth/v1/user',{headers:{apikey:ANON,authorization:bearer}});
 if(!userResp.ok)return respond({error:'Sessão inválida'},401);const user=await userResp.json();
 try{
 const {base64,mime,filename}=await req.json();
 if(!['application/pdf','image/jpeg','image/png'].includes(mime)||typeof base64!=='string'||base64.length>7100000||!/^[a-zA-Z0-9+/=]+$/.test(base64))return respond({error:'Arquivo incompatível ou excede 5 MB'},400);
 const quota=await fetch(URL+'/rest/v1/rpc/academy_claim_ai_quota',{method:'POST',headers:{apikey:SR,authorization:'Bearer '+SR,'content-type':'application/json'},body:JSON.stringify({p_user:user.id})});if(!quota.ok)return respond({error:'Não foi possível verificar o limite de uso da IA.'},503);if(!(await quota.json()))return respond({error:'Limite diário de cinco leituras por estudante atingido.'},429);
 const prompt='Analise um comprovante de atividade acadêmica enviado pelo próprio estudante. Extraia apenas informações EXPLICITAMENTE visíveis no documento. Não invente nenhuma informação. Responda somente JSON sem markdown, usando as chaves activity, activity_type, start_date, end_date, hours_declared, description; utilize null quando não estiver explícito. Datas no formato YYYY-MM-DD. Horas numéricas. A descrição deve ser resumida de maneira fiel, sem inferir participação.';
 const content=[{type:'input_text',text:prompt}];
 if(mime==='application/pdf')content.push({type:'input_file',filename:String(filename||'comprovante.pdf').slice(0,120),file_data:'data:application/pdf;base64,'+base64});
 else content.push({type:'input_image',image_url:'data:'+mime+';base64,'+base64});
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+KEY,'content-type':'application/json'},body:JSON.stringify({model:Deno.env.get('ACADEMY_AI_MODEL')||'gpt-4.1-mini',input:[{role:'user',content}],max_output_tokens:420})});
 if(!response.ok)return respond({error:'Serviço de IA indisponível. Tente preencher manualmente.'},502);
 const payload=await response.json(),txt=(payload.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 const cleaned=txt.trim().replace(/^\x60\x60\x60(?:json)?/i,'').replace(/\x60\x60\x60$/,'').trim();
 const parsed=JSON.parse(cleaned);const fields={};for(const k of ['activity','activity_type','start_date','end_date','hours_declared','description'])fields[k]=parsed[k]??null;
 return respond({fields,warning:'Revise todos os dados; o documento ainda exige conferência administrativa.'});
 }catch{return respond({error:'Não foi possível analisar este documento. Preencha manualmente.'},422)}
});