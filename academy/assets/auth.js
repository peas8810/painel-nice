/* Portal Academy: entrada por autenticação antes da área de solicitações.
 * Controles visuais não substituem as políticas RLS do Supabase. */
(async()=>{
const $=id=>document.getElementById(id), cfg=window.ACADEMY_AUTH_CONFIG||{};
const message=(id,s)=>{$(id).textContent=s};
const display=(id,on)=>{$(id).hidden=!on};
function authTab(tab){display('login-panel',tab==='login');display('register-panel',tab==='register');$('show-login').classList.toggle('active',tab==='login');$('show-register').classList.toggle('active',tab==='register')}
$('show-login').onclick=()=>authTab('login');$('show-register').onclick=()=>authTab('register');
if(!cfg.url||!cfg.publishableKey||!window.supabase?.createClient){display('loading-view',false);display('visitor-view',true);message('login-status','Serviço de login indisponível. Tente novamente mais tarde.');return}
const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
let currentUser=null, currentRevision=0;
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
 const tracking=$('tracking');tracking.replaceChildren(document.createTextNode('Carregando solicitações…'));
 const {data,error}=await db.from('academy_requests').select('id,activity,status,hours_declared,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(50);
 if(revision!==currentRevision||!currentUser)return;
 tracking.replaceChildren();
 if(error){tracking.textContent='Não foi possível carregar as solicitações: '+error.message;return}
 const {data:payments}=await db.from('academy_payment_releases').select('request_id,payment_status,checkout_url').in('request_id',(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']);
 const {data:certs}=await db.from('academy_certificates').select('request_id,status,certificate_code,pdf_path').in('request_id',(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']);
 const payById=new Map((payments||[]).map(x=>[x.request_id,x])),certById=new Map((certs||[]).map(x=>[x.request_id,x]));
 const select=$('evidence-request');select.replaceChildren();(data||[]).filter(x=>!['REPROVADO','APROVADO'].includes(x.status)).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.activity+' · '+x.id.slice(0,8);select.append(o)});
 await listEvidence();
 if(!data?.length){tracking.textContent='Você ainda não tem solicitações. Preencha o formulário ao lado para começar.';return}
 const descriptions={ENVIADA:'Solicitação recebida',EM_ANALISE:'Em análise documental',PENDENTE_DOCUMENTOS:'Aguardando documentos',APROVADO:'Análise aprovada',REPROVADO:'Não aprovada',INCONCLUSIVO:'Análise inconclusiva'};
 for(const item of data){const card=document.createElement('article');card.className='request-item';const heading=document.createElement('strong');heading.textContent=item.activity;const state=document.createElement('span');state.className='request-status';state.textContent=descriptions[item.status]||item.status;const detail=document.createElement('small');detail.textContent=String(item.hours_declared)+' horas declaradas · Solicitação '+item.id;card.append(heading,state,detail);const pay=payById.get(item.id),cert=certById.get(item.id);if(pay){const p=document.createElement('small');p.textContent='Financeiro: '+pay.payment_status;card.append(p);if(pay.checkout_url&&pay.payment_status==='AGUARDANDO_PAGAMENTO'){const link=document.createElement('a');link.href=pay.checkout_url;link.rel='noopener noreferrer';link.target='_blank';link.textContent='Acessar pagamento seguro';card.append(link)}}if(cert){const c=document.createElement('small');c.textContent='Certificado: '+cert.status+(cert.status==='EMITIDO'?' · '+cert.certificate_code:'');card.append(c);if(cert.status==='EMITIDO'&&cert.pdf_path){const button=document.createElement('button');button.type='button';button.className='plain-action';button.textContent='Baixar certificado PDF';button.onclick=async()=>{button.disabled=true;const {data:url,error}=await db.storage.from('academy-certificados').createSignedUrl(cert.pdf_path,60);button.disabled=false;if(error){message('evidence-status','Não foi possível abrir o PDF: '+error.message);return}window.open(url.signedUrl,'_blank','noopener,noreferrer')};card.append(button);const link=document.createElement('a');link.href='../validar/?codigo='+encodeURIComponent(cert.certificate_code);link.textContent='Validar autenticidade';link.target='_blank';link.rel='noopener noreferrer';card.append(link)}}tracking.appendChild(card)}
}
async function refresh(){
 const {data,error}=await db.auth.getUser();
 const user=error?null:data.user;currentUser=user||null;
 display('loading-view',false);display('visitor-view',!user);display('student-view',!!user);
 if(user){$('student-email').textContent='Conectado como '+user.email;await Promise.all([listRequests(),loadActivityTypes()])}
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
$('evidence-upload').addEventListener('submit',async e=>{e.preventDefault();if(!e.target.reportValidity())return;const {data:{user}}=await db.auth.getUser();if(!user){message('evidence-status','Faça login novamente.');return}const file=$('evidence-file').files[0],requestId=$('evidence-request').value;if(!file||!requestId)return;const ownership=await db.from('academy_requests').select('id').eq('id',requestId).eq('user_id',user.id).maybeSingle();if(ownership.error||!ownership.data){message('evidence-status','Este protocolo pertence a outra conta ou não está disponível. Atualize a página e entre com o estudante que criou o pedido.');await listRequests();return}if(file.size>10485760||!['application/pdf','image/jpeg','image/png'].includes(file.type)){message('evidence-status','Arquivo inválido. Use PDF/JPG/PNG até 10 MB.');return}
 const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';const path=user.id+'/'+requestId+'/'+crypto.randomUUID()+'.'+ext;
 message('evidence-status','Enviando comprovante…');const submitButton=e.currentTarget.querySelector('button[type=submit]');if(submitButton)submitButton.disabled=true;const {error:up}=await db.storage.from('academy-evidencias').upload(path,file,{contentType:file.type,upsert:false});if(up){if(submitButton)submitButton.disabled=false;message('evidence-status','Não foi possível enviar o arquivo. Verifique se o protocolo pertence a esta conta: '+up.message);return}
 const {error:insert}=await db.from('academy_evidence').insert({request_id:requestId,file_path:path,file_name:file.name});if(insert){await db.storage.from('academy-evidencias').remove([path]);if(submitButton)submitButton.disabled=false;message('evidence-status',insert.code==='42501'?'O documento não pôde ser associado a este protocolo. Confira se você está conectado com a mesma conta que criou a solicitação.':'Falha no registro: '+insert.message);return}
 if(submitButton)submitButton.disabled=false;$('evidence-file').value='';message('evidence-status','Documento enviado com sucesso. Aguarde a avaliação individual.');await listEvidence();
});
$('request').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user){message('request-status','Sessão encerrada. Entre novamente.');await refresh();return}
 const item={activity:$('activity').value.trim(),activity_type:$('activity-type').value,start_date:$('start').value,end_date:$('end').value,hours_declared:Number($('hours').value),description:$('description').value.trim()};
 if(item.end_date<item.start_date||item.description.length<15){message('request-status','Verifique as datas e a descrição (mínimo de 15 caracteres).');return}
 message('request-status','Registrando atividade…');const {error}=await db.from('academy_requests').insert(item);
 message('request-status',error?'Não foi possível registrar: '+error.message:'Solicitação registrada. Acompanhe o andamento no painel. A análise aguarda evidências.');
 if(!error){$('request').reset();await listRequests()}
});
db.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){display('student-view',false);display('visitor-view',true);authTab('login');display('academy-new-password',true);message('login-status','Defina sua nova senha abaixo.')}else if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='TOKEN_REFRESHED')setTimeout(refresh,0)});
await refresh();
})();