/* Protocolo Academy - identidade de estudantes.
 * Supabase publishable/anon key é pública; NÃO inserir service_role.
 * Sessão e RLS isolam solicitações. Sem ligação ao backend administrativo.
 */
(async function(){
  const config=window.ACADEMY_AUTH_CONFIG||{};
  const enabled=Boolean(config.url && config.publishableKey && /^https:\/\//.test(config.url));
  const $=id=>document.getElementById(id);
  function status(id,txt){const el=$(id);if(el)el.textContent=txt;}
  if(!enabled){status('registration-status','Cadastro em preparação: serviço de autenticação ainda não configurado.');return;}
  if(!window.supabase?.createClient){status('registration-status','Biblioteca de autenticação indisponível.');return;}
  const db=window.supabase.createClient(config.url,config.publishableKey);
  const signUp=$('register'),request=$('request');
  const recovery=document.createElement('section');recovery.className='portal-card wide';
  recovery.innerHTML='<span class="step">ACESSO</span><h2>Entrar na sua conta</h2><form id="academy-login"><label>E-mail<input type="email" id="login-email" required autocomplete="email"></label><label>Senha<input type="password" id="login-password" required autocomplete="current-password"></label><button type="submit" class="primary">Entrar</button></form><button type="button" class="primary" id="academy-reset">Recuperar senha</button><button type="button" class="primary" id="academy-logout">Sair</button><p id="login-status" role="status"></p>';
  signUp.closest('.portal-grid').after(recovery);
  const login=$('academy-login');
  const resetForm=document.createElement('form');
  resetForm.id='academy-new-password';
  resetForm.hidden=true;
  resetForm.innerHTML='<label>Nova senha<input type="password" id="academy-new-pass" minlength="12" required autocomplete="new-password"></label><button type="submit" class="primary">Atualizar senha</button>';
  recovery.append(resetForm);
  resetForm.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!resetForm.reportValidity())return;
    const newPass=$('academy-new-pass').value;
    const {error}=await db.auth.updateUser({password:newPass});
    $('academy-new-pass').value='';
    status('login-status',error?'Não foi possível atualizar a senha: '+error.message:'Senha atualizada. Você já pode acessar sua conta.');
    if(!error)resetForm.hidden=true;
  });
  db.auth.onAuthStateChange(event=>{
    if(event==='PASSWORD_RECOVERY') {
      resetForm.hidden=false;
      status('login-status','Defina uma nova senha com pelo menos 12 caracteres.');
    }
  });
  async function showMyRequests(){
    const {data:{user}}=await db.auth.getUser();
    if(!user){status('tracking','Entre na sua conta e confirme o e-mail para consultar suas solicitações.');return;}
    const {data,error}=await db.from('academy_requests').select('id,activity,status,hours_declared,created_at').order('created_at',{ascending:false}).limit(50);
    if(error){status('tracking','Não foi possível carregar solicitações: '+error.message);return;}
    const tracking=$('tracking');tracking.replaceChildren();
    const title=document.createElement('p');title.textContent='Conectado como '+user.email;tracking.append(title);
    if(!data.length){tracking.append(document.createTextNode('Nenhuma solicitação cadastrada.'));return;}
    data.forEach(r=>{const p=document.createElement('p');p.textContent=r.activity+' — '+r.hours_declared+' horas — '+r.status+' — '+r.id;tracking.appendChild(p);});
  }
  signUp.addEventListener('submit',async e=>{
    e.preventDefault();
    const name=$('name').value.trim(),email=$('email').value.trim(),password=$('password').value;
    if(!signUp.reportValidity())return;
    if(name.length<3||password.length<12){status('registration-status','Informe nome completo e senha com pelo menos 12 caracteres.');return;}
    status('registration-status','Solicitando cadastro…');
    const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/academy/portal/',data:{full_name:name}}});
    status('registration-status',error?'Não foi possível cadastrar: '+error.message:'Confira seu e-mail para confirmar a conta. Depois, entre para cadastrar sua atividade.');
    password='';
    $('password').value='';
  });
  login.addEventListener('submit',async e=>{
    e.preventDefault();if(!login.reportValidity())return;
    const {error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
    $('login-password').value='';
    status('login-status',error?'Acesso não autorizado: '+error.message:'Acesso confirmado.');
    if(!error)await showMyRequests();
  });
  $('academy-reset').addEventListener('click',async ()=>{
    const email=$('login-email').value.trim();if(!email){status('login-status','Informe seu e-mail no campo acima.');return;}
    const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/academy/portal/'});
    status('login-status',error?'Não foi possível solicitar recuperação: '+error.message:'Se o endereço estiver cadastrado, você receberá as instruções por e-mail.');
  });
  $('academy-logout').addEventListener('click',async()=>{await db.auth.signOut();status('login-status','Sessão encerrada.');await showMyRequests()});
  request.addEventListener('submit',async e=>{
    e.preventDefault();if(!request.reportValidity())return;
    const {data:{user},error:authErr}=await db.auth.getUser();
    if(authErr||!user){status('request-status','Faça login e confirme seu e-mail antes de enviar solicitações.');return;}
    if(!$('terms').checked){status('request-status','É necessário aceitar a declaração do serviço.');return;}
    if($('proof').files.length){status('request-status','O envio de comprovantes ainda não foi ativado. Não foi enviada a solicitação.');return;}
    const data={activity:$('activity').value.trim(),activity_type:$('activity-type').value,
      start_date:$('start').value,end_date:$('end').value,
      hours_declared:Number($('hours').value),description:$('description').value.trim()};
    if(data.end_date<data.start_date||data.description.length<15){status('request-status','Confira as datas e descreva a atividade com pelo menos 15 caracteres.');return;}
    status('request-status','Registrando solicitação…');
    const {error}=await db.from('academy_requests').insert(data);
    status('request-status',error?'Erro ao registrar: '+error.message:'Solicitação registrada. A avaliação ficará pendente até que o módulo seguro de comprovantes esteja disponível.');
    if(!error){request.reset();await showMyRequests();}
  });
  db.auth.onAuthStateChange(()=>{setTimeout(showMyRequests,0)});
  await showMyRequests();
})();