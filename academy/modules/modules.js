import {qualityMetrics,detectFormat} from '../assets/document-quality.mjs';
const $=id=>document.getElementById(id),cfg=window.ACADEMY_AUTH_CONFIG,db=window.supabase.createClient(cfg.url,cfg.publishableKey);
let state={},user=null,file=null,image=null,angle=0,flowId=null,poll=null,loading=false;
const flowToken=new URLSearchParams(location.hash.slice(1)).get('flow');
const status=t=>$('status').textContent=t;
async function api(action,args={}){const {data,error}=await db.functions.invoke('academy-modules',{body:{action,...args}});if(error||data?.error)throw Error(data?.error||error.message);return data;}
function option(el,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;el.append(o);}
function button(parent,label,fn){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>busy(b,fn);parent.append(b);return b;}
async function busy(b,fn){if(b.disabled)return;b.disabled=true;try{await fn();}catch(e){status(e.message);}finally{b.disabled=false;}}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function load(){if(loading)return;loading=true;try{
 const {data:{user:u}}=await db.auth.getUser();user=u;$('login').hidden=Boolean(u);$('workspace').hidden=!u;if(!u){status('Entre com a mesma conta usada no protocolo.');return;}
 const selected=$('request').value,tenant=$('tenant').value;state=await api('inventory');
 for(const key of ['request','tenant','share-asset','certificate'])$(key).replaceChildren();
 for(const r of state.requests)option($('request'),r.id,r.activity+' · '+r.status);
 if(state.requests.some(r=>r.id===selected))$('request').value=selected;
 for(const t of state.institutions)option($('tenant'),t.id,t.name);if(state.institutions.some(t=>t.id===tenant))$('tenant').value=tenant;
 for(const e of state.evidence)option($('share-asset'),'evidence:'+e.id,e.file_name);
 for(const c of state.certificates.filter(c=>c.status==='EMITIDO')){option($('share-asset'),'certificate:'+c.id,'Certificado '+c.certificate_code);option($('certificate'),c.id,c.certificate_code);}
 renderDocuments();renderShares();await rules();status('Sua conta está pronta.');
 if(flowToken){const result=await api('flow_resolve',{token:flowToken});$('request').value=result.request.id;renderDocuments();status('Celular conectado a: '+result.request.activity+'. Fotografe e anexe o documento.');}
 }finally{loading=false;}}
function renderDocuments(){const el=$('documents');el.replaceChildren();for(const e of (state.evidence||[]).filter(x=>x.request_id===$('request').value)){
 const row=document.createElement('div'),p=document.createElement('p');p.textContent=e.file_name+' · '+e.review_status;row.append(p);
 button(row,'Verificar integridade',async()=>{const s=await api('document_seal',{id:e.id});p.textContent=e.file_name+' · SHA-256: '+s.sha256+' · '+s.meaning;});
 button(row,'Histórico',async()=>{const h=await api('document_history',{id:e.id});const pre=document.createElement('pre');pre.textContent=JSON.stringify(h,null,2);row.append(pre);});el.append(row);
}}
function renderShares(){const el=$('shares');el.replaceChildren();for(const s of state.shares||[]){const p=document.createElement('p');p.textContent=(s.revoked_at?'Revogado':'Válido até '+new Date(s.expires_at).toLocaleString('pt-BR'))+' · '+s.id;el.append(p);if(!s.revoked_at)button(el,'Revogar link',async()=>{await api('share_revoke',{id:s.id});await load();});}}
async function rules(){const el=$('category');el.replaceChildren();if(!$('tenant').value){option(el,'','Nenhuma instituição vinculada');return;}const {rules}=await api('regulations',{tenant_id:$('tenant').value});for(const cat of [...new Set(rules.map(x=>x.category))])option(el,cat,cat);if(!rules.length)option(el,'','Nenhuma regra publicada');}
async function selectFile(f){file=f;image=null;angle=0;$('preview').hidden=true;$('rotate').hidden=true;$('use-adjusted').checked=false;$('complete').checked=false;if(!f)return;
 const mime=detectFormat(new Uint8Array(await f.slice(0,8).arrayBuffer()));if(!mime||f.size>10485760){file=null;throw Error('Use PDF, JPG ou PNG de até 10 MB.');}
 if(mime==='application/pdf'){$('quality').textContent='PDF: confira todas as páginas, identificação, datas e horas. A legibilidade exige revisão humana.';return;}
 image=await createImageBitmap(f);draw();$('preview').hidden=false;$('rotate').hidden=false;
}
function draw(){const canvas=$('preview'),scale=Math.min(1,1400/Math.max(image.width,image.height)),w=Math.round(image.width*scale),h=Math.round(image.height*scale);canvas.width=angle%180?h:w;canvas.height=angle%180?w:h;const c=canvas.getContext('2d');c.translate(canvas.width/2,canvas.height/2);c.rotate(angle*Math.PI/180);c.drawImage(image,-w/2,-h/2,w,h);c.setTransform(1,0,0,1,0,0);
 const small=document.createElement('canvas');small.width=200;small.height=Math.max(1,Math.round(200*canvas.height/canvas.width));const ctx=small.getContext('2d');ctx.drawImage(canvas,0,0,small.width,small.height);const q=qualityMetrics(ctx.getImageData(0,0,small.width,small.height).data,small.width,small.height);$('quality').textContent='Qualidade técnica estimada: '+q.score+'/100. '+q.warnings.join('. ')+'. '+q.disclaimer;
}
$('document').onchange=()=>selectFile($('document').files[0]).catch(e=>status(e.message));$('camera-file').onchange=()=>selectFile($('camera-file').files[0]).catch(e=>status(e.message));$('camera').onclick=()=>$('camera-file').click();$('rotate').onclick=()=>{angle=(angle+90)%360;draw();};
$('upload').onclick=()=>busy($('upload'),async()=>{
 if(!file||!$('request').value||!$('complete').checked)throw Error('Escolha o documento, o protocolo e confirme a conferência.');
 const req=state.requests.find(r=>r.id===$('request').value);if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(req?.status))throw Error('Este protocolo não aceita anexos.');
 if(flowToken)await api('flow_resolve',{token:flowToken});
 let upload=file;if(image&&$('use-adjusted').checked)upload=new File([await new Promise(resolve=>$('preview').toBlob(resolve,'image/jpeg',.92))],'documento-ajustado.jpg',{type:'image/jpeg'});
 const mime=detectFormat(new Uint8Array(await upload.slice(0,8).arrayBuffer())),ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'}[mime];const path=user.id+'/'+req.id+'/'+crypto.randomUUID()+'.'+ext;
 const {error:up}=await db.storage.from('academy-evidencias').upload(path,upload,{contentType:mime,upsert:false});if(up)throw up;
 const {data:row,error}=await db.from('academy_evidence').insert({request_id:req.id,file_path:path,file_name:upload.name.slice(0,240),category:$('document-category').value}).select('id').single();
 if(error){await db.storage.from('academy-evidencias').remove([path]);throw error;}
 let sealed=true;try{await api('document_seal',{id:row.id});}catch{sealed=false;}
 file=null;image?.close();image=null;$('preview').hidden=true;$('rotate').hidden=true;$('document').value='';$('camera-file').value='';await load();status(sealed?'Documento anexado e integridade registrada.':'Documento anexado. Use Verificar integridade para concluir o registro.');
});
$('request').onchange=renderDocuments;$('tenant').onchange=()=>rules().catch(e=>status(e.message));
$('flow').onclick=()=>busy($('flow'),async()=>{if(flowId)await api('flow_revoke',{id:flowId});const r=await api('flow_create',{request_id:$('request').value});flowId=r.id;const box=$('flow-result');box.replaceChildren();const img=document.createElement('img');img.src=r.qr;img.alt='QR Code para continuar no celular';const a=document.createElement('a');a.href=r.link;a.textContent='Abrir neste aparelho';box.append(img,a);$('flow-stop').hidden=false;clearInterval(poll);const initial=state.evidence.length;poll=setInterval(async()=>{if(Date.parse(r.expires_at)<=Date.now()){clearInterval(poll);box.textContent='Vínculo expirado.';return;}try{const current=await api('inventory');if(current.evidence.length!==state.evidence.length){state=current;renderDocuments();status('Documento recebido do outro aparelho.');}}catch{clearInterval(poll);}},10000);});
$('flow-stop').onclick=()=>busy($('flow-stop'),async()=>{if(flowId)await api('flow_revoke',{id:flowId});flowId=null;clearInterval(poll);$('flow-result').replaceChildren();$('flow-stop').hidden=true;});
$('ask').onclick=()=>busy($('ask'),async()=>{const r=await api('copilot',{tenant_id:$('tenant').value,category:$('category').value,hours:Number($('hours').value),question:$('question').value});const box=$('answer');box.replaceChildren();const p=document.createElement('p');p.textContent=r.answer;box.append(p);for(const c of r.citations){const title=document.createElement('strong'),quote=document.createElement('blockquote'),a=document.createElement('a');title.textContent=c.title+' · versão '+c.version;quote.textContent=c.text;a.href=c.url;a.textContent='Consultar fonte';a.target='_blank';a.rel='noopener noreferrer';box.append(title,quote,a);}});
$('share').onclick=()=>busy($('share'),async()=>{const [kind,id]=$('share-asset').value.split(':');if(!confirm('Compartilhar este documento com qualquer pessoa que receber o link?'))return;const r=await api('share_create',{kind,id,hours:Number($('share-hours').value)});const box=$('share-result');box.replaceChildren();const a=document.createElement('a');a.href=r.link;a.textContent=r.link;box.append(a);await load();});
$('credential').onclick=()=>busy($('credential'),async()=>{const r=await api('credential_issue',{id:$('certificate').value});download(new Blob([r.jwt],{type:'application/vc+jwt'}),'academy-credencial.jwt');status('Credencial assinada baixada.');});
$('credential-revoke').onclick=()=>busy($('credential-revoke'),async()=>{if(!confirm('Revogar esta credencial digital? O certificado PDF mantém seu próprio status.'))return;await api('credential_revoke',{id:$('certificate').value});status('Credencial digital revogada.');});
$('retry').onclick=()=>load().catch(e=>status(e.message));db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearInterval(poll);$('workspace').hidden=true;$('flow-result').replaceChildren();$('share-result').replaceChildren();state={};user=null;}});window.addEventListener('pagehide',()=>clearInterval(poll));load().catch(e=>status(e.message));
