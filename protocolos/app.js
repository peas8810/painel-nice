(()=>{
  const C = window.NICE_PORTAL_CONFIG || {};
  const $ = s => document.querySelector(s);
  const F = new Intl.NumberFormat('pt-BR');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const qs = new URLSearchParams(location.search);
  const apiFromQuery = qs.get('api');
  if (apiFromQuery) {
    try { localStorage.setItem('nice_api_url', apiFromQuery); } catch (_) {}
  }
  const savedApi = (()=>{ try { return localStorage.getItem('nice_api_url') || ''; } catch (_) { return ''; } })();
  const API = String(apiFromQuery || C.API_URL || savedApi || '').trim();

  const formProtocol = $('#formProtocol');
  const formReport = $('#formReport');
  const panelLink = $('#panelLink');
  if (formProtocol) formProtocol.href = C.FORM_PROTOCOLO_URL || '#';
  if (formReport) formReport.href = C.FORM_RELATORIO_URL || '#';
  if (panelLink) panelLink.href = C.PAINEL_URL || '../atual/';

  function setBackendState(kind, title, detail){
    const box = $('#backendState');
    if (!box) return;
    const dot = kind === 'ok' ? 'dot ok' : kind === 'err' ? 'dot err' : 'dot';
    box.innerHTML = `<span>Integração em tempo real</span><strong><i class="${dot}"></i>${esc(title)}</strong><small>${esc(detail)}</small>`;
  }

  function jsonp(action, params={}){
    return new Promise((resolve,reject)=>{
      if (!API) return reject(new Error('API_NAO_CONFIGURADA'));
      const cb = '__nice_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const url = new URL(API);
      url.searchParams.set('action', action);
      url.searchParams.set('callback', cb);
      url.searchParams.set('_', Date.now());
      Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));

      const script = document.createElement('script');
      let done = false;
      const cleanup = ()=>{
        if (script.parentNode) script.remove();
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
      };
      const timer = setTimeout(()=>{
        if (done) return;
        done = true; cleanup(); reject(new Error('Tempo limite ao consultar o sistema.'));
      }, 12000);

      window[cb] = data => {
        if (done) return;
        done = true; clearTimeout(timer); cleanup();
        if (data && data.ok === false) reject(new Error(data.error || 'Falha na consulta.'));
        else resolve(data);
      };
      script.onerror = ()=>{
        if (done) return;
        done = true; clearTimeout(timer); cleanup(); reject(new Error('Não foi possível acessar o backend NICE.'));
      };
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  function n(v){ return Number(v || 0); }
  function setText(id,v){ const el=$(id); if(el) el.textContent=v; }

  function renderStats(data){
    const s = data.stats || data;
    setText('#kOpen', F.format(n(s.abertos)));
    setText('#kWaiting', F.format(n(s.aguardando_relatorio)));
    setText('#kLate', F.format(n(s.atrasados)));
    setText('#kClosed', F.format(n(s.finalizados)));

    const target = $('#statusList');
    if (!target) return;
    const rows = s.por_status || {};
    const order = ['PROTOCOLADO','EM_ANALISE','APROVADO','AGUARDANDO_REALIZACAO','AGUARDANDO_RELATORIO','RELATORIO_EM_ATRASO','FINALIZADO','CANCELADO'];
    target.innerHTML = order
      .filter(k => Object.prototype.hasOwnProperty.call(rows,k))
      .map(k => `<div class="status-row"><span>${esc(labelStatus(k))}</span><b>${F.format(n(rows[k]))}</b></div>`)
      .join('') || '<div class="result empty">Nenhum dado de status disponível.</div>';
  }

  function labelStatus(s){
    return ({
      PROTOCOLADO:'Protocolado', EM_ANALISE:'Em análise', APROVADO:'Aprovado',
      AGUARDANDO_REALIZACAO:'Aguardando realização', AGUARDANDO_RELATORIO:'Aguardando relatório',
      RELATORIO_EM_ATRASO:'Relatório em atraso', FINALIZADO:'Finalizado', CANCELADO:'Cancelado'
    })[s] || String(s || '').replaceAll('_',' ');
  }

  function pillClass(s){
    if (s === 'FINALIZADO') return 'finalizado';
    if (s === 'RELATORIO_EM_ATRASO') return 'atraso';
    if (s === 'AGUARDANDO_RELATORIO') return 'relatorio';
    return '';
  }

  function fmtDate(v){
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d) ? esc(v) : d.toLocaleDateString('pt-BR');
  }

  function renderProtocol(p){
    const target = $('#protocolResult');
    if (!target) return;
    if (!p) {
      target.className = 'result empty';
      target.textContent = 'Protocolo não localizado.';
      return;
    }
    const reportUrl = p.link_form_relatorio || C.FORM_RELATORIO_URL || '#';
    target.className = 'result';
    target.innerHTML = `
      <div class="result-head">
        <span class="protocol-id">${esc(p.id)}</span>
        <span class="pill ${pillClass(p.status)}">${esc(labelStatus(p.status))}</span>
      </div>
      <div class="details">
        <div class="detail"><span>Ação</span><strong>${esc(p.titulo || '—')}</strong></div>
        <div class="detail"><span>Curso</span><strong>${esc(p.curso || '—')}</strong></div>
        <div class="detail"><span>Unidade</span><strong>${esc(p.unidade || '—')}</strong></div>
        <div class="detail"><span>Data do protocolo</span><strong>${fmtDate(p.data_protocolo)}</strong></div>
        <div class="detail"><span>Data da ação</span><strong>${fmtDate(p.data_inicio)}${p.data_fim && p.data_fim !== p.data_inicio ? ' a '+fmtDate(p.data_fim) : ''}</strong></div>
        <div class="detail"><span>Prazo do relatório</span><strong>${fmtDate(p.prazo_relatorio)}</strong></div>
        <div class="detail"><span>Relatório recebido</span><strong>${p.relatorio_recebido ? 'Sim' : 'Não'}</strong></div>
        <div class="detail"><span>Encerrado</span><strong>${p.encerrado ? 'Sim' : 'Não'}</strong></div>
      </div>
      <div class="result-actions">
        ${!p.encerrado ? `<a class="btn orange" target="_blank" rel="noopener" href="${esc(reportUrl)}">Enviar relatório final</a>` : ''}
        <button class="btn ghost" type="button" id="refreshProtocol">Atualizar situação</button>
      </div>`;
    const refresh = $('#refreshProtocol');
    if (refresh) refresh.addEventListener('click', ()=>consultar(p.id));
  }

  async function consultar(forceId){
    const input = $('#protocolInput');
    const id = String(forceId || input?.value || '').trim().toUpperCase();
    const target = $('#protocolResult');
    if (!/^NICE-\d{4}-\d{5}$/.test(id)) {
      if (target) { target.className='result empty'; target.textContent='Informe um protocolo no formato NICE-2026-00001.'; }
      return;
    }
    if (input) input.value = id;
    if (!API) {
      if (target) { target.className='result empty'; target.innerHTML='A consulta em tempo real será liberada assim que o Web App do Apps Script for publicado. Os botões de formalização e relatório já estão disponíveis.'; }
      return;
    }
    if (target) { target.className='result empty'; target.textContent='Consultando protocolo…'; }
    try {
      const data = await jsonp('protocol', {id});
      renderProtocol(data.protocol || null);
    } catch (err) {
      if (target) { target.className='result empty'; target.textContent=err.message || 'Falha ao consultar protocolo.'; }
    }
  }

  async function initBackend(){
    if (!API) {
      setBackendState('warn','Aguardando publicação do backend','O portal já encaminha os dois formulários. A consulta e os indicadores ficarão ativos após conectar o Web App do Apps Script.');
      return;
    }
    try {
      const health = await jsonp('health');
      setBackendState('ok','Sistema conectado',`Base operacional disponível${health?.updated_at ? ' · '+new Date(health.updated_at).toLocaleString('pt-BR') : ''}.`);
      const stats = await jsonp('stats');
      renderStats(stats);
    } catch (err) {
      setBackendState('err','Falha na conexão',err.message || 'Não foi possível consultar o Apps Script.');
    }
  }

  const searchBtn = $('#searchProtocol');
  if (searchBtn) searchBtn.addEventListener('click', ()=>consultar());
  const input = $('#protocolInput');
  if (input) input.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();consultar();} });

  initBackend();
  if (API && Number(C.REFRESH_SECONDS) > 0) {
    setInterval(async()=>{ try { renderStats(await jsonp('stats')); } catch (_) {} }, Number(C.REFRESH_SECONDS)*1000);
  }
})();
