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
async function listRequests(){
 const revision=++currentRevision;
 if(!currentUser)return;
 const tracking=$('tracking');tracking.replaceChildren(document.createTextNode('Carregando solicitações…'));
 const {data,error}=await db.from('academy_requests').select('id,activity,status,hours_declared,created_at').order('created_at',{ascending:false}).limit(50);
 if(revision!==currentRevision||!currentUser)return;
 tracking.replaceChildren();
 if(error){tracking.textContent='Não foi possível carregar as solicitações: '+error.message;return}
 if(!data?.length){tracking.textContent='Você ainda não tem solicitações. Preencha o formulário ao lado para começar.';return}
 const descriptions={ENVIADA:'Solicitação recebida',EM_ANALISE:'Em análise documental',PENDENTE_DOCUMENTOS:'Aguardando documentos',APROVADO:'Análise aprovada',REPROVADO:'Não aprovada',INCONCLUSIVO:'Análise inconclusiva'};
 for(const item of data){const card=document.createElement('article');card.className='request-item';const heading=document.createElement('strong');heading.textContent=item.activity;const state=document.createElement('span');state.className='request-status';state.textContent=descriptions[item.status]||item.status;const detail=document.createElement('small');detail.textContent=String(item.hours_declared)+' horas declaradas · Solicitação '+item.id;card.append(heading,state,detail);tracking.appendChild(card)}
}
async function refresh(){
 const {data,error}=await db.auth.getUser();
 const user=error?null:data.user;currentUser=user||null;
 display('loading-view',false);display('visitor-view',!user);display('student-view',!!user);
 if(user){$('student-email').textContent='Conectado como '+user.email;await listRequests()}
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