(()=>{
  const API='https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec';
  const statusEl=document.getElementById('status'),kpis=document.getElementById('kpis'),eventsBody=document.getElementById('eventsBody'),certsBody=document.getElementById('certsBody'),customLinksBody=document.getElementById('customLinksBody'),booksBody=document.getElementById('booksBody'),bookRegistersBody=document.getElementById('bookRegistersBody'),bookSummary=document.getElementById('bookSummary');
  const eventSearch=document.getElementById('eventSearch'),eventStatus=document.getElementById('eventStatus'),certSearch=document.getElementById('certSearch'),certStatus=document.getElementById('certStatus');
  const authBtn=document.getElementById('authBtn'),newEventBtn=document.getElementById('newEventBtn'),customLinkBtn=document.getElementById('customLinkBtn'),adminState=document.getElementById('adminState');
  const modal=document.getElementById('modal'),eventForm=document.getElementById('eventForm'),formResult=document.getElementById('formResult'),createBtn=document.getElementById('createBtn');
  const authorSearch=document.getElementById('authorSearch'),authorSearchBtn=document.getElementById('authorSearchBtn'),authorSearchStatus=document.getElementById('authorSearchStatus'),authorSearchBody=document.getElementById('authorSearchBody');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  const fmtDateTime=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  let data={summary:{},events:[],certificates:[]},customLinks=[],digitalBooks={books:[],recent:[],summary:{}};
  let adminKey=localStorage.getItem('nice_cert_admin_key')||'';

  function jsonp(params,timeout=30000){return new Promise((resolve,reject)=>{const cb='__nice_dash_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script'),u=new URL(API);Object.entries({...params,callback:cb,_:Date.now()}).forEach(([k,v])=>u.searchParams.set(k,v));let done=false;const finish=(err,p)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch(_){}s.remove();err?reject(err):resolve(p)};window[cb]=p=>finish(null,p);s.onerror=()=>finish(new Error('Não foi possível comunicar com o sistema.'));const t=setTimeout(()=>finish(new Error('Tempo esgotado na comunicação.')),timeout);s.src=u.toString();document.head.appendChild(s)})}
  const dashboardCall=()=>jsonp({action:'cert_dashboard'});
  const adminCall=(op,params={})=>jsonp({action:'cert_admin',op,admin_key:adminKey,...params},60000);

  function pill(status){const s=String(status||'').toUpperCase();let cls='closed',label=s||'SEM STATUS';if(['EMISSAO_ABERTA','ABERTO'].includes(s)){cls='open';label=s==='ABERTO'?'ABERTO':'EMISSÃO ABERTA'}else if(['EMISSAO_FECHADA','FECHADO'].includes(s)){cls='closed';label=s==='FECHADO'?'FECHADO':'EMISSÃO FECHADA'}else if(s==='REVOGADO'){cls='revoked'}else if(s==='ENVIADO'){cls='sent'}else if(s==='ATIVO'){cls='active'}return `<span class="pill ${cls}">${esc(label)}</span>`}
  async function copy(text,btn){try{await navigator.clipboard.writeText(text);if(btn){const old=btn.textContent;btn.textContent='Copiado';setTimeout(()=>btn.textContent=old,1200)}}catch(_){prompt('Copie o link:',text)}}

  function setAdmin(ok){
    newEventBtn.disabled=!ok;customLinkBtn.disabled=!ok;authBtn.textContent=ok?'Sair da administração':'Acessar administração';
    adminState.textContent=ok?'Acesso administrativo ativo nesta sessão':'Acesso administrativo não autenticado';adminState.classList.toggle('ok',ok);
    if(!ok){customLinks=[];digitalBooks={books:[],recent:[],summary:{}};renderCustomLinks();renderDigitalBooks();if(authorSearchStatus)authorSearchStatus.textContent='Autentique para pesquisar titulares.';if(authorSearchBody)authorSearchBody.innerHTML='<tr><td colspan="8" class="empty">Nenhuma pesquisa realizada.</td></tr>'}else if(authorSearchStatus){authorSearchStatus.textContent='Digite um nome para pesquisar.'}renderEvents();renderCerts()
  }
  async function authenticate(){if(adminKey){adminKey='';localStorage.removeItem('nice_cert_admin_key');setAdmin(false);return;}const key=prompt('Digite a chave administrativa do Dashboard de Certificados:');if(!key)return;adminKey=key.trim();try{const p=await adminCall('auth');if(!p||!p.ok)throw new Error(p&&p.error||'Chave inválida.');localStorage.setItem('nice_cert_admin_key',adminKey);setAdmin(true);await Promise.all([loadCustomLinks(),loadDigitalBooks()])}catch(e){adminKey='';localStorage.removeItem('nice_cert_admin_key');setAdmin(false);alert(e.message||'Não foi possível autenticar.')}}
  async function restoreAuth(){if(!adminKey){setAdmin(false);return}try{const p=await adminCall('auth');if(!p||!p.ok)throw new Error();setAdmin(true);await Promise.all([loadCustomLinks(),loadDigitalBooks()])}catch(_){adminKey='';localStorage.removeItem('nice_cert_admin_key');setAdmin(false)}}

  function renderKpis(){const s=data.summary||{};const items=[['Eventos',s.eventos||0],['Emissão aberta',s.emissao_aberta||0],['Emissão fechada',s.emissao_fechada||0],['Certificados emitidos',s.certificados_emitidos||0],['Revogados',s.certificados_revogados||0]];kpis.innerHTML=items.map(([l,v])=>`<div class="kpi"><span>${esc(l)}</span><strong>${Number(v||0).toLocaleString('pt-BR')}</strong></div>`).join('')}

  function renderEvents(){const q=eventSearch.value.trim().toLowerCase(),st=eventStatus.value,isAdmin=!!adminKey;const rows=(data.events||[]).filter(e=>{const hay=[e.id,e.titulo,e.campus_unidade,e.protocolo_nice].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!st||String(e.status).toUpperCase()===st)});eventsBody.innerHTML=rows.length?rows.map(e=>{const open=String(e.status||'').toUpperCase()==='EMISSAO_ABERTA';return `<tr><td><strong>${esc(e.id)}</strong></td><td>${esc(e.titulo||'—')}</td><td>${fmtDate(e.data_evento)}</td><td>${esc(e.campus_unidade||'—')}</td><td>${e.emissao_inicio||e.emissao_fim?`${fmtDateTime(e.emissao_inicio)}<br><span class="admin-hint">até ${fmtDateTime(e.emissao_fim)}</span>`:'Sem limite automático'}</td><td>${pill(e.status)}</td><td>${Number(e.certificados_emitidos||0).toLocaleString('pt-BR')}</td><td><div class="actions"><a class="mini primary" target="_blank" rel="noopener" href="${esc(e.url_publica)}">Abrir</a><button class="mini copy" data-link="${esc(e.url_publica)}">Copiar link</button></div></td><td><div class="actions">${isAdmin?`<button class="mini institution" data-id="${esc(e.id)}" data-current="${esc(e.instituicao_emissora||'')}">Instituição</button><button class="mini toggle ${open?'danger':'success'}" data-id="${esc(e.id)}" data-next="${open?'EMISSAO_FECHADA':'EMISSAO_ABERTA'}">${open?'Fechar emissão':'Abrir emissão'}</button>`:'<span class="admin-hint">Autentique para controlar</span>'}</div></td></tr>`}).join(''):`<tr><td colspan="9" class="empty">Nenhum evento encontrado.</td></tr>`;eventsBody.querySelectorAll('.copy').forEach(b=>b.onclick=()=>copy(b.dataset.link,b));eventsBody.querySelectorAll('.toggle').forEach(b=>b.onclick=()=>toggleStatus(b));eventsBody.querySelectorAll('.institution').forEach(b=>b.onclick=()=>setEventInstitution(b))}

  function renderCerts(){const q=certSearch.value.trim().toLowerCase(),st=certStatus.value,isAdmin=!!adminKey;const rows=(data.certificates||[]).filter(c=>{const hay=[c.codigo,c.evento_id].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!st||String(c.status).toUpperCase()===st)});certsBody.innerHTML=rows.length?rows.map(c=>{const revoked=String(c.status||'').toUpperCase()==='REVOGADO';return `<tr><td class="code">${esc(c.codigo)}</td><td>${esc(c.evento_id)}</td><td>${pill(c.status)}</td><td>${fmtDateTime(c.emitido_em)}</td><td><a class="mini primary" target="_blank" rel="noopener" href="${esc(c.validacao)}">Validar</a></td><td>${isAdmin?`<div class="actions"><button class="mini regen" data-code="${esc(c.codigo)}">Atualizar PDF</button>${revoked?'':`<button class="mini danger revoke" data-code="${esc(c.codigo)}">Cancelar certificado</button>`}</div>`:'<span class="admin-hint">Autentique</span>'}</td></tr>`}).join(''):`<tr><td colspan="6" class="empty">Nenhum certificado encontrado.</td></tr>`;certsBody.querySelectorAll('.regen').forEach(b=>b.onclick=()=>regenerateCertificate(b));certsBody.querySelectorAll('.revoke').forEach(b=>b.onclick=()=>revokeCertificate(b))}

  async function searchCertificatesByName(){
    if(!adminKey){alert('Acesse a administração para pesquisar titulares.');return}
    const q=String(authorSearch&&authorSearch.value||'').trim();
    if(q.length<2){if(authorSearchStatus)authorSearchStatus.textContent='Informe ao menos 2 caracteres.';authorSearch?.focus();return}
    authorSearchBtn.disabled=true;
    if(authorSearchStatus)authorSearchStatus.textContent='Pesquisando…';
    try{
      const p=await adminCall('search_certificates_by_name',{q});
      if(!p||!p.ok)throw new Error(p&&p.error||'Falha na pesquisa.');
      const rows=p.results||[];
      if(authorSearchStatus)authorSearchStatus.textContent=rows.length===1?'1 certificado encontrado':rows.length+' certificados encontrados';
      authorSearchBody.innerHTML=rows.length?rows.map(x=>`<tr>
        <td><strong>${esc(x.nome||'—')}</strong></td>
        <td>${esc(x.email||'—')}</td>
        <td>${esc(x.titulo_evento||x.evento_id||'—')}</td>
        <td class="code">${esc(x.codigo||'—')}</td>
        <td>${esc(x.livro_digital||'—')}<br><span class="admin-hint">Registro ${esc(x.registro_digital||'—')}</span></td>
        <td>${pill(x.status)}</td>
        <td>${fmtDateTime(x.emitido_em)}</td>
        <td><a class="mini primary" target="_blank" rel="noopener" href="${esc(x.validacao)}">Validar</a></td>
      </tr>`).join(''):'<tr><td colspan="8" class="empty">Nenhum certificado encontrado para esse nome.</td></tr>';
    }catch(e){
      if(authorSearchStatus)authorSearchStatus.textContent=e.message||'Falha na pesquisa.';
      if(authorSearchBody)authorSearchBody.innerHTML='<tr><td colspan="8" class="empty">Não foi possível realizar a pesquisa.</td></tr>';
    }finally{authorSearchBtn.disabled=false}
  }

  function renderCustomLinks(){
    if(!adminKey){customLinksBody.innerHTML='<tr><td colspan="7" class="empty">Os links customizados ficam salvos no sistema. Acesse a administração para visualizar, copiar ou controlar os links.</td></tr>';return}
    customLinksBody.innerHTML=customLinks.length?customLinks.map(l=>{const open=String(l.status).toUpperCase()==='ABERTO';return `<tr><td><strong>${esc(l.id)}</strong></td><td>${esc(l.rotulo||'—')}</td><td><strong>${esc(l.instituicao_emissora||'—')}</strong><br><span class="admin-hint">Livro e registro são gerados automaticamente para cada certificado.</span>${l.emissao_inicio||l.emissao_fim?`<br><span class="admin-hint">${fmtDateTime(l.emissao_inicio)} → ${fmtDateTime(l.emissao_fim)}</span>`:''}</td><td>${pill(l.status)}</td><td>${Number(l.emitidos||0).toLocaleString('pt-BR')}</td><td><div class="actions"><a class="mini primary" target="_blank" rel="noopener" href="${esc(l.url_publica)}">Abrir</a><button class="mini custom-copy" data-link="${esc(l.url_publica)}">Copiar link</button></div></td><td><button class="mini custom-toggle ${open?'danger':'success'}" data-id="${esc(l.id)}" data-next="${open?'FECHADO':'ABERTO'}">${open?'Fechar emissão':'Abrir emissão'}</button></td></tr>`}).join(''):'<tr><td colspan="7" class="empty">Nenhum link customizado criado.</td></tr>';
    customLinksBody.querySelectorAll('.custom-copy').forEach(b=>b.onclick=()=>copy(b.dataset.link,b));customLinksBody.querySelectorAll('.custom-toggle').forEach(b=>b.onclick=()=>toggleCustomStatus(b));
  }

  async function loadCustomLinks(){if(!adminKey)return;try{const p=await adminCall('custom_links');if(!p||!p.ok)throw new Error(p&&p.error||'Falha ao carregar links.');customLinks=p.links||[];renderCustomLinks()}catch(e){customLinksBody.innerHTML='<tr><td colspan="6" class="empty">'+esc(e.message||'Falha ao carregar links customizados.')+'</td></tr>'}}

  async function createCustomLink(){
    const rotulo=prompt('Identificação interna para este link customizado:','Emissão customizada');
    if(rotulo===null)return;
    const instituicao=prompt('Informe a instituição emissora:','AlfaUnipac');
    if(instituicao===null)return;
    const inicio=prompt('Início da emissão (opcional).\nFormato: AAAA-MM-DDTHH:MM\nEx.: 2026-09-25T18:00','');
    if(inicio===null)return;
    const fim=prompt('Fim da emissão (opcional).\nFormato: AAAA-MM-DDTHH:MM\nEx.: 2026-09-25T23:59','');
    if(fim===null)return;
    if(!instituicao.trim()){alert('A instituição emissora é obrigatória.');return}

    customLinkBtn.disabled=true;
    try{
      const p=await adminCall('create_custom_link',{
        rotulo:rotulo.trim()||'Emissão customizada',
        instituicao_emissora:instituicao.trim(),
        via_emitida:'1ª Via Emitida',
        emissao_inicio:inicio.trim(),
        emissao_fim:fim.trim()
      });
      if(!p||!p.ok)throw new Error(p&&p.error||'Não foi possível criar o link.');
      await loadCustomLinks();
      await copy(p.link.url_publica);
      alert('Link customizado criado e copiado.\n\n'+p.link.url_publica+
        '\n\nInstituição emissora: '+p.link.instituicao_emissora+
        '\nLivro e registro: gerados automaticamente a cada certificado'+
        (p.link.emissao_inicio?'\nInício: '+fmtDateTime(p.link.emissao_inicio):'')+
        (p.link.emissao_fim?'\nFim: '+fmtDateTime(p.link.emissao_fim):''));
    }catch(e){alert(e.message||'Falha ao criar link customizado.')}
    finally{customLinkBtn.disabled=false}
  }

  function renderDigitalBooks(){
    if(!booksBody||!bookRegistersBody)return;
    if(!adminKey){
      booksBody.innerHTML='<tr><td colspan="5" class="empty">Autentique para visualizar os livros digitais.</td></tr>';
      bookRegistersBody.innerHTML='<tr><td colspan="6" class="empty">Autentique para visualizar os registros.</td></tr>';
      if(bookSummary)bookSummary.textContent='Autentique para consultar os livros digitais.';
      return;
    }
    const s=digitalBooks.summary||{},books=digitalBooks.books||[],recent=digitalBooks.recent||[];
    if(bookSummary)bookSummary.textContent=
      Number(s.instituicoes||0).toLocaleString('pt-BR')+' instituição(ões) · '+
      Number(s.livros||0).toLocaleString('pt-BR')+' livro(s) · '+
      Number(s.registros||0).toLocaleString('pt-BR')+' registro(s)';
    booksBody.innerHTML=books.length?books.map(b=>`<tr>
      <td><strong>${esc(b.instituicao||'—')}</strong></td>
      <td>${esc(b.livro||'—')}</td>
      <td class="code">${esc(b.ultimo_registro||'000000')}</td>
      <td>${Number(b.total_registros||0).toLocaleString('pt-BR')}</td>
      <td>${pill(b.status||'ABERTO')}</td>
    </tr>`).join(''):'<tr><td colspan="5" class="empty">Nenhum livro digital criado ainda.</td></tr>';
    bookRegistersBody.innerHTML=recent.length?recent.map(x=>`<tr>
      <td>${esc(x.instituicao||'—')}</td>
      <td>${esc(x.livro||'—')}</td>
      <td class="code">${esc(x.registro||'—')}</td>
      <td class="code">${esc(x.codigo||'—')}</td>
      <td>${pill(x.status||'—')}</td>
      <td>${fmtDateTime(x.emitido_em)}</td>
    </tr>`).join(''):'<tr><td colspan="6" class="empty">Nenhum registro emitido ainda.</td></tr>';
  }

  async function loadDigitalBooks(){
    if(!adminKey){renderDigitalBooks();return}
    try{
      const p=await adminCall('digital_books');
      if(!p||!p.ok)throw new Error(p&&p.error||'Falha ao carregar o Livro Digital.');
      digitalBooks=p;
      renderDigitalBooks();
    }catch(e){
      if(bookSummary)bookSummary.textContent=e.message||'Falha ao carregar o Livro Digital.';
    }
  }

  async function revokeCertificate(btn){
    const code=btn.dataset.code;
    const reason=prompt('Informe o motivo do cancelamento deste certificado.\n\nO código continuará consultável, mas aparecerá como REVOGADO e sem validade:');
    if(reason===null)return;
    if(reason.trim().length<3){alert('Informe um motivo para o cancelamento.');return}
    if(!confirm('Cancelar definitivamente o certificado '+code+'?\n\nEle perderá a validade no validador público.'))return;
    const old=btn.textContent;btn.disabled=true;btn.textContent='Cancelando…';
    try{
      const p=await adminCall('revoke_certificate',{code,reason:reason.trim()});
      if(!p||!p.ok)throw new Error(p&&p.error||'Não foi possível cancelar o certificado.');
      alert(p.message||'Certificado cancelado.');
      await load();
    }catch(e){alert(e.message||'Falha ao cancelar o certificado.')}
    finally{btn.disabled=false;btn.textContent=old}
  }

  async function regenerateCertificate(btn){
    const code=btn.dataset.code;
    if(!confirm('Regenerar o PDF de '+code+' com o layout institucional premium?\n\nO código, o HMAC e a data original de emissão serão preservados.'))return;
    const old=btn.textContent;btn.disabled=true;btn.textContent='Atualizando…';
    try{
      const p=await adminCall('regenerate_certificate',{code});
      if(!p||!p.ok)throw new Error(p&&p.error||'Não foi possível regenerar o PDF.');
      alert('PDF atualizado com sucesso.\n\n'+code+'\n\nA validação digital permanece a mesma.');
      await load();
    }catch(e){alert(e.message||'Falha ao atualizar o PDF.')}
    finally{btn.disabled=false;btn.textContent=old}
  }

  async function toggleCustomStatus(btn){const id=btn.dataset.id,next=btn.dataset.next;if(!confirm((next==='ABERTO'?'Abrir':'Fechar')+' a emissão do link '+id+'?'))return;btn.disabled=true;try{const p=await adminCall('set_custom_status',{link_id:id,status:next});if(!p||!p.ok)throw new Error(p&&p.error||'Falha ao alterar status.');await loadCustomLinks()}catch(e){alert(e.message||'Falha ao atualizar.')}finally{btn.disabled=false}}

  async function setEventInstitution(btn){
    const id=btn.dataset.id;
    const current=btn.dataset.current||'';
    const value=prompt('Informe a instituição emissora do evento '+id+':',current||'AlfaUnipac');
    if(value===null)return;
    if(!value.trim()){alert('Informe a instituição emissora.');return}
    const old=btn.textContent;btn.disabled=true;btn.textContent='Salvando…';
    try{
      const p=await adminCall('set_event_institution',{event_id:id,instituicao_emissora:value.trim()});
      if(!p||!p.ok)throw new Error(p&&p.error||'Não foi possível salvar a instituição.');
      alert('Instituição atualizada.\n\n'+p.instituicao_emissora+'\n'+Number(p.certificados_atualizados||0)+' certificado(s) existente(s) também foram atualizados.\n\nUse Atualizar PDF para regenerar os documentos já emitidos.');
      await load();
    }catch(e){alert(e.message||'Falha ao atualizar a instituição.')}finally{btn.disabled=false;btn.textContent=old}
  }
  async function toggleStatus(btn){const id=btn.dataset.id,next=btn.dataset.next,label=next==='EMISSAO_ABERTA'?'abrir':'fechar';if(!confirm(`Deseja ${label} a emissão do evento ${id}?`))return;const old=btn.textContent;btn.disabled=true;btn.textContent='Atualizando…';try{const p=await adminCall('set_status',{event_id:id,status:next});if(!p||!p.ok)throw new Error(p&&p.error||'Não foi possível alterar o status.');await load()}catch(e){alert(e.message||'Falha ao atualizar.');btn.disabled=false;btn.textContent=old}}

  function openModal(){formResult.textContent='';eventForm.reset();modal.hidden=false;document.body.classList.add('modal-open');setTimeout(()=>eventForm.elements.titulo.focus(),50)}
  function closeModal(){modal.hidden=true;document.body.classList.remove('modal-open')}

  eventForm.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(eventForm),rawDate=String(f.get('data')||'');let brDate=rawDate;if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){const [y,m,d]=rawDate.split('-');brDate=`${d}/${m}/${y}`};const params={titulo:f.get('titulo')||'',tipo:f.get('tipo')||'',data:brDate,campus:f.get('campus')||'',local:f.get('local')||'',carga:f.get('carga')||'',responsavel:f.get('responsavel')||'',instituicao_emissora:f.get('instituicao')||'',protocolo:f.get('protocolo')||'',emissao_inicio:f.get('emissao_inicio')||'',emissao_fim:f.get('emissao_fim')||'',descricao:f.get('descricao')||'',abrir:f.get('abrir')?'1':'0'};formResult.textContent='Criando evento e publicando a página…';createBtn.disabled=true;try{const p=await adminCall('create_event',params);if(!p||!p.ok)throw new Error(p&&p.error||'Falha ao criar o evento.');formResult.innerHTML=`<strong>Evento ${esc(p.event.id)} criado com sucesso.</strong><br><a target="_blank" rel="noopener" href="${esc(p.event.url_publica)}">Abrir página pública</a>`;await load();setTimeout(closeModal,1800)}catch(err){formResult.textContent=err.message||'Não foi possível criar o evento.'}finally{createBtn.disabled=false}});

  async function load(){statusEl.textContent='Atualizando dados…';try{const p=await dashboardCall();if(!p||!p.ok)throw new Error(p&&p.error||'Falha ao carregar.');data=p;renderKpis();renderEvents();renderCerts();statusEl.textContent='Atualizado em '+fmtDateTime(p.updated_at)+' · atualização automática a cada 60 segundos';if(adminKey)Promise.all([loadCustomLinks(),loadDigitalBooks()])}catch(e){statusEl.textContent=e.message||'Falha ao carregar o dashboard.'}}

  authBtn.addEventListener('click',authenticate);newEventBtn.addEventListener('click',openModal);customLinkBtn.addEventListener('click',createCustomLink);if(authorSearchBtn)authorSearchBtn.addEventListener('click',searchCertificatesByName);if(authorSearch)authorSearch.addEventListener('keydown',e=>{if(e.key==='Enter')searchCertificatesByName()});document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',closeModal));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal()});
  [eventSearch,eventStatus].forEach(x=>x.addEventListener('input',renderEvents));[certSearch,certStatus].forEach(x=>x.addEventListener('input',renderCerts));
  restoreAuth();load();setInterval(load,60000);window.addEventListener('focus',load);
})();