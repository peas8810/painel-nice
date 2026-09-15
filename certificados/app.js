(()=>{
  const content=document.getElementById('content');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  const path=location.pathname.replace(/\/+$/,'');
  const m=path.match(/\/certificados\/(\d+)$/);
  const eventId=m?m[1]:(new URLSearchParams(location.search).get('evento')||'');

  function eventHtml(e){
    const validateUrl='../validar/';
    return `<div class="event-head"><div><div class="event-id">EVENTO ${esc(e.id)}</div><h2>${esc(e.titulo||'Evento institucional')}</h2><p class="desc">${esc(e.descricao||'Evento registrado no Sistema NICE de Certificados.')}</p></div><span class="status">${esc(e.status||'ATIVO')}</span></div>
      <div class="meta-grid">
        <div class="meta"><span>Data</span><strong>${fmtDate(e.data_evento)}</strong></div>
        <div class="meta"><span>Campus / Unidade</span><strong>${esc(e.campus_unidade||'—')}</strong></div>
        <div class="meta"><span>Local</span><strong>${esc(e.local||'—')}</strong></div>
        <div class="meta"><span>Carga horária</span><strong>${esc(e.carga_horaria||'—')}</strong></div>
        <div class="meta"><span>Protocolo NICE</span><strong>${esc(e.protocolo_nice||'—')}</strong></div>
        <div class="meta"><span>Certificados emitidos</span><strong>${Number(e.certificados_emitidos||0).toLocaleString('pt-BR')}</strong></div>
      </div>
      <div class="actions"><a class="btn orange" href="${validateUrl}">Validar certificado</a><a class="btn ghost" href="../">Ver todos os eventos</a></div>`;
  }

  async function loadEvent(id){
    try{
      const r=await fetch(`../data/events/${encodeURIComponent(id)}.json?ts=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)throw new Error('Evento não localizado.');
      const e=await r.json();
      document.title=`Evento ${e.id} | Certificados NICE`;
      content.classList.remove('loading');content.innerHTML=eventHtml(e);
    }catch(err){content.classList.remove('loading');content.innerHTML=`<h2>Evento não localizado</h2><p class="desc">${esc(err.message||'Não foi possível carregar este evento.')}</p><div class="actions"><a class="btn" href="../">Voltar aos certificados</a></div>`}
  }

  async function loadIndex(){
    try{
      const r=await fetch(`data/events-index.json?ts=${Date.now()}`,{cache:'no-store'});
      const data=r.ok?await r.json():{events:[]};
      const events=Array.isArray(data.events)?data.events:[];
      content.classList.remove('loading');
      content.innerHTML=`<div class="event-head"><div><h2>Eventos certificados</h2><p class="desc">Cada evento possui numeração sequencial e página pública própria.</p></div><span class="status">${events.length} evento(s)</span></div>
        <div class="searchbox"><input id="eventSearch" type="search" placeholder="Pesquisar por número, título, campus ou protocolo"><a class="btn orange" href="validar/">Validar certificado</a></div>
        <div id="events" class="events">${events.length?events.map(x=>`<a class="event-card" data-search="${esc([x.id,x.titulo,x.campus_unidade,x.protocolo_nice].join(' ').toLowerCase())}" href="${encodeURIComponent(x.id)}/"><small>EVENTO ${esc(x.id)}</small><strong>${esc(x.titulo||'Evento institucional')}</strong><span>${fmtDate(x.data_evento)} · ${esc(x.campus_unidade||'Unidade não informada')}</span></a>`).join(''):'<p class="desc">Nenhum evento certificado foi publicado ainda.</p>'}</div>`;
      const q=document.getElementById('eventSearch');
      if(q)q.addEventListener('input',()=>{const s=q.value.trim().toLowerCase();document.querySelectorAll('.event-card').forEach(c=>c.style.display=!s||c.dataset.search.includes(s)?'block':'none')});
    }catch(err){content.classList.remove('loading');content.innerHTML='<h2>Certificados NICE</h2><p class="desc">A base de eventos ainda não está disponível.</p>'}
  }

  eventId?loadEvent(eventId):loadIndex();
})();