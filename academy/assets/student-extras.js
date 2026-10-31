/* Academy: mobile wizard, drafts, camera, AI suggestion, attention, wallet and conversation. */
(()=>{
const $=id=>document.getElementById(id),cfg=window.ACADEMY_AUTH_CONFIG||{};
const db=window.academyDb||(window.supabase?.createClient&&cfg.url&&cfg.publishableKey?window.supabase.createClient(cfg.url,cfg.publishableKey):null);
if(!db||!$('request'))return;
let step=1,saveTimer=null,draftLoadedFor=null,selectedFile=null;
const ids=['activity','activity-type','start','end','hours','description'];
const data=()=>Object.fromEntries(ids.map(id=>[id,$(id).value]));
function setStep(n){
 step=Math.max(1,Math.min(3,n));
 document.querySelectorAll('.wizard-panel').forEach(el=>el.hidden=Number(el.dataset.step)!==step);
 $('wizard-back').hidden=step===1;$('wizard-next').hidden=step===3;
 $('request-submit').hidden=step!==3;
 $('wizard-label').textContent='Passo '+step+' de 3: '+(['Dados da atividade','Datas e descrição','Conferência final'][step-1]);
 $('wizard-progress').value=step;
 if(step===3){const box=$('wizard-review');box.replaceChildren();for(const [label,value] of [['Atividade',$('activity').value],['Tipo',$('activity-type').value],['Período',$('start').value+' a '+$('end').value],['Horas',$('hours').value],['Descrição',$('description').value]]){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(value));box.append(p)}}
}
window.academyWizardSetStep=setStep;setStep(1);$('request').addEventListener('submit',e=>{if(step!==3){e.preventDefault();e.stopImmediatePropagation();if(validStep(step))setStep(step+1)}},true);
function validStep(n){for(const el of document.querySelectorAll('.wizard-panel[data-step="'+n+'"] input,.wizard-panel[data-step="'+n+'"] textarea,.wizard-panel[data-step="'+n+'"] select'))if(!el.reportValidity())return false;if(n===2){if($('end').value<$('start').value){$('end').setCustomValidity('A data final deve ser igual ou posterior à inicial.');$('end').reportValidity();return false}$('end').setCustomValidity('');if($('description').value.trim().length<15){$('description').setCustomValidity('Descreva sua atividade com pelo menos 15 caracteres.');$('description').reportValidity();return false}$('description').setCustomValidity('')}return true}
$('wizard-next').onclick=()=>{if(validStep(step))setStep(step+1)};
$('wizard-back').onclick=()=>setStep(step-1);
$('end').addEventListener('input',()=> $('end').setCustomValidity(''));
$('description').addEventListener('input',()=> $('description').setCustomValidity(''));
function readForm(d){if(!d||typeof d!=='object')return;for(const id of ids){if(typeof d[id]==='string'&&d[id].length<2500){if(id==='activity-type'&&![...$(id).options].some(o=>o.value===d[id])){const o=document.createElement('option');o.value=d[id];o.textContent=d[id];$(id).append(o)}$(id).value=d[id]}}}
const localDraftKey=id=>'academy_student_draft_'+id;
async function sessionUser(){const {data}=await db.auth.getSession();return data.session?.user||null}
async function loadDraft(){
 const user=await sessionUser();if(!user||draftLoadedFor===user.id)return;draftLoadedFor=user.id;
 let local=null;try{local=JSON.parse(localStorage.getItem(localDraftKey(user.id))||'null')}catch{}
 const {data:row}=await db.from('academy_request_drafts').select('payload,updated_at').eq('user_id',user.id).maybeSingle();
 const remote=row?.payload,fields=local?.fields||remote;
 if(fields&&Object.values(fields).some(Boolean)&&!$('activity').value){readForm(fields);const n=document.createElement('p');n.className='notice';n.textContent='Seu rascunho foi recuperado. Confira os dados antes de enviar.';$('request-status').after(n)}
}
async function saveDraft(){
 const user=await sessionUser();if(!user)return;
 const fields=data();try{localStorage.setItem(localDraftKey(user.id),JSON.stringify({fields,updated_at:Date.now()}))}catch{}
 await db.from('academy_request_drafts').upsert({user_id:user.id,payload:fields,updated_at:new Date().toISOString()},{onConflict:'user_id'});
}
$('request').addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,950)});
window.addEventListener('academy-request-saved',async()=>{clearTimeout(saveTimer);const {data:{user}}=await db.auth.getUser();if(user){await db.from('academy_request_drafts').delete().eq('user_id',user.id);try{localStorage.removeItem(localDraftKey(user.id))}catch{}}setStep(1)});
db.auth.onAuthStateChange((event,session)=>{if(session?.user&&event!=='TOKEN_REFRESHED')setTimeout(loadDraft,100)});
setTimeout(loadDraft,600);
async function refreshOverview(){
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const [rs,ev,cs]=await Promise.all([db.from('academy_requests').select('id,activity,status').eq('user_id',user.id).neq('status','CANCELADA').order('created_at',{ascending:false}).limit(100),db.from('academy_evidence').select('request_id,review_status').eq('user_id',user.id),db.from('academy_certificates').select('request_id,status,certificate_code,pdf_path')]);
 const requests=rs.data||[],evidence=ev.data||[],certs=cs.data||[];
 const el=$('attention-list');el.replaceChildren();let count=0;
 for(const r of requests){
  const evs=evidence.filter(e=>e.request_id===r.id),pending=r.status==='PENDENTE_DOCUMENTOS'||(!evs.length&&['ENVIADA','EM_ANALISE'].includes(r.status));
  if(!pending)continue;count++;const row=document.createElement('button');row.type='button';row.className='attention-row';row.textContent='Anexar comprovante · '+r.activity;row.onclick=()=>{$('evidence-request').value=r.id;$('upload-section').scrollIntoView({behavior:'smooth'})};el.append(row);
 }
 if(!count)el.textContent='Nenhuma pendência documental identificada. Acompanhe seus pedidos abaixo.';
 const wallet=$('certificate-list');wallet.replaceChildren();const issued=certs.filter(c=>c.status==='EMITIDO'&&c.pdf_path&&requests.some(r=>r.id===c.request_id));
 if(!issued.length)wallet.textContent='Seus certificados emitidos aparecerão aqui após aprovação e pagamento confirmado.';
 for(const c of issued){const row=document.createElement('article');row.className='request-item';const label=document.createElement('strong');label.textContent='Certificado · '+(c.certificate_code||c.request_id);const dl=document.createElement('button');dl.type='button';dl.className='plain-action';dl.textContent='Baixar PDF';dl.onclick=async()=>{const {data,error}=await db.storage.from('academy-certificados').createSignedUrl(c.pdf_path,60);if(error){alert('Não foi possível abrir o certificado: '+error.message);return}window.open(data.signedUrl,'_blank','noopener,noreferrer')};const verify=document.createElement('a');verify.href='../validar/?codigo='+encodeURIComponent(c.certificate_code);verify.textContent='Validar código';verify.target='_blank';verify.rel='noopener noreferrer';row.append(label,dl,verify);wallet.append(row)}
}
window.addEventListener('academy-requests-loaded',refreshOverview);setTimeout(refreshOverview,1400);
$('camera-upload').onclick=()=>$('camera-file').click();
$('evidence-file').addEventListener('change',()=>{selectedFile=$('evidence-file').files?.[0]||null});
$('camera-file').addEventListener('change',()=>{const f=$('camera-file').files?.[0];if(f){selectedFile=f;openCrop(f)}});
function openCrop(file){
 const overlay=document.createElement('div');overlay.className='academy-modal';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 const inner=document.createElement('section');inner.className='academy-modal-inner';const h=document.createElement('h3');h.textContent='Conferir foto do comprovante';
 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1200;canvas.className='crop-preview';
 const zoom=document.createElement('input');zoom.type='range';zoom.min='1';zoom.max='2';zoom.step='.05';zoom.value='1';zoom.setAttribute('aria-label','Aproximar foto');
 const original=document.createElement('button');original.textContent='Usar foto original';original.type='button';original.className='primary';
 const crop=document.createElement('button');crop.textContent='Recortar e enviar';crop.type='button';crop.className='primary';
 const close=document.createElement('button');close.textContent='Cancelar';close.type='button';close.className='plain-action';
 const image=new Image(),objectUrl=URL.createObjectURL(file);
 const ctx=canvas.getContext('2d');
 const draw=()=>{if(!image.naturalWidth)return;const scale=Math.max(canvas.width/image.width,canvas.height/image.height)*Number(zoom.value);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,(canvas.width-image.width*scale)/2,(canvas.height-image.height*scale)/2,image.width*scale,image.height*scale)};
 image.onload=draw;image.src=objectUrl;zoom.oninput=draw;
 const finish=()=>{URL.revokeObjectURL(objectUrl);overlay.remove()};
 original.onclick=async()=>{finish();await window.academyUploadEvidence(file,$('evidence-request').value)};
 crop.onclick=()=>canvas.toBlob(async blob=>{if(!blob)return;const output=new File([blob],'comprovante-foto.jpg',{type:'image/jpeg'});finish();selectedFile=output;await window.academyUploadEvidence(output,$('evidence-request').value)},'image/jpeg',.87);
 close.onclick=finish;overlay.onclick=e=>{if(e.target===overlay)finish()};
 inner.append(h,canvas,zoom,original,crop,close);overlay.append(inner);document.body.append(overlay);close.focus();
}
$('analyze-evidence').onclick=async()=>{
 const f=selectedFile||window.academySelectedEvidence||$('evidence-file').files?.[0];if(!f){$('ai-status').textContent='Escolha ou fotografe um comprovante antes de solicitar a leitura.';return}
 if(f.size>5*1024*1024){$('ai-status').textContent='A leitura assistida aceita arquivos de até 5 MB. O envio normal aceita até 10 MB.';return}
 if(!confirm('Autoriza o processamento deste comprovante por um serviço de IA para sugerir campos? Os dados serão enviados para análise apenas após sua confirmação.'))return;
 const btn=$('analyze-evidence');btn.disabled=true;$('ai-status').textContent='Analisando o documento…';
 try{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Falha na leitura'));reader.readAsDataURL(f)});
 const {data:res,error}=await db.functions.invoke('academy-suggest-evidence',{body:{filename:f.name,mime:f.type,base64}});
 if(error||res?.error)throw Error(res?.error||error.message);
 const suggestion=res.fields||{};for(const [k,id] of [['activity','activity'],['activity_type','activity-type'],['start_date','start'],['end_date','end'],['hours_declared','hours'],['description','description']]){if(suggestion[k]===null||suggestion[k]===undefined)continue;const v=String(suggestion[k]);if(id==='activity-type'&&![...$(id).options].some(o=>o.value===v)){const o=document.createElement('option');o.value=v;o.textContent=v;$(id).append(o)}$(id).value=v}
 window.academyWizardSetStep?.(1);$('new-request').scrollIntoView({behavior:'smooth'});$('ai-status').textContent='Sugestões preenchidas. Confira todos os dados; a IA pode cometer erros.';
 }catch(e){ $('ai-status').textContent='Leitura indisponível: '+(e.message||e)}
 finally{btn.disabled=false}
};
window.academyOpenConversation=async(id,title)=>{
 const box=document.createElement('div');box.className='academy-modal';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
 const panel=document.createElement('section');panel.className='academy-modal-inner';const h=document.createElement('h3');h.textContent='Mensagens · '+title;
 const history=document.createElement('div');history.className='conversation-history';const form=document.createElement('form');const field=document.createElement('textarea');field.required=true;field.minLength=2;field.maxLength=2000;field.rows=3;field.placeholder='Escreva sua dúvida ou resposta à administração';const send=document.createElement('button');send.type='submit';send.textContent='Enviar mensagem';send.className='primary';const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.className='plain-action';close.onclick=()=>box.remove();
 const load=async()=>{const {data,error}=await db.from('academy_request_messages').select('body,created_at,sender_id').eq('request_id',id).order('created_at');history.replaceChildren();if(error){history.textContent=error.message;return}for(const m of data||[]){const p=document.createElement('p');p.textContent=new Date(m.created_at).toLocaleString('pt-BR')+' — '+m.body;history.append(p)}if(!data?.length)history.textContent='Nenhuma mensagem neste protocolo.'};
 form.onsubmit=async e=>{e.preventDefault();const {data:{user}}=await db.auth.getUser();if(!user)return;send.disabled=true;const {error}=await db.from('academy_request_messages').insert({request_id:id,sender_id:user.id,body:field.value.trim()});send.disabled=false;if(error){alert('Não foi possível enviar: '+error.message);return}field.value='';await load()};
 form.append(field,send);panel.append(h,history,form,close);box.append(panel);document.body.append(box);await load();close.focus()
};
if('serviceWorker'in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('../sw.js',{scope:'../'}).catch(()=>{}));
})();
