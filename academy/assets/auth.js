/* Portal Academy: entrada por autenticação antes da área de solicitações.
 * Controles visuais não substituem as políticas RLS do Supabase. */
(async()=>{
const $=id=>document.getElementById(id), cfg=window.ACADEMY_AUTH_CONFIG||{};
const message=(id,s)=>{$(id).textContent=s};
const display=(id,on)=>{$(id).hidden=!on};
function authTab(tab){display('login-panel',tab==='login');display('register-panel',tab==='register');$('show-login').classList.toggle('active',tab==='login');$('show-register').classList.toggle('active',tab==='register')}
$('show-login').onclick=()=>authTab('login');$('show-register').onclick=()=>authTab('register');
if(!cfg.url||!cfg.publishableKey||!window.supabase?.createClient){display('loading-view',false);display('visitor-view',true);message('login-status','Serviço de login indisponível. Tente novamente mais tarde.');return}
const db=window.supabase.createClient(cfg.url,cfg.publishableKey);window.academyDb=db;
let currentUser=null, currentRevision=0, editingRequestId=null;
$('google-login').addEventListener('click',async()=>{
 const button=$('google-login');
 button.disabled=true;
 message('google-login-status','Redirecionando para o Google…');
 const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/academy/portal/'}});
 if(error){message('google-login-status','Não foi possível entrar com Google: '+error.message);button.disabled=false}
});
async function loadActivityTypes(){
 const input=$('activity-type');
 const fallback=['Grupo de estudos','Projeto colaborativo','Ação comunitária','Oficina independente','Capacitação interna','Outra'];
 const {data,error}=await db.from('academy_activity_types').select('name').eq('active',true).order('name');
 const types=!error&&data?.length?data.map(x=>x.name):fallback;
 const selection=input.value;input.replaceChildren();
 for(const name of types){const opt=document.createElement('option');opt.value=name;opt.textContent=name;input.appendChild(opt)}
 if(types.includes(selection))input.value=selection;
}

async function listRequests(){
 const revision=++currentRevision;
 if(!currentUser)return;
 const tracking=$('tracking');tracking.replaceChildren(document.createTextNode('Buscando seus pedidos…'));
 const {data,error}=await db.from('academy_requests').select('id,activity,activity_type,start_date,end_date,description,status,hours_declared,participants_count,teaching_activity,created_at').eq('user_id',currentUser.id).neq('status','CANCELADA').order('created_at',{ascending:false}).limit(50);
 if(revision!==currentRevision||!currentUser)return;
 tracking.replaceChildren();
 if(error){tracking.textContent='Não conseguimos abrir seus pedidos. Tente novamente. Detalhe: '+error.message;return}
 const {data:payments}=await db.from('academy_payment_releases').select('request_id,payment_status,checkout_url').in('request_id',(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']);
 const {data:certs}=await db.from('academy_certificates').select('request_id,status,certificate_code,pdf_path').in('request_id',(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']);
 const payById=new Map((payments||[]).map(x=>[x.request_id,x])),certById=new Map((certs||[]).map(x=>[x.request_id,x]));
 const select=$('evidence-request');select.replaceChildren();(data||[]).filter(x=>!['REPROVADO','APROVADO'].includes(x.status)).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.activity+' · '+x.id.slice(0,8);select.append(o)});
 await listEvidence();
 if(!data?.length){tracking.textContent='Você ainda não fez um pedido. Clique em “Pedir certificado” para começar.';window.dispatchEvent(new Event('academy-requests-loaded'));return}
 const descriptions={ENVIADA:'Recebemos seu pedido',EM_ANALISE:'Estamos conferindo seus documentos',PENDENTE_DOCUMENTOS:'Você precisa enviar documentos',APROVADO:'Seu pedido foi aprovado',REPROVADO:'Seu pedido não foi aprovado',INCONCLUSIVO:'Precisamos de mais informações'};
 for(const item of data){const card=document.createElement('article');card.className='request-item';const heading=document.createElement('strong');heading.textContent=item.activity;const state=document.createElement('span');state.className='request-status';state.textContent=descriptions[item.status]||item.status;const detail=document.createElement('small');detail.textContent=String(item.hours_declared)+' horas informadas · Pedido '+item.id.slice(0,8);card.append(heading,state,detail);const pay=payById.get(item.id),cert=certById.get(item.id);if(pay){const p=document.createElement('small');p.textContent='Pagamento: '+({PAGO_CONFIRMADO:'confirmado',AGUARDANDO_PAGAMENTO:'aguardando pagamento',ESTORNADO:'devolvido',REJEITADO:'não aprovado'}[pay.payment_status]||'consulte a equipe');card.append(p);if(pay.checkout_url&&pay.payment_status==='AGUARDANDO_PAGAMENTO'){const link=document.createElement('a');link.href=pay.checkout_url;link.rel='noopener noreferrer';link.target='_blank';link.textContent='Pagar certificado — Mercado Pago';card.append(link)}else if(item.status==='APROVADO'&&pay.payment_status==='AGUARDANDO_CHECKOUT'){p.textContent='Pagamento aprovado pela equipe. Cobrança ainda não criada.';const start=document.createElement('button');start.type='button';start.className='primary';start.textContent='Gerar link para pagar certificado';start.onclick=async()=>{start.disabled=true;const label=start.textContent;start.textContent='Preparando pagamento…';try{const {data:result,error}=await db.functions.invoke('academy-checkout',{body:{request_id:item.id}});if(error||result?.error||!result?.checkout_url){const msg=result?.error||error?.message||'Cobrança temporariamente indisponível';p.textContent='Não foi possível gerar o pagamento: '+msg;return}const u=new URL(result.checkout_url);if(u.protocol!=='https:'||!(u.hostname==='mercadopago.com.br'||u.hostname.endsWith('.mercadopago.com.br')||u.hostname==='mercadopago.com'||u.hostname.endsWith('.mercadopago.com'))){p.textContent='Link de pagamento não reconhecido. Contate o suporte.';return}await listRequests();}catch(e){p.textContent='Falha ao preparar o pagamento. Tente novamente ou fale com a equipe.'}finally{start.disabled=false;start.textContent=label}};card.append(start)}}if(cert){const c=document.createElement('small');c.textContent='Certificado: '+({EMITIDO:'pronto para baixar',PENDENTE_EMISSAO:'ainda não foi emitido',REVOGADO:'cancelado, sem validade'}[cert.status]||'em preparação')+(cert.status==='EMITIDO'?' · '+cert.certificate_code:'');card.append(c);if(cert.status==='EMITIDO'&&cert.pdf_path){const button=document.createElement('button');button.type='button';button.className='plain-action';button.textContent='Baixar certificado PDF';button.onclick=async()=>{button.disabled=true;const {data:url,error}=await db.storage.from('academy-certificados').createSignedUrl(cert.pdf_path,60);button.disabled=false;if(error){message('evidence-status','Não foi possível abrir o PDF: '+error.message);return}window.open(url.signedUrl,'_blank','noopener,noreferrer')};card.append(button);const link=document.createElement('a');link.href='../validar/?codigo='+encodeURIComponent(cert.certificate_code);link.textContent='Validar autenticidade';link.target='_blank';link.rel='noopener noreferrer';card.append(link)}}const actions=document.createElement('div');actions.className='actions';if(['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(item.status)&&!pay&&!cert){const edit=document.createElement('button');edit.type='button';edit.className='plain-action';edit.textContent='Corrigir dados';edit.onclick=()=>editRequest(item);const del=document.createElement('button');del.type='button';del.className='plain-action';del.textContent='Cancelar pedido';del.onclick=()=>deleteRequest(item);actions.append(edit,del)}const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='plain-action';duplicate.textContent='Usar como modelo de outro pedido';duplicate.onclick=()=>{resetEdit();$('activity').value=item.activity;$('start').value=item.start_date;$('end').value=item.end_date;$('hours').value=String(item.hours_declared);$('description').value=item.description;const type=$('activity-type');if(![...type.options].some(o=>o.value===item.activity_type)){const op=document.createElement('option');op.value=item.activity_type;op.textContent=item.activity_type;type.append(op)}type.value=item.activity_type;window.academyOpenSection?.('new-request');window.academyWizardSetStep?.(1);$('request').scrollIntoView({behavior:'smooth'});message('request-status','Preenchemos os campos com o pedido anterior. Confira os dados e envie os documentos da nova atividade.')};actions.append(duplicate);const chat=document.createElement('button');chat.type='button';chat.className='plain-action';chat.textContent='Falar com a equipe';chat.onclick=()=>window.academyOpenConversation?.(item.id,item.activity);actions.append(chat);
if(['APROVADO','REPROVADO'].includes(item.status)){
 const feedback=document.createElement('button');feedback.type='button';feedback.className='plain-action';feedback.textContent='Avaliar experiência';
 feedback.onclick=async()=>{const reply=prompt('Como foi sua experiência no Academy? Dê uma nota de 1 a 5.');if(reply===null)return;const score=Number(reply);if(!Number.isInteger(score)||score<1||score>5){message('evidence-status','Informe uma nota entre 1 e 5.');return}
 const comment=prompt('Deseja deixar uma sugestão? (opcional, até 1500 caracteres)')||'';
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {error}=await db.from('academy_feedback').insert({request_id:item.id,user_id:user.id,score,comment:comment.slice(0,1500)});
 message('evidence-status',error?'Não conseguimos enviar seu pedido: '+error.message:'Obrigado! Sua avaliação foi registrada.');
 };actions.append(feedback)
}
const more=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Outras opções deste pedido';more.append(summary,actions);if(['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(item.status)){const send=document.createElement('button');send.type='button';send.className='primary';send.textContent='Enviar fotos e documentos';send.onclick=()=>{$('evidence-request').value=item.id;window.academyOpenSection?.('upload-section');};card.append(send);}card.append(more);tracking.appendChild(card)}window.dispatchEvent(new Event('academy-requests-loaded'))
}
function resetEdit(){
 editingRequestId=null;
 $('request').reset();
 $('request-title').textContent='Pedir um certificado';
 $('request-submit').textContent='Enviar meu pedido';
 display('cancel-edit',false);display('edit-notice',false);
}
$('cancel-edit').onclick=()=>{resetEdit();message('request-status','Edição cancelada. Nenhuma alteração foi salva.')};
async function editRequest(item){
 const {data,error}=await db.from('academy_requests').select('id,user_id,activity,activity_type,start_date,end_date,hours_declared,description,participants_count,teaching_activity,status').eq('id',item.id).eq('user_id',currentUser.id).maybeSingle();
 if(error||!data){message('evidence-status','Não conseguimos abrir este pedido para corrigir. Tente novamente.');return}
 if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(data.status)){message('evidence-status','Este pedido já está em uma etapa que exige ajuda da equipe. Abra “Ajuda” para pedir uma correção.');return}
 editingRequestId=data.id;
 $('activity').value=data.activity||'';
 const type=$('activity-type');if(![...type.options].some(o=>o.value===data.activity_type)){const opt=document.createElement('option');opt.value=data.activity_type;opt.textContent=data.activity_type;type.appendChild(opt)}type.value=data.activity_type;
 $('start').value=data.start_date||'';
 $('end').value=data.end_date||'';
 $('hours').value=String(data.hours_declared??'');$('participants').value=data.participants_count??'';$('teaching').value=data.teaching_activity?'true':'';
 $('description').value=data.description||'';
 $('request-title').textContent='Corrigir dados existente';
 $('request-submit').textContent='Salvar alterações';
 display('cancel-edit',true);display('edit-notice',true);
 message('request-status','Corrigindo o pedido '+data.id.slice(0,8)+'. Revise os campos e clique em Salvar alterações.');
 window.academyOpenSection?.('new-request');window.academyWizardSetStep?.(1);$('request').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteRequest(item){
 if(!confirm('Cancelar o pedido "'+item.activity+'"? Ele será cancelado e sairá do seu painel. O registro do cancelamento será mantido.'))return;
 const {error}=await db.rpc('academy_student_change_request',{p_id:item.id,p_action:'EXCLUIR'});
 message('evidence-status',error?'Não foi possível cancelar: '+error.message:'Pedido cancelado.');
 if(!error)await listRequests()
}
async function loadNotificationPreferences(){
 if(!currentUser)return;
 const {data,error}=await db.from('academy_notification_preferences').select('email_enabled,whatsapp_phone,whatsapp_opt_in').eq('user_id',currentUser.id).maybeSingle();
 if(error){message('notify-preferences-status','Preferências indisponíveis: '+error.message);return}
 $('notify-email').checked=data?.email_enabled??true;
 $('notify-whatsapp-phone').value=data?.whatsapp_phone||'';
 $('notify-whatsapp-consent').checked=!!data?.whatsapp_opt_in;
}
$('notification-preferences').addEventListener('submit',async e=>{
 e.preventDefault();const {data:{user}}=await db.auth.getUser();if(!user)return;
 const consent=$('notify-whatsapp-consent').checked,phone=$('notify-whatsapp-phone').value.trim();
 if(consent&&!/^\+[1-9][0-9]{7,14}$/.test(phone)){message('notify-preferences-status','Informe o número com DDI, por exemplo +5531999999999.');return}
 const payload={user_id:user.id,email_enabled:$('notify-email').checked,whatsapp_phone:phone||null,whatsapp_opt_in:consent,whatsapp_opt_in_at:consent?new Date().toISOString():null,updated_at:new Date().toISOString()};
 const {error}=await db.from('academy_notification_preferences').upsert(payload,{onConflict:'user_id'});
 message('notify-preferences-status',error?'Não foi possível salvar: '+error.message:'Preferências salvas. O WhatsApp depende de ativação da API oficial.');
});
async function refresh(){
 const {data,error}=await db.auth.getUser();
 const user=error?null:data.user;currentUser=user||null;
 display('loading-view',false);display('visitor-view',!user);display('student-view',!!user);
 if(!user)resetEdit();if(user){$('student-email').textContent='Conectado como '+user.email;await Promise.all([listRequests(),loadActivityTypes(),loadNotificationPreferences()])}
 else{currentRevision++;$('tracking').replaceChildren();$('student-email').textContent=''}
}
$('register').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;const full_name=$('name').value.trim(),email=$('email').value.trim(),password=$('password').value;
 if(full_name.length<3||password.length<12){message('registration-status','Informe nome e senha de pelo menos 12 caracteres.');return}
 message('registration-status','Criando conta…');
 const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/academy/portal/',data:{full_name}}});
 $('password').value='';
 message('registration-status',error?'Não foi possível concluir o cadastro: '+error.message:'Confira seu e-mail, confirme a conta e depois entre no portal.');
});
$('academy-login').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 message('login-status','Autenticando…');
 const {error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
 $('login-password').value='';
 message('login-status',error?'Não foi possível entrar: '+error.message:'');
 if(!error)await refresh();
});
$('academy-reset').onclick=async()=>{const email=$('login-email').value.trim();if(!email){message('login-status','Digite seu e-mail para recuperar a senha.');return}
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/academy/portal/'});
 message('login-status',error?'Erro na recuperação: '+error.message:'Se o endereço estiver cadastrado, você receberá um e-mail de recuperação.');
};
$('academy-new-password').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 const {error}=await db.auth.updateUser({password:$('academy-new-pass').value});$('academy-new-pass').value='';
 message('login-status',error?'Erro: '+error.message:'Senha alterada. Entre com seus dados.');if(!error)display('academy-new-password',false);
});
$('academy-logout').onclick=async()=>{await db.auth.signOut();await refresh()};
async function listEvidence(){if(!currentUser)return;const el=$('evidence-list');el.replaceChildren();const {data,error}=await db.from('academy_evidence').select('file_name,review_status,request_id,created_at').order('created_at',{ascending:false}).limit(100);if(error){el.textContent='Não foi possível carregar comprovantes: '+error.message;return}(data||[]).forEach(x=>{const p=document.createElement('p');p.className='notice';p.textContent=x.file_name+' — '+x.review_status+' — '+x.request_id.slice(0,8);el.append(p)})}
async function uploadEvidenceFile(file,requestId){
 const {data:{user}}=await db.auth.getUser();
 if(!user){message('evidence-status','Faça login novamente.');return false}
 if(!file||!requestId){message('evidence-status','Selecione um protocolo e um arquivo.');return false}
 const ownership=await db.from('academy_requests').select('id,status').eq('id',requestId).eq('user_id',user.id).maybeSingle();
 if(ownership.error||!ownership.data){message('evidence-status','Protocolo não encontrado nesta conta.');await listRequests();return false}
 if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(ownership.data.status)){message('evidence-status','Não é possível enviar novos documentos para este pedido. Fale com a equipe em “Ajuda”.');return false}
 if(!$('evidence-category').value){message('evidence-status','Escolha o tipo de documento que você vai enviar.');return false}
 const allowed={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
 if(file.size>10485760||file.size===0||!allowed[file.type]){message('evidence-status','Não conseguimos usar este arquivo. Envie um PDF ou uma foto JPG ou PNG, com até 10 MB.');return false}
 const path=user.id+'/'+requestId+'/'+crypto.randomUUID()+'.'+allowed[file.type];
 const submit=$('evidence-upload').querySelector('button[type=submit]'),drive=$('drive-picker-button');
 if(submit)submit.disabled=true;if(drive)drive.disabled=true;
 try{
  message('evidence-status','Enviando seu arquivo. Aguarde até terminar…');
  const {error:up}=await db.storage.from('academy-evidencias').upload(path,file,{contentType:file.type,upsert:false});
  if(up){message('evidence-status','Falha no upload: '+up.message);return false}
  const {data:evidenceRow,error:insert}=await db.from('academy_evidence').insert({request_id:requestId,file_path:path,file_name:file.name.slice(0,240),category:$('evidence-category').value}).select('id').single();
  if(insert){
   await db.storage.from('academy-evidencias').remove([path]);
   message('evidence-status','Falha ao associar o arquivo ao protocolo: '+insert.message);return false
  }
  if(evidenceRow?.id) await db.functions.invoke('academy-modules',{body:{action:'document_seal',id:evidenceRow.id}}).catch(()=>null);
  $('evidence-file').value='';
  message('evidence-status','Arquivo enviado. Confira se você já enviou os quatro tipos de documento.');
  await listEvidence();
  return true
 }catch(e){message('evidence-status','Erro no envio: '+String(e.message||e));return false}
 finally{if(submit)submit.disabled=false;if(drive)drive.disabled=false}
}
window.academyUploadEvidence=uploadEvidenceFile;
window.academyRefreshRequests=async()=>{await listRequests();await listEvidence();};
$('evidence-upload').addEventListener('submit',async e=>{
 e.preventDefault();if(!e.target.reportValidity())return;
 await uploadEvidenceFile($('evidence-file').files[0],$('evidence-request').value);
});
$('request').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user){message('request-status','Sessão encerrada. Entre novamente.');await refresh();return}
 const item={activity:$('activity').value.trim(),activity_type:$('activity-type').value,start_date:$('start').value,end_date:$('end').value,hours_declared:Number($('hours').value),description:$('description').value.trim(),participants_count:Number($('participants').value),teaching_activity:$('teaching').value==='true'};
 if(item.end_date<item.start_date||item.description.length<15){message('request-status','Verifique as datas e a descrição (mínimo de 15 caracteres).');return}
 const isEditing=!!editingRequestId;
 message('request-status',isEditing?'Salvando alterações…':'Enviando seu pedido…');
 const submit=$('request-submit');submit.disabled=true;
 const {error}=isEditing
  ? await db.rpc('academy_student_policy_edit',{p_id:editingRequestId,p_activity:item.activity,p_activity_type:item.activity_type,p_start_date:item.start_date,p_end_date:item.end_date,p_hours:item.hours_declared,p_description:item.description,p_participants:item.participants_count,p_teaching:item.teaching_activity})
  : await db.from('academy_requests').insert(item);
 submit.disabled=false;
 const outcome=error?(isEditing?'Não foi possível salvar: ':'Não conseguimos enviar seu pedido: ')+error.message:(isEditing?'Dados corrigidos. A equipe vai conferir seu pedido novamente.':'Pedido recebido. Agora envie as fotos e os documentos para a equipe conferir.');
 if(!error){resetEdit();await listRequests();window.dispatchEvent(new Event('academy-request-saved'))}message('request-status',outcome);
});
db.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){display('student-view',false);display('visitor-view',true);authTab('login');display('academy-new-password',true);message('login-status','Defina sua nova senha abaixo.')}else if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED')setTimeout(refresh,0)});
await refresh();
})();