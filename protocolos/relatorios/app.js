(()=>{
  'use strict';
  const M=window.NiceCourseReports,C=window.NiceCourseCertificates,R=window.NiceReportCompliance,$=id=>document.getElementById(id),F=new Intl.NumberFormat('pt-BR');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const states={FINALIZADO:'Finalizado',CANCELADO:'Cancelado',PROTOCOLADO:'Protocolado',EM_ANALISE:'Em análise',APROVADO:'Aprovado',AGUARDANDO_REALIZACAO:'Aguardando realização',AGUARDANDO_RELATORIO:'Aguardando relatório',RELATORIO_EM_ATRASO:'Relatório em atraso'};
  let history=null,live=null,certificateBaseline=null,certificateLive=null,reportPolicy=null,records=[],selected=[],snapshot=null,loading=false,page=0;
  const filters=()=>({unit:$('unit').value,course:$('course').value,year:$('year').value});
  const sorted=items=>[...new Set(items)].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR',{numeric:true}));
  const displayDate=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'data não disponível':d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});};
  const countText=value=>Number.isFinite(value)?F.format(value):'ND';
  function options(id,items,label){
    const value=$(id).value;$(id).innerHTML=`<option value="">${label}</option>`+sorted(items).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
    if([...$(id).options].some(o=>o.value===value))$(id).value=value;
  }
  function populate(){
    options('unit',records.map(r=>r.unit),'Todos os campus e unidades');
    const scope=M.filter(records,{unit:$('unit').value});
    options('course',scope.flatMap(r=>r.courses),'Todos os cursos');
    options('year',records.map(r=>r.year).filter(Boolean),'Todos os anos');
  }
  function table(headers,rows,cls=''){
    return `<table class="${cls}"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">Nenhum registro neste recorte.</td></tr>`}</tbody></table>`;
  }
  function bars(id,rows,label){
    const max=Math.max(...rows.map(r=>r[1]),1);
    $(id).innerHTML=rows.length?rows.map(([name,count])=>`<div class="bar"><div class="bar-label"><span>${esc(label?label(name):name)}</span><strong>${F.format(count)}</strong></div><div class="bar-track"><i style="width:${100*count/max}%"></i></div></div>`).join(''):'<p class="empty">Nenhum registro neste recorte.</p>';
  }
  function projectRows(){
    const rows=selected.filter(r=>r.protocols.length).sort((a,b)=>Math.max(...b.protocols.map(id=>Number(id.slice(-5))))-Math.max(...a.protocols.map(id=>Number(id.slice(-5)))));
    const pages=Math.max(1,Math.ceil(rows.length/15));page=Math.min(page,pages-1);
    $('projectCount').textContent=F.format(rows.length)+' formalizações vinculadas';
    $('projects').innerHTML=table(['Protocolos','Ação','Curso','Campus / unidade','Situação'],rows.slice(page*15,page*15+15).map(r=>[
      r.protocols.map(id=>esc(id)).join('<br>'),esc(r.titles.join(' / ')||r.type||r.id),r.courses.map(esc).join('<br>'),esc(r.unit),
      r.protocols.map(id=>`${esc(id.slice(-5))} · ${esc(states[r.states[id]]||(r.closed_protocols.includes(id)?'Finalizado':'Situação anterior'))}`).join('<br>')
    ]));
    $('pageState').textContent=`Página ${page+1} de ${pages}`;$('previous').disabled=page===0;$('next').disabled=page>=pages-1;
  }
  function render(){
    if(!history)return;
    const f=filters();selected=M.filter(records,f);const summary=M.summarize(selected),protocolCoverage=M.summarize(records);
    const metrics=[['Registros de ações',F.format(summary.total),'Formalizações distintas após reconciliação'],['Protocolos NICE',F.format(summary.protocols),'Identificadores vinculados ao recorte'],['Encerramentos administrativos',F.format(summary.closed),'Não equivale à entrega do relatório final'],['Público previsto',summary.expectedN?F.format(summary.expected):'ND',`Planejamento informado em ${F.format(summary.expectedN)} registros`]];
    $('metrics').innerHTML=metrics.map(([label,n,note])=>`<article class="metric"><span>${label}</span><strong>${n}</strong><small>${note}</small></article>`).join('');
    $('scope').textContent=[f.unit||'Todos os campus e unidades',f.course||'Todos os cursos',f.year||'Todos os anos'].join(' · ')+` · ${F.format(summary.total)} registros`;
    $('protocolCoverage').textContent=`Planilha de protocolos integrada: ${F.format(protocolCoverage.live)} formalizações vinculadas a ${F.format(protocolCoverage.protocols)} números NICE na base completa. Neste recorte: ${F.format(summary.live)} formalizações e ${F.format(summary.protocols)} números NICE. Essas ações já entram nos totais, nas estatísticas e no PDF, uma vez por formalização.`;
    const complianceStats=R.analyze(selected,reportPolicy||{}),rp=complianceStats;
    $('reportPolicy').textContent=rp.configured?`Obrigatoriedade a partir de ${rp.cutoff.split('-').reverse().join('/')}. Referência: data original da formalização, sem usar a data de importação.`:'A data oficial de obrigatoriedade ainda precisa ser confirmada. Histórico e cumprimento permanecem a verificar, sem cobrança retroativa presumida.';
    const rm=[['Histórico anterior à exigência',rp.configured?F.format(rp.historical):'ND','Mantido na produção; sem pendência por ausência de documento final'],['Fluxo atual',rp.configured?F.format(rp.current):'ND',`${F.format(rp.unclassified)} registros com enquadramento a verificar`],['Relatórios exigíveis',rp.configured?F.format(rp.eligible):'ND','Somente ações com prazo já vencido'],['Taxa de entrega',rp.rate===null?(rp.configured?(rp.eligible?'Não apurado':'N/A'):'A definir'):R.rateText(rp),rp.rateLabel||`${F.format(rp.received)} entregas confirmadas / ${F.format(rp.eligible)} exigíveis`]];
    $('reportMetrics').innerHTML=rm.map(([label,value,note])=>`<article class="metric"><span>${esc(label)}</span><strong style="font-size:${String(value).length>8?'21':'33'}px">${esc(value)}</strong><small>${esc(note)}</small></article>`).join('');
    $('reportScope').textContent=`${F.format(rp.pending)} pendências de entrega confirmadas; ${F.format(rp.unknown)} recebimentos a verificar entre os exigíveis; ${F.format(rp.notDue)} ações com prazo aberto; ${F.format(rp.missingDeadline)} prazos ausentes ou divergentes. Encerramento administrativo não é prova de recebimento do relatório.`;
    if(!rp.configured)$('reportScope').textContent='Taxas, enquadramento e pendências de entrega não apurados enquanto a data oficial de obrigatoriedade não for confirmada. Todo o acervo permanece na produção e nas análises.';
    $('reportCourses').innerHTML=table(['Curso','Histórico','Fluxo atual','Exigíveis','Entregas confirmadas','Taxa de entrega'],rp.courses.map(c=>[esc(c.course),rp.configured?F.format(c.historical):'ND',rp.configured?F.format(c.current):'ND',rp.configured?F.format(c.eligible):'ND',rp.configured&&!(c.received===0&&c.unknown)?F.format(c.received):'ND',esc(R.rateText(c))]));
    const certificateDataset=C.resolve(certificateBaseline,certificateLive),certificateStats=C.analyze(certificateDataset,selected,records);
    if(certificateStats){
      const g=certificateStats.global,c=certificateStats.scope,display=C.displayScope(certificateStats);
      $('certificateSource').textContent=`${certificateStats.source} · ${displayDate(certificateStats.updatedAt)}. Somente AlfaUnipac. Arquivo enviado: ${countText(certificateStats.snapshot.certificates)} emissões e ${countText(certificateStats.snapshot.bookRecords)} emissões com referência no Livro Digital, conciliadas por código. ${certificateStats.warning}`;
      const cm=[['Emissões da AlfaUnipac',g.total,`${F.format(g.valid)} vigentes · ${F.format(g.revoked)} revogadas`],['Emissões confirmadas no recorte',display.total,display.pending?'Não apurado — vinculação pendente':`${F.format(c.actions)} formalizações com vínculo preciso`],['Vigentes confirmadas no recorte',display.valid,display.pending?'Não apurado — vinculação pendente':'Situação ENVIADO ou ATIVO'],['Registro no Livro · recorte',display.registered,display.pending?'Não apurado — vinculação pendente':'Referência documental da mesma emissão']];
      $('certificateMetrics').innerHTML=cm.map(([label,value,note])=>`<article class="metric"><span>${esc(label)}</span><strong>${countText(value)}</strong><small>${esc(note)}</small></article>`).join('');
      $('certificateScope').textContent=`Na base completa, ${F.format(g.linked)} emissões têm vínculo preciso com uma formalização e ${F.format(g.unlinked)} aguardam esse vínculo. `+(display.pending?'O total de emissões deste recorte não foi apurado. Zero vínculos confirmados não significa ausência de certificação.':`No recorte, há ${F.format(c.events)} eventos de certificação e ${F.format(c.revoked)} emissões revogadas com vínculo confirmado.`)+' Livro e backup não são somados como novas ações ou certificados.';
      $('certificateCourses').innerHTML=table(['Curso no recorte','Formalizações vinculadas','Emissões','Vigentes','Revogadas','Com registro no Livro'],certificateStats.courses.filter(c=>c.actions).map(c=>[esc(c.course),String(c.actions),F.format(c.total),F.format(c.valid),F.format(c.revoked),F.format(c.registered)]));
      if(display.pending)$('certificateCourses').innerHTML='<p class="note">Não apurado — vinculação documental pendente para este recorte.</p>';
      $('sourceInventory').innerHTML=table(['Aba','Linhas preenchidas','Uso na análise'],certificateStats.snapshot.inventory.map(s=>[esc(s.sheet),F.format(s.rows),esc(s.use)]));
    }else{
      $('certificateSource').textContent='A fonte de certificação está indisponível. Indicadores de certificados: ND.';$('certificateMetrics').innerHTML='';$('certificateScope').textContent='Os cálculos de formalizações continuam disponíveis. A ausência da fonte de certificação não foi interpretada como zero emissões.';$('certificateCourses').innerHTML='';$('sourceInventory').innerHTML='';
    }
    bars('courseChart',summary.courses.slice(0,10));bars('unitChart',summary.units);bars('yearChart',summary.years);bars('odsChart',summary.ods.slice(0,8),n=>'ODS '+n+' · '+(history.labels[n]||''));
    const odsNumbers=Array.from({length:17},(_,i)=>i+1);
    $('heatmap').innerHTML=table(['Curso',...odsNumbers.map(n=>String(n))],summary.courses.map(([course,n])=>[
      esc(course),...odsNumbers.map(ods=>{const count=selected.filter(r=>r.courses.includes(course)&&r.ods.includes(ods)).length,rate=Math.round(100*count/n);return `<span title="${count} de ${n} registros" style="display:block;background:rgba(35,99,145,${.04+rate*.007});color:${rate>65?'white':'#17365d'};padding:5px 2px">${rate||'·'}</span>`;})
    ]),'heatmap');
    const territories=Object.entries(history.municipal).filter(([u])=>selected.some(r=>r.unit===u));
    $('territory').innerHTML=table(['Município','Registros','IDHM','Educação','Renda'],territories.map(([u,t])=>[esc(u),String(selected.filter(r=>r.unit===u).length),t.idhm.toFixed(3).replace('.',','),t.educacao.toFixed(3).replace('.',','),t.renda.toFixed(3).replace('.',',')]))+(!territories.length?'<p class="note">O recorte selecionado requer identificação municipal e índice territorial correspondente.</p>':'');
    const features=[['Ano',r=>r.year],['ODS',r=>r.ods.length],['Público previsto',r=>r.expected]];
    $('correlation').innerHTML=table(['',...features.map(f=>f[0])],features.map(([name,left])=>[esc(name),...features.map(([,right])=>{const r=M.spearman(selected,left,right);return (r.value===null?'ND':r.value.toFixed(2).replace('.',','))+`<small>n=${F.format(r.n)}</small>`;})]),'correlation');
    projectRows();
    const params=new URLSearchParams();Object.entries(f).forEach(([k,v])=>{if(v)params.set(k,v);});
    window.history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));
    snapshot={filters:{...f},records:selected,comparisonRecords:M.filter(records,{unit:f.unit,year:f.year}),summary,protocolCoverage,certificateStats,complianceStats,reportPolicy,history,updatedAt:live?.synced_at||null,warning:$('warning').hidden?'':$('warning').textContent};
    $('pdf').disabled=!selected.length||loading;$('dashboard').setAttribute('aria-busy','false');
  }
  async function fetchJSON(url){const response=await fetch(url+(url.includes('?')?'&':'?')+'v='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('Não foi possível atualizar a fonte.');const data=await response.json();if(data.ok===false)throw Error('A fonte informou uma falha.');return data;}
  async function load(){
    if(loading)return;loading=true;$('refresh').disabled=true;$('pdf').disabled=true;
    const hadLive=Boolean(live),errors=[];
    const tasks=[history?Promise.resolve(history):fetchJSON('historico.json'),fetchJSON('../live-data.json'),certificateBaseline?Promise.resolve(certificateBaseline):fetchJSON('certificacoes.json'),fetchJSON('../../certificados/dashboard/live-data.json'),fetchJSON('politica-relatorios.json')];
    const results=await Promise.allSettled(tasks);
    results.forEach((r,i)=>{if(r.status==='fulfilled'){
      if(i===0)history=r.value;
      else if(i===1){if(Array.isArray(r.value.projects?.projects))live=r.value;else errors.push('A atualização de protocolos retornou um formato inválido.');}
      else if(i===4){if(r.value.effective_from===null||typeof r.value.effective_from==='string')reportPolicy=r.value;else errors.push('A política de relatório final retornou um formato inválido.');}
      else if(Array.isArray(r.value.certificates)&&Array.isArray(r.value.events)){if(i===2)certificateBaseline=r.value;else certificateLive=r.value;}
      else errors.push('A fonte de certificação retornou um formato inválido.');
    }else errors.push(['O histórico está temporariamente indisponível.','A sincronização dos protocolos está temporariamente indisponível.','A planilha analítica de certificação está temporariamente indisponível.','A sincronização dos certificados está temporariamente indisponível.','A política de relatório final está temporariamente indisponível.'][i]);});
    loading=false;$('refresh').disabled=false;
    if(!history){$('source').textContent='Falha ao carregar o histórico. Use Atualizar dados para tentar novamente.';$('warning').textContent=errors.join(' ');$('warning').hidden=false;return;}
    if(!live)errors.push('Exibindo o histórico até '+history.as_of+'. Os protocolos posteriores serão incorporados quando a conexão for restabelecida.');
    else{
      const age=Date.now()-new Date(live.synced_at).getTime();
      if(!Number.isFinite(age)||age>20*60*1000)errors.push('A última sincronização disponível está atrasada. Confira a data da fonte antes de emitir o PDF.');
      const count=live.projects.projects.length,known=Number(live.health?.rows);
      if(count>=500||known>count)errors.push(`A fonte pública retornou ${count} de ${Number.isFinite(known)?known:'mais de 500'} protocolos. A cobertura pode estar incompleta.`);
    }
    if(errors.length&&hadLive)errors.push('A data abaixo identifica a última fonte carregada com sucesso.');
    $('warning').textContent=errors.join(' ');$('warning').hidden=!errors.length;
    $('source').textContent=`Histórico até 17/11/2026${live?' · Protocolos sincronizados em '+displayDate(live.synced_at):''}. Consulta automática a cada minuto.`;
    records=M.merge(history,live);populate();render();
  }
  ['unit','course','year'].forEach(id=>$(id).addEventListener('change',()=>{page=0;if(id==='unit')populate();render();}));
  $('clear').onclick=()=>{['unit','course','year'].forEach(id=>$(id).value='');page=0;populate();render();};$('refresh').onclick=load;
  $('previous').onclick=()=>{page--;projectRows();};$('next').onclick=()=>{page++;projectRows();};
  $('pdf').onclick=async()=>{
    if(!snapshot)return;const current=snapshot;$('pdf').disabled=true;$('exportStatus').textContent='Preparando a análise contextual, as comparações por curso e os textos de cada ação. Recortes grandes podem levar alguns instantes…';
    try{
      if(!window.NiceCoursePDF||!window.PDFLib||!window.NiceCourseNarrative)throw Error('O gerador de PDF ainda está carregando. Tente novamente.');
      await new Promise(resolve=>setTimeout(resolve,0));
      const bytes=await window.NiceCoursePDF.build(current),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      const filename='Relatorio_NICE_'+(current.filters.course||'Geral')+'_'+(current.filters.unit||'Todas_unidades');
      a.href=url;a.download=filename.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      $('exportStatus').textContent='PDF gerado com '+F.format(current.summary.total)+' registros do recorte selecionado.';
    }catch(error){$('exportStatus').textContent='Falha ao gerar o PDF. '+error.message;}
    finally{$('pdf').disabled=!selected.length||loading;}
  };
  const params=new URLSearchParams(location.search);
  load().then(()=>{['unit','course','year'].forEach(id=>{if(id==='course')populate();const value=params.get(id);if(value&&[...$(id).options].some(o=>o.value===value))$(id).value=value;});render();});
  setInterval(()=>{if(!document.hidden)load();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
})();
