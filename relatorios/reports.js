(()=>{
  const $=id=>document.getElementById(id),M=window.ReportModel,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let source={projects:[],events:[],certificates:[]},snapshot=null,privateAccess=false,hasData=false;
  const filterIds=['kind','query','institution','responsible','event','state','from','to'];
  const filters=()=>Object.fromEntries(filterIds.map(id=>[id,$(id).value]));
  function options(id,values){const value=$(id).value;$(id).innerHTML='<option value="">Todos</option>'+[...new Set(values.filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if([...$(id).options].some(o=>o.value===value))$(id).value=value;}
  function populate(){options('institution',source.events.map(e=>e.instituicao_emissora).concat(source.certificates.map(c=>c.instituicao_emissora)));options('responsible',source.projects.map(p=>p.responsavel).concat(source.events.map(e=>e.responsavel)));options('state',source.projects.concat(source.events,source.certificates).map(x=>x.status));const selected=$('event').value;$('event').innerHTML='<option value="">Todos</option>'+source.events.map(e=>`<option value="${esc(e.id)}">${esc(e.id+' — '+e.titulo)}</option>`).join('');$('event').value=selected;}
  function table(title,headers,rows){return `<h3>${esc(title)}</h3><div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">Nenhum registro encontrado.</td></tr>`}</tbody></table></div>`;}
  function render(){
    if(!hasData)return;const f=filters();if(f.from&&f.to&&f.from>f.to){$('scope').textContent='A data inicial deve ser anterior ou igual à data final.';$('csv').disabled=true;$('print').disabled=true;return;}
    const r=M.build(source,f),sections=[];
    const add=(title,headers,rows)=>sections.push({title,headers,rows});
    const projectRows=rows=>rows.map(p=>[p.id,p.titulo,p.responsavel||'—',p.curso||'—',p.unidade||'—',p.status,p.data_inicio||'—',p.prazo_relatorio||'—']);
    const eventRows=rows=>rows.map(e=>[e.id,e.titulo,e.instituicao_emissora||'—',e.responsavel||'—',e.data_evento||'—',e.emissao_inicio||'—',e.emissao_fim||'—',r.emissionState(e),e.certificados_emitidos??'—']);
    const certHeaders=['Código','Evento','Instituição','Situação','Emitido em','Livro','Registro','Validação'];if(privateAccess)certHeaders.push('Titular','E-mail');
    const certRows=rows=>rows.map(c=>{const a=[c.codigo,c.evento_id,c.instituicao_emissora||'—',c.status,c.emitido_em||'—',c.livro_digital||'—',c.registro_digital||'—',c.validacao||'—'];if(privateAccess)a.push(c.nome||'—',c.email||'—');return a;});
    const ph=['Protocolo','Título','Responsável','Curso','Unidade','Situação','Data da ação','Prazo do relatório'];
    const eh=['Evento','Título','Instituição','Responsável','Data','Início da emissão','Fim da emissão','Situação da janela','Total registrado no evento'];
    if(['overview','projects','responsible'].includes(f.kind))add('Projetos e acompanhamento documental',ph,projectRows(r.projects));
    if(['overview','responsible'].includes(f.kind))add('Eventos de certificação',eh,eventRows(r.events));
    if(f.kind==='open')add('Eventos com emissão aberta agora',eh,eventRows(r.open));
    if(f.kind==='event'){
      add('Identificação e responsabilidade do evento',eh,eventRows(r.events));
      add('Detalhes do evento',['Evento','Tipo','Local','Carga horária','Situação cadastrada','Protocolo vinculado'],r.events.map(e=>[e.id,e.tipo,e.local,e.carga_horaria,e.status,e.protocolo_nice]));
      const ids=new Set(r.events.map(e=>String(e.id).replace(/^0+/,'')));add('Certificados vinculados',certHeaders,certRows(r.certificates.filter(c=>ids.has(String(c.evento_id).replace(/^0+/,'')))));
    }
    if(f.kind==='certificates')add('Certificados e Livro Digital',certHeaders,certRows(r.certificates));
    if(['overview','pending','event'].includes(f.kind))add('Pendências identificadas nos dados disponíveis',['Código','Projeto / Evento','Responsável','Pendência','Data / Prazo'],r.pending);
    const generated=new Date(),code='REL-'+generated.toISOString().replace(/\D/g,'').slice(0,17)+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
    snapshot={code,generated:generated.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),filters:f,metrics:r.metrics,sections,privateAccess,sourceNote:$('loadState').textContent};
    const label=$('kind').selectedOptions[0].textContent;
    $('report').innerHTML=`<h2>${esc(label)}</h2><p class="detail">Código: ${esc(code)}<br>Gerado em: ${esc(snapshot.generated)} (Brasília)<br>Origem: projetos ${esc(source.projectsAt||'sem data')} · certificados ${esc(source.certificatesAt||'sem data')}<br>Estado da fonte: ${esc(snapshot.sourceNote)}<br>Solicitante: ${privateAccess?'sessão administrativa autenticada':'consulta pública'}</p><div class="metrics">${r.metrics.map(([k,v])=>`<div class="metric">${esc(k)}<strong>${v.toLocaleString('pt-BR')}</strong></div>`).join('')}</div><p class="note">Certificados são contados uma vez por código. Participantes únicos, quantidade de PDFs, vias, reenvios e entrega de e-mails: não disponíveis nesta base. Nenhum desses indicadores é estimado.</p>${sections.map(s=>table(s.title,s.headers,s.rows)).join('')}`;
    const filterLabels=filterIds.filter(id=>id!=='kind'&&f[id]).map(id=>`${$(id).closest('label').childNodes[0].textContent.trim()}: ${f[id]}`);
    $('scope').textContent=(privateAccess?'Relatório administrativo com dados pessoais. ':'Relatório público. ')+(filterLabels.length?filterLabels.join(' · '):'Sem filtros.')+' A exportação inclui todas as linhas filtradas, inclusive as próximas páginas.';
    $('csv').disabled=false;$('print').disabled=false;
  }
  async function json(url){const r=await fetch(url+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Não foi possível carregar '+url);const d=await r.json();if(d.ok===false)throw Error(d.error||'Dados indisponíveis');return d;}
  async function load(){
    $('refresh').disabled=true;$('loadState').textContent='Atualizando…';
    const results=await Promise.allSettled([json('../protocolos/live-data.json'),json('../certificados/dashboard/live-data.json')]);
    let failures=[];results.forEach((r,i)=>{if(r.status==='fulfilled'){const d=r.value;if(i===0){source.projects=d.projects?.projects||[];source.projectsAt=d.synced_at||d.health?.updated_at;}else{source.events=d.events||[];source.certificates=d.certificates||[];source.certificatesAt=d.updated_at;privateAccess=false;$('auth').textContent='Dados administrativos';}hasData=true;}else failures.push(i===0?'projetos':'certificados');});
    $('loadState').textContent=failures.length?'Falha ao atualizar '+failures.join(' e ')+'. O relatório pode estar incompleto; dados anteriores foram mantidos.':'Dados sincronizados carregados.';
    if(source.certificates.length>=1000||source.projects.length>=500)$('loadState').textContent+=' Atenção: a fonte pública pode estar limitada aos registros mais recentes. Para certificados completos, utilize Dados administrativos após atualizar o Apps Script.';
    populate();render();$('refresh').disabled=false;
  }
  function adminRequest(key){return new Promise((resolve,reject)=>{const cb='__report_'+Date.now(),s=document.createElement('script'),u=new URL('https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec');let timer;const clean=()=>{clearTimeout(timer);s.remove();delete window[cb]};window[cb]=p=>{clean();p?.ok?resolve(p):reject(Error(p?.error||'Atualize o módulo de relatórios no Apps Script.'))};s.onerror=()=>{clean();reject(Error('Falha de comunicação.'))};timer=setTimeout(()=>{clean();reject(Error('Tempo de comunicação esgotado.'))},60000);Object.entries({action:'cert_admin',op:'reports',admin_key:key,callback:cb}).forEach(([k,v])=>u.searchParams.set(k,v));s.src=u;document.head.append(s);});}
  $('auth').onclick=async()=>{if(privateAccess){source.certificates=source.certificates.map(({nome,email,...c})=>c);privateAccess=false;$('auth').textContent='Dados administrativos';render();return;}const key=prompt('Chave administrativa do painel de certificados:');if(!key)return;$('auth').disabled=true;try{const p=await adminRequest(key.trim());source.events=p.events||[];source.certificates=p.certificates||[];source.certificatesAt=p.updated_at;privateAccess=true;hasData=true;$('auth').textContent='Sair dos dados administrativos';$('loadState').textContent='Base completa de certificados carregada com autenticação.';populate();render();}catch(e){$('loadState').textContent=e.message}finally{$('auth').disabled=false}};
  const csvCell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
  $('csv').onclick=()=>{if(!snapshot)return;const rows=[['Relatório',snapshot.code],['Gerado em',snapshot.generated],['Acesso',snapshot.privateAccess?'Administrativo':'Público'],['Filtros',JSON.stringify(snapshot.filters)],['Estado da fonte',snapshot.sourceNote],['Fonte projetos',source.projectsAt||''],['Fonte certificados',source.certificatesAt||''],[],['Indicador','Quantidade'],...snapshot.metrics];snapshot.sections.forEach(s=>rows.push([],[s.title],s.headers,...s.rows));const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=snapshot.code+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  $('print').onclick=()=>window.print();filterIds.forEach(id=>$(id).addEventListener(id==='query'?'input':'change',render));$('clear').onclick=()=>{filterIds.filter(id=>id!=='kind').forEach(id=>$(id).value='');render()};$('refresh').onclick=load;
  const event=new URLSearchParams(location.search).get('event');load().then(()=>{if(event){$('kind').value='event';$('event').value=source.events.find(e=>M.same(e.id,event))?.id||'';render();}});
})();
