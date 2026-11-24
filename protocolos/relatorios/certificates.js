(function(root){
  'use strict';
  const M=root.NiceCourseReports||(typeof require==='function'?require('./model.js'):null);
  const text=v=>String(v??'').trim(),id=v=>/^\d+$/.test(text(v))?text(v).padStart(4,'0'):text(v);
  const isAlfa=certificate=>M.norm(certificate.institution).replace(/[\s-]+/g,'')==='alfaunipac';
  function normalize(source,bookCodes=new Set()){
    const unique=new Map();
    for(const c of source?.certificates||[]){
      const code=text(c.code||c.codigo).toUpperCase();if(!code)continue;
      const date=new Date(c.emitido_em),year=Number.isFinite(c.year)?c.year:Number.isNaN(date.getTime())?null:date.getUTCFullYear();
      const value={code,event_id:id(c.event_id||c.evento_id),status:text(c.status).toUpperCase(),year,
        registered:Boolean(c.registered||c.registro_digital||bookCodes.has(code)),institution:text(c.institution||c.instituicao_emissora)||'Não informada'};
      const previous=unique.get(code);
      if(previous?.registered)value.registered=true;
      if(!previous||value.status==='REVOGADO')unique.set(code,value);
      else if(value.registered)previous.registered=true;
    }
    const events=new Map((source?.events||[]).map(e=>[id(e.id),{id:id(e.id),protocol:text(e.protocol||e.protocolo_nice).toUpperCase(),title:text(e.title||e.titulo),unit:text(e.unit||e.campus_unidade)}]));
    return {certificates:[...unique.values()],events:[...events.values()]};
  }
  function resolve(baseline,live){
    if(!baseline&&!live)return null;
    const base=normalize(baseline),knownBook=new Set([...base.certificates.filter(c=>c.registered).map(c=>c.code),...(baseline?.book_unmatched_codes||[])]),current=normalize(live,knownBook);
    const baseTime=Date.parse(baseline?.updated_at),liveTime=Date.parse(live?.updated_at||live?.synced_at);
    const useLive=Boolean(live?.ok&&Array.isArray(live.certificates)&&current.certificates.length>=base.certificates.length&&Number.isFinite(liveTime)&&(!baseline||liveTime>=baseTime));
    const chosen=useLive?current:base;
    const alfa=base.certificates.filter(isAlfa),alfaEvents=new Set(alfa.map(c=>c.event_id));
    // A newer cache may omit an older event, but existing explicit links remain useful.
    const events=new Map(base.events.map(e=>[e.id,e]));chosen.events.forEach(e=>events.set(e.id,e));
    return {...chosen,events:[...events.values()],updatedAt:useLive?(live.updated_at||live.synced_at):baseline?.updated_at,
      source:useLive?'Fonte pública de certificação sincronizada':'Planilha enviada',
      snapshot:{responses:baseline?.protocol_source_check?.responses??null,identifiers:baseline?.protocol_source_check?.identifiers??null,
        certificates:baseline?base.certificates.length:null,bookRecords:baseline?.source_book_records??null,bookUnmatched:baseline?(baseline.book_unmatched_codes||[]).length:null,events:baseline?base.events.length:null,inventory:baseline?.inventory||[],
        alfaCertificates:baseline?alfa.length:null,alfaBookRecords:baseline?alfa.filter(c=>c.registered).length:null,alfaEvents:baseline?base.events.filter(e=>alfaEvents.has(e.id)).length:null},
      warning:live&&!useLive?'A fonte de certificação disponível é anterior ou incompleta; foi preservada a cobertura da planilha enviada.':''};
  }
  function counts(items){
    return {total:items.length,valid:items.filter(c=>['ENVIADO','ATIVO'].includes(c.status)).length,
      revoked:items.filter(c=>c.status==='REVOGADO').length,registered:items.filter(c=>c.registered).length};
  }
  function analyze(dataset,selected,allRecords){
    if(!dataset)return null;
    const certificates=dataset.certificates.filter(isAlfa).map(c=>({...c,institution:'AlfaUnipac'}));
    const eventIds=new Set(certificates.map(c=>c.event_id));
    const byProtocol=new Map(allRecords.flatMap(r=>r.protocols.map(p=>[p,r]))),selectedIds=new Set(selected.map(r=>r.id));
    const byEvent=new Map(dataset.events.map(e=>[e.id,e])),byAction=new Map(),pending=[];
    let globalLinked=0;
    for(const cert of certificates){
      const event=byEvent.get(cert.event_id),canonical=/^NICE-\d{4}-\d{5}$/.test(event?.protocol||''),row=canonical?byProtocol.get(event.protocol):null;
      if(!row){pending.push(cert);continue;}
      globalLinked++;if(!selectedIds.has(row.id))continue;
      if(!byAction.has(row.id))byAction.set(row.id,{row,items:[],events:new Set()});
      const a=byAction.get(row.id);a.items.push(cert);a.events.add(event.id);
    }
    const actions=[...byAction.values()].map(a=>({...counts(a.items),id:a.row.id,protocols:a.row.protocols,courses:a.row.courses,unit:a.row.unit,expected:a.row.expected,events:[...a.events]}));
    const scoped=actions.reduce((sum,a)=>{for(const key of ['total','valid','revoked','registered'])sum[key]+=a[key];return sum;},{total:0,valid:0,revoked:0,registered:0});
    const courses=M.summarize(selected).courses.map(([course])=>{
      const own=actions.filter(a=>a.courses.includes(course));
      return {course,actions:own.length,...own.reduce((sum,a)=>{for(const key of ['total','valid','revoked','registered'])sum[key]+=a[key];return sum;},{total:0,valid:0,revoked:0,registered:0}),
        correlation:M.spearman(own,a=>a.expected,a=>a.valid)};
    });
    const institutions=certificates.length?[['AlfaUnipac',certificates.length]]:[];
    const inventoryCounts={'CERT_EMISSOES':dataset.snapshot.alfaCertificates,'CERT_EVENTOS':dataset.snapshot.alfaEvents,'CERT_LIVRO_REGISTROS':dataset.snapshot.alfaBookRecords};
    const inventory=dataset.snapshot.inventory.filter(s=>['Respostas ao formulário 1','CONTROLE_NICE',...Object.keys(inventoryCounts)].includes(s.sheet)).map(s=>({...s,rows:Object.hasOwn(inventoryCounts,s.sheet)?inventoryCounts[s.sheet]:s.rows,use:Object.hasOwn(inventoryCounts,s.sheet)?'Somente registros vinculados à instituição AlfaUnipac':s.use}));
    const snapshot={...dataset.snapshot,certificates:dataset.snapshot.alfaCertificates,bookRecords:dataset.snapshot.alfaBookRecords,bookUnmatched:null,inventory};
    return {source:dataset.source,updatedAt:dataset.updatedAt,warning:dataset.warning,snapshot,
      global:{...counts(certificates),events:dataset.events.filter(e=>eventIds.has(e.id)).length,linked:globalLinked,unlinked:pending.length},
      scope:{...scoped,actions:actions.length,events:new Set(actions.flatMap(a=>a.events)).size},
      actions,courses,institutions,correlation:M.spearman(actions,a=>a.expected,a=>a.valid)};
  }
  function paragraphs(stats){
    if(!stats)return ['A fonte de certificação está indisponível. Indicadores de certificados permanecem ND e os cálculos de formalizações utilizam a base de protocolos.'];
    const F=new Intl.NumberFormat('pt-BR'),g=stats.global,s=stats.scope,c=stats.correlation;
    return [
      `A base de certificação da AlfaUnipac contém ${F.format(g.total)} códigos distintos: ${F.format(g.valid)} com situação ENVIADO ou ATIVO e ${F.format(g.revoked)} com situação REVOGADO. Há ${F.format(g.registered)} certificados com referência de registro no Livro Digital. Todos os cálculos de certificação deste relatório consideram exclusivamente a instituição AlfaUnipac. Livro e backup não são somados como novos certificados ou ações.`,
      `A vinculação exige protocolo NICE completo e existente. Na base completa, ${F.format(g.linked)} emissões possuem esse vínculo e ${F.format(g.unlinked)} permanecem sem atribuição precisa a uma formalização. `+(s.total===0&&g.unlinked>0?'Nos filtros deste relatório, a quantidade de emissões não foi apurada: a vinculação documental está pendente. A ausência de vínculo confirmado não significa que o curso não certificou.':`Nos filtros deste relatório, há vínculo preciso em ${F.format(s.actions)} ${s.actions===1?'formalização':'formalizações'} e ${F.format(s.events)} ${s.events===1?'evento':'eventos'} de certificação, com ${F.format(s.total)} emissões confirmadas: ${F.format(s.valid)} com situação ENVIADO ou ATIVO e ${F.format(s.revoked)} com situação REVOGADO.`)+' As emissões sem vínculo ficam na análise geral da fonte e não são distribuídas artificialmente entre cursos.',
      `A certificação constitui evidência documental de emissão. Ela não corresponde automaticamente a participantes únicos, à população atendida ou a ganhos sociais medidos. Um titular pode receber vários certificados; papéis como palestrante e organizador também podem ser certificados. Por isso, o público previsto permanece separado e não é substituído ou acrescido do número de certificados. Ações multicursos compartilham a mesma evidência e os totais dos cursos podem se sobrepor.`,
      stats.snapshot.bookRecords===null?'O inventário do arquivo enviado está indisponível; as emissões desta análise utilizam apenas a fonte pública identificada.':`No arquivo enviado, ${F.format(stats.snapshot.bookRecords)} emissões da AlfaUnipac possuem referência no Livro Digital. Registros de outras instituições ou sem instituição emissora identificada ficam fora dos totais e das análises de certificação deste relatório.`,
      c.value===null?`A associação entre público previsto e certificações vigentes por formalização permanece ND (n=${c.n} pares válidos), por dados insuficientes ou ausência de variação.`:`A correlação de Spearman entre público previsto e certificações vigentes por formalização é ${c.value.toFixed(3).replace('.',',')} (n=${c.n} pares válidos). O resultado relaciona planejamento e documentação, sem medir benefício comunitário ou significância estatística; a amostra e a cobertura dos vínculos devem acompanhar a interpretação.`
    ];
  }
  function displayScope(stats){
    if(!stats)return {total:null,valid:null,registered:null,pending:true};
    const pending=stats.scope.total===0&&stats.global.unlinked>0;
    return {total:pending?null:stats.scope.total,valid:pending?null:stats.scope.valid,registered:pending?null:stats.scope.registered,pending};
  }
  const api={normalize,resolve,analyze,paragraphs,displayScope};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.NiceCourseCertificates=api;
})(typeof window!=='undefined'?window:globalThis);
