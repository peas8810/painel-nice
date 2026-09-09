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

  // Transporte robusto para Google Apps Script.
  // O endpoint é carregado em iframe invisível e devolve os dados via postMessage.
  // Isso evita o bloqueio que alguns navegadores aplicam ao redirect do ContentService
  // quando a resposta é carregada diretamente como <script> em outro domínio.
  let requestSeq = 0;
  function apiRequest(action, params={}){
    return new Promise((resolve,reject)=>{
      if (!API) return reject(new Error('API não configurada.'));

      const requestId = 'nice_' + Date.now() + '_' + (++requestSeq) + '_' + Math.random().toString(36).slice(2,9);
      const sep = API.includes('?') ? '&' : '?';
      const query = new URLSearchParams({
        action,
        transport:'bridge',
        request_id:requestId,
        _:String(Date.now())
      });
      Object.entries(params).forEach(([k,v])=>query.set(k,String(v ?? '')));

      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden','true');
      iframe.tabIndex = -1;
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.src = API + sep + query.toString();

      let done = false;
      const cleanup = ()=>{
        window.removeEventListener('message', onMessage);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      const timer = setTimeout(()=>{
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('Tempo limite ao consultar o backend NICE.'));
      }, 25000);

      const onMessage = event => {
        const data = event && event.data;
        if (!data || data.source !== 'NICE_API_BRIDGE' || data.request_id !== requestId) return;
        if (done) return;
        done = true;
        clearTimeout(timer);
        cleanup();
        const payload = data.payload;
        if (payload && payload.ok === false) reject(new Error(payload.error || 'Falha na consulta.'));
        else resolve(payload);
      };

      window.addEventListener('message', onMessage);
      document.body.appendChild(iframe);
    });
  }

  function n(v){ return Number(v || 0); }
  function setText(id,v){ const el=$(id); if(el) el.textContent=v; }

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
    if (s === 'APROVADO') return 'aprovado';
    if (s === 'CANCELADO') return 'cancelado';
    return '';
  }

  function fmtDate(v){
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d) ? esc(v) : d.toLocaleDateString('pt-BR');
  }

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

  function renderProjects(data){
    const body = $('#projectTableBody');
    const meta = $('#projectCount');
    if (!body) return;
    const projects = Array.isArray(data?.projects) ? data.projects : [];
    if (meta) meta.textContent = projects.length === 1 ? '1 projeto exibido' : `${F.format(projects.length)} projetos exibidos`;

    if (!projects.length) {
      body.innerHTML = '<tr><td colspan="7" class="table-empty">Nenhum projeto encontrado para os filtros informados.</td></tr>';
      return;
    }

    body.innerHTML = projects.map(p => {
      const place = [p.curso,p.unidade].filter(Boolean).join(' · ') || '—';
      return `<tr class="project-row" data-id="${esc(p.id)}">
        <td><button class="protocol-link" type="button" data-protocol="${esc(p.id)}">${esc(p.id)}</button></td>
        <td class="responsavel-cell">${esc(p.responsavel || '—')}</td>
        <td class="title-cell">${esc(p.titulo || '—')}</td>
        <td>${esc(place)}</td>
        <td><span class="pill ${pillClass(p.status)}">${esc(labelStatus(p.status))}</span></td>
        <td>${fmtDate(p.data_protocolo)}</td>
        <td>${fmtDate(p.data_inicio)}</td>
      </tr>`;
    }).join('');

    body.querySelectorAll('[data-protocol]').forEach(btn => {
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-protocol');
        const input = $('#protocolInput');
        if (input) input.value = id;
        consultar(id);
        document.querySelector('#consulta')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
  }

  async function carregarProjetos(){
    const body = $('#projectTableBody');
    const q = String($('#projectSearch')?.value || '').trim();
    const status = String($('#projectStatus')?.value || '').trim();
    if (!API) {
      if (body) body.innerHTML = '<tr><td colspan="7" class="table-empty">A lista pública ficará disponível assim que o Web App do Apps Script for conectado.</td></tr>';
      return;
    }
    if (body) body.innerHTML = '<tr><td colspan="7" class="table-empty">Atualizando projetos…</td></tr>';
    try {
      const data = await apiRequest('projects',{q,status,limit:500});
      renderProjects(data);
    } catch (err) {
      if (body) body.innerHTML = `<tr><td colspan="7" class="table-empty error-text">${esc(err.message || 'Falha ao carregar os projetos.')}</td></tr>`;
      setText('#projectCount','Falha ao atualizar a lista pública.');
    }
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
        <div class="detail"><span>Responsável pela submissão</span><strong>${esc(p.responsavel || '—')}</strong></div>
        <div class="detail"><span>Título da ação</span><strong>${esc(p.titulo || '—')}</strong></div>
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
      const data = await apiRequest('protocol', {id});
      renderProtocol(data.protocol || null);
    } catch (err) {
      if (target) { target.className='result empty'; target.textContent=err.message || 'Falha ao consultar protocolo.'; }
    }
  }

  async function initBackend(){
    if (!API) {
      setBackendState('warn','Aguardando publicação do backend','O portal já encaminha os formulários. A consulta, o painel público e os indicadores ficarão ativos após conectar o Web App do Apps Script.');
      carregarProjetos();
      return;
    }
    try {
      const health = await apiRequest('health');
      setBackendState('ok','Sistema conectado',`Base operacional disponível${health?.updated_at ? ' · '+new Date(health.updated_at).toLocaleString('pt-BR') : ''}.`);
      const stats = await apiRequest('stats');
      renderStats(stats);
      await carregarProjetos();
    } catch (err) {
      setBackendState('err','Falha na conexão',err.message || 'Não foi possível consultar o Apps Script.');
    }
  }

  const searchBtn = $('#searchProtocol');
  if (searchBtn) searchBtn.addEventListener('click', ()=>consultar());
  const input = $('#protocolInput');
  if (input) input.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();consultar();} });

  const filterBtn = $('#projectFilterButton');
  if (filterBtn) filterBtn.addEventListener('click', carregarProjetos);
  const projectSearch = $('#projectSearch');
  if (projectSearch) projectSearch.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();carregarProjetos();} });
  const projectStatus = $('#projectStatus');
  if (projectStatus) projectStatus.addEventListener('change', carregarProjetos);
  const clear = $('#projectClear');
  if (clear) clear.addEventListener('click', ()=>{
    if (projectSearch) projectSearch.value='';
    if (projectStatus) projectStatus.value='';
    carregarProjetos();
  });

  initBackend();
  if (API && Number(C.REFRESH_SECONDS) > 0) {
    setInterval(async()=>{
      try {
        renderStats(await apiRequest('stats'));
        await carregarProjetos();
      } catch (_) {}
    }, Number(C.REFRESH_SECONDS)*1000);
  }
})();
