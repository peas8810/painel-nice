(()=>{const $=id=>document.getElementById(id),c=window.ACADEMY_AUTH_CONFIG,db=window.supabase.createClient(c.url,c.publishableKey);const authorizationId=new URL(location.href).searchParams.get('authorization_id');let details=null,working=false;
const status=text=>$('status').textContent=text;
function authorizedRedirect(raw){const u=new URL(raw);if(!['https:','http:'].includes(u.protocol))throw Error('Destino inválido');location.assign(u.href)}
async function showDetails(){if(!authorizationId||authorizationId.length>500){status('Solicitação inválida: código de autorização ausente.');return}
const {data:{user},error:loginError}=await db.auth.getUser();if(loginError||!user){$('login').hidden=false;status('Entre na conta que deseja conectar.');return}
$('login').hidden=true;
if(!db.auth.oauth?.getAuthorizationDetails){status('Versão da biblioteca de autenticação sem suporte a OAuth 2.1.');return}
status('Consultando o aplicativo solicitante…');
const {data,error}=await db.auth.oauth.getAuthorizationDetails(authorizationId);
if(error||!data){status('Autorização inválida ou expirada. '+(error?.message||''));return}
if(!('authorization_id' in data)){if(data.redirect_url){status('Aplicativo autorizado anteriormente. Redirecionando…');authorizedRedirect(data.redirect_url)}return}
details=data;$('client-name').textContent=data.client?.name||'Aplicativo não identificado';
$('redirect-uri').textContent=data.redirect_uri||'Não informado';
const ul=$('scopes');ul.replaceChildren();for(const item of String(data.scope||'').split(' ').filter(Boolean)){const li=document.createElement('li');li.textContent=item;ul.append(li)}if(!ul.children.length){const li=document.createElement('li');li.textContent='O aplicativo não especificou escopos extras.';ul.append(li)}
$('consent').hidden=false;status('Revise os dados antes de autorizar.');
}
$('signin').onsubmit=async e=>{e.preventDefault();const b=$('signin-button');b.disabled=true;status('Entrando…');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';b.disabled=false;if(error){status('Não foi possível entrar: '+error.message);return}await showDetails()};
async function decide(approve){if(working||!details)return;working=true;$('approve').disabled=true;$('deny').disabled=true;try{
 status(approve?'Autorizando acesso…':'Recusando autorização…');
 const {data,error}=approve?await db.auth.oauth.approveAuthorization(authorizationId):await db.auth.oauth.denyAuthorization(authorizationId);
 if(error||!data?.redirect_url)throw Error(error?.message||'Resposta inválida do servidor');
 authorizedRedirect(data.redirect_url)
 }catch(e){status('Falha: '+String(e.message||e));working=false;$('approve').disabled=false;$('deny').disabled=false}}
$('approve').onclick=()=>decide(true);$('deny').onclick=()=>decide(false);showDetails().catch(e=>status('Não foi possível verificar: '+String(e.message||e)));
})();