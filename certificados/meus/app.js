(()=>{
  const API='https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec';
  const name=document.getElementById('name'),email=document.getElementById('email'),search=document.getElementById('search'),confirm=document.getElementById('confirm'),emailStage=document.getElementById('emailStage'),result=document.getElementById('result');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};

  function jsonp(params,timeout=30000){return new Promise((resolve,reject)=>{const cb='__nice_person_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script'),u=new URL(API);Object.entries({...params,callback:cb,_:Date.now()}).forEach(([k,v])=>u.searchParams.set(k,v));let done=false;const finish=(err,p)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch(_){}s.remove();err?reject(err):resolve(p)};window[cb]=p=>finish(null,p);s.onerror=()=>finish(new Error('Não foi possível comunicar com o sistema.'));const t=setTimeout(()=>finish(new Error('Tempo esgotado.')),timeout);s.src=u.toString();document.head.appendChild(s)})}

  function renderCertificates(p){
    const rows=p.certificates||[];
    result.innerHTML='<div class="card valid"><h2>'+esc(p.nome||'Certificados encontrados')+'</h2><p class="desc">'+rows.length+' certificado(s) localizado(s).</p><div class="events">'+rows.map(x=>'<div class="event-card"><small>'+esc(x.status||'')+'</small><strong>'+esc(x.titulo_evento||'Evento institucional')+'</strong><span>'+esc(x.instituicao_emissora||'Instituição não informada')+' · '+fmt(x.emitido_em)+'</span><div class="meta-grid" style="grid-template-columns:1fr 1fr;margin-top:12px"><div class="meta"><span>Livro</span><strong>'+esc(x.livro_digital||'—')+'</strong></div><div class="meta"><span>Registro</span><strong>'+esc(x.registro_digital||'—')+'</strong></div></div><div class="actions"><a class="btn orange" href="'+esc(x.validacao)+'">Validar certificado</a></div></div>').join('')+'</div></div>';
  }

  async function firstSearch(){
    const n=name.value.trim();
    if(n.length<5){result.innerHTML='<div class="card invalid"><h2>Informe seu nome completo</h2></div>';name.focus();return}
    search.disabled=true;result.innerHTML='<div class="card loading">Pesquisando…</div>';
    try{
      const p=await jsonp({action:'cert_person_search',name:n});
      if(!p||!p.ok)throw new Error(p&&p.error||'Falha na pesquisa.');
      if(!p.found){emailStage.hidden=true;result.innerHTML='<div class="card"><h2>Nenhum certificado encontrado</h2><p class="desc">Não encontramos certificados emitidos exatamente com esse nome.</p></div>';return}
      emailStage.hidden=false;email.focus();
      result.innerHTML='<div class="card valid"><h2>Encontramos '+Number(p.total||0)+' certificado(s)</h2><p class="desc">'+esc(p.message||'Confirme seu e-mail para visualizar os documentos.')+'</p></div>';
    }catch(e){result.innerHTML='<div class="card invalid"><h2>Não foi possível pesquisar</h2><p class="desc">'+esc(e.message||'Falha na consulta.')+'</p></div>'}
    finally{search.disabled=false}
  }

  async function confirmEmail(){
    const n=name.value.trim(),m=email.value.trim();
    if(!m){email.focus();return}
    confirm.disabled=true;result.innerHTML='<div class="card loading">Confirmando dados…</div>';
    try{
      const p=await jsonp({action:'cert_person_search',name:n,email:m});
      if(!p||!p.ok||!p.verified)throw new Error((p&&p.error)||'Os dados informados não correspondem aos certificados encontrados.');
      renderCertificates(p);
    }catch(e){result.innerHTML='<div class="card invalid"><h2>Não foi possível confirmar</h2><p class="desc">'+esc(e.message||'Verifique o nome e o e-mail informados.')+'</p></div>'}
    finally{confirm.disabled=false}
  }

  search.addEventListener('click',firstSearch);confirm.addEventListener('click',confirmEmail);
  name.addEventListener('keydown',e=>{if(e.key==='Enter')firstSearch()});
  email.addEventListener('keydown',e=>{if(e.key==='Enter')confirmEmail()});
})();