(()=>{
  const content=document.getElementById('content');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  const fmtDateTime=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  const API=(window.NICE_CERT_CONFIG&&window.NICE_CERT_CONFIG.API_URL)||'';
  function jsonp(params,timeout){timeout=timeout||45000;return new Promise((resolve,reject)=>{if(!API)return reject(new Error('API de certificados não configurada.'));const cb='__nice_cert_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script'),u=new URL(API);Object.entries(Object.assign({},params,{callback:cb,_:Date.now()})).forEach(([k,v])=>u.searchParams.set(k,String(v==null?'':v)));let done=false;const finish=(err,p)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch(_){}s.remove();err?reject(err):resolve(p)};window[cb]=p=>finish(null,p);s.onerror=()=>finish(new Error('Não foi possível comunicar com o sistema.'));const t=setTimeout(()=>finish(new Error('Tempo esgotado ao consultar o sistema.')),timeout);s.src=u.toString();document.head.appendChild(s)})}
  const path=location.pathname.replace(/\/+$/,'');
  const m=path.match(/\/certificados\/(\d+)$/);
  const queryEvent=new URLSearchParams(location.search).get('evento')||'';
  const eventId=m?m[1]:queryEvent;

  function eventHtml(e){
    const open=!!e.emissao_aberta;
    const statusLabel=open?'EMISSÃO ABERTA':'EMISSÃO FECHADA';
    const form=open?
      '<div class="card" style="margin-top:18px;padding:18px"><h2>Emitir meu certificado</h2><p class="desc">Informe seu nome completo e o e-mail para receber o PDF.</p><div class="searchbox" style="grid-template-columns:1fr 1fr auto"><input id="certName" type="text" autocomplete="name" placeholder="Nome completo"><input id="certEmail" type="email" autocomplete="email" placeholder="E-mail"><button id="certIssueBtn" class="btn orange" type="button">Gerar e enviar certificado</button></div><div id="certIssueStatus" class="verify-result"></div></div>':
      '<div class="card" style="margin-top:18px"><h2>Emissão indisponível</h2><p class="desc">'+esc(e.emissao_mensagem||'A emissão de certificados não está disponível neste momento.')+'</p></div>';
    return '<div class="event-head"><div><div class="event-id">EVENTO '+esc(e.id)+'</div><h2>'+esc(e.titulo||'Evento institucional')+'</h2><p class="desc">'+esc(e.descricao||'Evento registrado no Sistema NICE de Certificados.')+'</p></div><span class="status">'+statusLabel+'</span></div>'+
      '<div class="meta-grid">'+
        '<div class="meta"><span>Data</span><strong>'+fmtDate(e.data_evento)+'</strong></div>'+
        '<div class="meta"><span>Campus / Unidade</span><strong>'+esc(e.campus_unidade||'—')+'</strong></div>'+
        '<div class="meta"><span>Local</span><strong>'+esc(e.local||'—')+'</strong></div>'+
        '<div class="meta"><span>Carga horária</span><strong>'+esc(e.carga_horaria||'—')+'</strong></div>'+
        '<div class="meta"><span>Início da emissão</span><strong>'+fmtDateTime(e.emissao_inicio)+'</strong></div>'+
        '<div class="meta"><span>Fim da emissão</span><strong>'+fmtDateTime(e.emissao_fim)+'</strong></div>'+
      '</div>'+form+'<div class="actions"><a class="btn ghost" href="/certificados/validar/">Validar certificado</a><a class="btn ghost" href="/certificados/">Ver todos os eventos</a></div>';
  }

  async function issueCertificate(e){
    const name=document.getElementById('certName'),email=document.getElementById('certEmail'),btn=document.getElementById('certIssueBtn'),status=document.getElementById('certIssueStatus');
    const n=String(name&&name.value||'').trim(),mail=String(email&&email.value||'').trim();
    if(n.length<3){status.innerHTML='<div class="card invalid"><strong>Informe seu nome completo.</strong></div>';if(name)name.focus();return}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){status.innerHTML='<div class="card invalid"><strong>Informe um e-mail válido.</strong></div>';if(email)email.focus();return}
    btn.disabled=true;btn.textContent='Gerando…';status.innerHTML='<div class="card loading">Gerando certificado…</div>';
    try{
      const p=await jsonp({action:'cert_issue',event_id:e.id,name:n,email:mail},60000);
      if(!p||!p.ok)throw new Error(p&&p.error||'Não foi possível gerar o certificado.');
      status.innerHTML='<div class="card valid"><h2>Certificado enviado com sucesso.</h2><p class="desc">'+esc(p.message||'O PDF foi enviado para o e-mail informado.')+'</p>'+(p.code?'<p><strong>Código:</strong> '+esc(p.code)+'</p>':'')+'</div>';
      btn.textContent='Certificado enviado';
    }catch(err){
      status.innerHTML='<div class="card invalid"><h2>Não foi possível emitir</h2><p class="desc">'+esc(err.message||'Falha na emissão.')+'</p></div>';
      btn.disabled=false;btn.textContent='Gerar e enviar certificado';
    }
  }

  async function loadEvent(id){
    try{
      const p=await jsonp({action:'cert_event',event_id:id},30000);
      if(!p||!p.ok||!p.event)throw new Error(p&&p.error||'Evento não localizado.');
      const e=p.event;
      document.title='Evento '+e.id+' | Certificados NICE';
      if(queryEvent&&!m)history.replaceState({},'','/certificados/'+encodeURIComponent(e.id)+'/');
      content.classList.remove('loading');content.innerHTML=eventHtml(e);
      const btn=document.getElementById('certIssueBtn');if(btn)btn.addEventListener('click',()=>issueCertificate(e));
    }catch(err){
      content.classList.remove('loading');content.innerHTML='<h2>Evento não localizado</h2><p class="desc">'+esc(err.message||'Não foi possível carregar este evento.')+'</p><div class="actions"><a class="btn" href="/certificados/">Voltar aos certificados</a></div>';
    }
  }

  async function loadIndex(){
    try{
      const r=await fetch(`/certificados/data/events-index.json?ts=${Date.now()}`,{cache:'no-store'});
      const data=r.ok?await r.json():{events:[]};
      const events=Array.isArray(data.events)?data.events:[];
      content.classList.remove('loading');
      content.innerHTML=`<div class="event-head"><div><h2>Eventos certificados</h2><p class="desc">Cada evento possui numeração sequencial e página pública própria.</p></div><span class="status">${events.length} evento(s)</span></div>
        <div class="searchbox"><input id="eventSearch" type="search" placeholder="Pesquisar por número, título, campus ou protocolo"><a class="btn orange" href="/certificados/validar/">Validar certificado</a></div>
        <div id="events" class="events">${events.length?events.map(x=>`<a class="event-card" data-search="${esc([x.id,x.titulo,x.campus_unidade,x.protocolo_nice].join(' ').toLowerCase())}" href="/certificados/${encodeURIComponent(x.id)}/"><small>EVENTO ${esc(x.id)}</small><strong>${esc(x.titulo||'Evento institucional')}</strong><span>${fmtDate(x.data_evento)} · ${esc(x.campus_unidade||'Unidade não informada')}</span></a>`).join(''):'<p class="desc">Nenhum evento certificado foi publicado ainda.</p>'}</div>`;
      const q=document.getElementById('eventSearch');
      if(q)q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();document.querySelectorAll('.event-card').forEach(c=>c.style.display=!s||c.dataset.search.includes(s)?'block':'none')});
    }catch(err){content.classList.remove('loading');content.innerHTML='<h2>Certificados NICE</h2><p class="desc">A base de eventos ainda não está disponível.</p>'}
  }

  eventId?loadEvent(eventId):loadIndex();
})();