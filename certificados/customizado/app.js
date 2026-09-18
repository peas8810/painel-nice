(()=>{
const API='https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec',box=document.getElementById('content');
const token=new URLSearchParams(location.search).get('chave')||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function jsonp(params,timeout=120000){return new Promise((resolve,reject)=>{const cb='__nice_custom_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),s=document.createElement('script'),u=new URL(API);Object.entries({...params,callback:cb,_:Date.now()}).forEach(([k,v])=>u.searchParams.set(k,v));let done=false;const finish=(err,p)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch(_){}s.remove();err?reject(err):resolve(p)};window[cb]=p=>finish(null,p);s.onerror=()=>finish(new Error('Não foi possível comunicar com o sistema.'));const t=setTimeout(()=>finish(new Error('Tempo esgotado na comunicação.')),timeout);s.src=u.toString();document.head.appendChild(s)})}
async function load(){
 if(!token){box.classList.remove('loading');box.innerHTML='<h2>Link inválido</h2><p class="desc">Este endereço não contém uma chave de emissão válida.</p>';return}
 try{
   const p=await jsonp({action:'cert_custom_link',chave:token},30000);
   if(!p||!p.ok)throw new Error(p&&p.error||'Link não localizado.');
   const l=p.link;if(!l.aberto){box.classList.remove('loading');box.innerHTML='<div class="event-head"><div><div class="event-id">EMISSÃO CUSTOMIZADA</div><h2>'+esc(l.rotulo||'Certificados NICE')+'</h2></div><span class="status">EMISSÃO FECHADA</span></div><p class="desc">A emissão por este link não está disponível no momento.</p>';return}
   box.classList.remove('loading');
   box.innerHTML='<div class="event-head"><div><div class="event-id">EMISSÃO CUSTOMIZADA · '+esc(l.id)+'</div><h2>'+esc(l.rotulo||'Certificado customizado')+'</h2><p class="desc">Informe os dados que deverão constar no certificado.</p></div><span class="status">EMISSÃO ABERTA</span></div>'+
   '<form id="customForm" class="custom-form">'+
   '<label>Nome completo<input name="nome" required autocomplete="name"></label>'+
   '<label>E-mail<input name="email" type="email" required autocomplete="email"></label>'+
   '<label>Função no evento<select name="funcao" required><option value="">Selecione</option><option>Palestrante</option><option>Orador</option><option>Seminarista</option><option>Mediador</option><option>Conferencista</option><option>Organizador</option><option>Coordenador</option><option value="Outra">Outra</option></select></label>'+
   '<label id="outraWrap" hidden>Outra função<input name="outra_funcao" maxlength="120"></label>'+
   '<label>Carga horária<input name="carga" required placeholder="Ex.: 2 horas"></label>'+
   '<label>Nome do evento<input name="evento" required maxlength="220" placeholder="Nome oficial do evento"></label>'+
   '<div class="wide"><button id="send" class="btn orange" type="submit">Gerar e enviar certificado</button><div id="result" class="custom-note"></div></div>'+
   '</form>';
   const form=document.getElementById('customForm'),sel=form.elements.funcao,wrap=document.getElementById('outraWrap');
   sel.onchange=()=>{wrap.hidden=sel.value!=='Outra'};
   form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),btn=document.getElementById('send'),res=document.getElementById('result');let funcao=String(f.get('funcao')||'');if(funcao==='Outra')funcao=String(f.get('outra_funcao')||'').trim();res.textContent='Gerando certificado…';btn.disabled=true;try{const out=await jsonp({action:'cert_custom_issue',chave:token,nome:f.get('nome')||'',email:f.get('email')||'',funcao,carga:f.get('carga')||'',evento:f.get('evento')||''},120000);if(!out||!out.ok)throw new Error(out&&out.error||'Falha na emissão.');res.innerHTML='<strong>Certificado enviado com sucesso.</strong><br>'+esc(out.message||'')+'<br>Código: <strong>'+esc(out.code||'—')+'</strong>'}catch(err){res.textContent=err.message||'Falha na emissão.'}finally{btn.disabled=false}};
 }catch(err){box.classList.remove('loading');box.innerHTML='<h2>Não foi possível abrir a emissão</h2><p class="desc">'+esc(err.message||'Falha de comunicação.')+'</p>'}
}
load();
})();