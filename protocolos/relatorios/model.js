(function(root){
  'use strict';
  const clean=value=>String(value??'').trim().replace(/\s+/g,' ');
  const norm=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const aliases={
    'Administração':['administracao'],'Agronomia':['agronom'],'Arquitetura e Urbanismo':['arquitet','arqurb'],
    'Ciências Contábeis':['contabeis','contabil'],'Direito':['direito'],'Educação Física':['educacao fisica'],
    'Enfermagem':['enfermagem','enfrmagem','enferamgem'],'Engenharia Civil':['engenharia civil','eng. civil'],
    'Estética e Cosmética':['estetica','cosmetica'],'Farmácia':['farmacia','famacia'],'Fisioterapia':['fisioterapia'],
    'Fonoaudiologia':['fonoaudiologia','fono audiologia'],'Gestão Pública':['gestao publica'],'Medicina':['medicina','meducina'],
    'Nutrição':['nutricao'],'Odontologia':['odontologia','odotologia'],'Pedagogia':['pedagog'],'Psicologia':['psicologia','psiciologia'],
    'Serviço Social':['servico social','servicos social'],'Sistemas de Informação':['sistemas de informacao','sitemas de informacao'],
    'Terapia Ocupacional':['terapia ocupacional'],'Endodontia':['endodontia'],
    'Técnico em Vendas':['tecnico em vendas'],'Técnico em Análises Clínicas':['tecnico de analises clinicas','tecnico em analises clinicas']
  };
  function courses(value){
    const text=norm(value);
    if(!text||['nao informado','nao se aplica'].includes(text))return ['Curso não identificado'];
    if(/^(todos|todas)\b/.test(text)||text.includes('multicursos')||text==='institucional')return ['Institucional e multicursos'];
    const found=Object.entries(aliases).filter(([,terms])=>terms.some(term=>new RegExp('(?:^|[^a-z])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(text))).map(([name])=>name);
    return found.length?found:[clean(value)];
  }
  function unit(value){
    const text=norm(value);
    if(!text||['sim','nao','nao informado','nao identificado'].includes(text))return 'Unidade não identificada';
    const names=['Teófilo Otoni','Almenara','Aimorés','Guanhães'];
    return names.find(name=>norm(name)===text)||clean(value);
  }
  const rules={1:['pobreza','protecao social'],2:['nutric','aliment','agricultura','horta'],3:['saude','psicolog','medica','odontolog','fisioter','fono','enferm','prevencao'],4:['educa','escola','aprendiz','formacao','capacit','ensino'],5:['genero','mulher','femin'],6:['saneamento','agua potavel','abastecimento'],7:['energia renovavel','eficiencia energetica'],8:['trabalho','carreira','curriculo','empreendedor'],9:['tecnolog','robotica','inteligencia artificial','digital'],10:['inclusao','acessibilidade','desigualdade','direitos humanos','etnico','racial'],11:['urbano','habitacao','mobilidade'],12:['recicla','residuo','sustentabilidade','educacao ambiental'],13:['climatic','aquecimento global'],14:['marinho','ocean'],15:['biodiversidade','reflorest','conservacao do solo'],16:['justica','juridic','direitos humanos','cidadania'],17:['parceria','cooperacao institucional']};
  function ods(project){
    const reported=Array.from(clean(project.ods).matchAll(/(?:ODS\s*)?(\d{1,2})(?:\.\d+)?/gi),m=>Number(m[1])).filter(n=>n>=1&&n<=17);
    if(reported.length)return [...new Set(reported)].sort((a,b)=>a-b);
    const text=norm([project.tema,project.titulo].join(' '));
    return Object.entries(rules).filter(([,terms])=>terms.some(term=>text.includes(term))).map(([n])=>Number(n));
  }
  function fingerprint(p){return [p.data_protocolo,p.curso,p.unidade,p.tema||p.titulo,p.responsavel].map(norm).join('|');}
  function year(value){const d=new Date(value);return Number.isNaN(d.getTime())?null:Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Sao_Paulo'}).format(d));}
  function merge(history,live){
    const records=(history.records||[]).map(row=>({...row,courses:[...row.courses],ods:[...row.ods],protocols:[...row.protocols],closed_protocols:[...row.closed_protocols],states:{},titles:[],live:false}));
    const byProtocol=new Map(records.flatMap(row=>row.protocols.map(id=>[id,row])));
    const byFingerprint=new Map();
    const projects=live?.projects?.projects||[];
    // Establish known origins before processing a newly created duplicate protocol.
    projects.forEach(p=>{if(byProtocol.has(p.id))byFingerprint.set(fingerprint(p),byProtocol.get(p.id));});
    projects.forEach(p=>{
      if(!/^NICE-\d{4}-\d{5}$/.test(p.id||''))return;
      let row=byProtocol.get(p.id)||byFingerprint.get(fingerprint(p));
      if(!row){
        row={id:p.id,year:year(p.data_protocolo),courses:courses(p.curso),unit:unit(p.unidade),type:clean(p.titulo),ods:ods(p),expected:null,protocols:[],closed_protocols:[],placeholder:false,states:{},titles:[],live:true};
        records.push(row);
      }
      row.live=true;
      const incomingCourses=courses(p.curso);
      // Legacy form fields sometimes contain an event name instead of a course.
      // Keep the reconciled category until an identifiable course is provided.
      const unclassifiedHistory=/^ACAO-/.test(row.id)&&row.courses.some(c=>['Curso não padronizado','Institucional e multicursos','Curso não identificado'].includes(c));
      if(!row.placeholder&&(!unclassifiedHistory||incomingCourses.every(c=>Object.hasOwn(aliases,c))))row.courses=incomingCourses;
      const incomingUnit=unit(p.unidade);
      if(incomingUnit!=='Unidade não identificada'||!row.unit)row.unit=incomingUnit;
      row.year=year(p.data_protocolo)||row.year;
      row.protocols=[...new Set([...row.protocols,p.id])];row.states[p.id]=p.status||'PROTOCOLADO';
      row.closed_protocols=row.closed_protocols.filter(id=>id!==p.id);
      if(p.status==='FINALIZADO')row.closed_protocols.push(p.id);
      const title=clean(p.tema||p.titulo).replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g,'').slice(0,220);
      if(title&&!row.titles.includes(title))row.titles.push(title);
      const expected=Number(p.publico_estimado);
      // The current API uses zero both for missing data and an empty estimate.
      if(Number.isFinite(expected)&&Number.isInteger(expected)&&expected>0)row.expected=expected;
      if(clean(p.ods))row.ods=ods(p);
      row.ods_origin=clean(p.ods)?'Informadas no cadastro':'Sugeridas pelo texto';
      byProtocol.set(p.id,row);byFingerprint.set(fingerprint(p),row);
    });
    return records;
  }
  function filter(records,f={}){
    return records.filter(r=>(!f.unit||r.unit===f.unit)&&(!f.course||r.courses.includes(f.course))&&(!f.year||String(r.year)===String(f.year)));
  }
  function count(values){return [...values.reduce((map,v)=>map.set(v,(map.get(v)||0)+1),new Map())].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));}
  function summarize(records){
    const estimated=records.filter(r=>Number.isFinite(r.expected));
    return {total:records.length,protocols:new Set(records.flatMap(r=>r.protocols)).size,closed:records.filter(r=>r.closed_protocols.length>0).length,
      expected:estimated.reduce((n,r)=>n+r.expected,0),expectedN:estimated.length,courses:count(records.flatMap(r=>r.courses)),units:count(records.map(r=>r.unit)),
      years:count(records.map(r=>String(r.year||'Sem data'))).sort((a,b)=>a[0].localeCompare(b[0])),ods:count(records.flatMap(r=>r.ods.map(String))),live:records.filter(r=>r.protocols.length).length};
  }
  function ranks(values){
    const order=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value),result=[];
    for(let start=0;start<order.length;){let end=start+1;while(end<order.length&&order[end].value===order[start].value)end++;const rank=(start+1+end)/2;for(let i=start;i<end;i++)result[order[i].index]=rank;start=end;}
    return result;
  }
  function spearman(rows,left,right){
    const pairs=rows.map(r=>[left(r),right(r)]).filter(v=>v.every(Number.isFinite)),n=pairs.length;
    if(n<3)return {value:null,n};
    const a=ranks(pairs.map(v=>v[0])),b=ranks(pairs.map(v=>v[1])),mean=(n+1)/2;
    let covariance=0,varianceA=0,varianceB=0;
    for(let i=0;i<n;i++){const da=a[i]-mean,db=b[i]-mean;covariance+=da*db;varianceA+=da*da;varianceB+=db*db;}
    return {value:varianceA&&varianceB?covariance/Math.sqrt(varianceA*varianceB):null,n};
  }
  const api={norm,courses,unit,ods,merge,filter,summarize,spearman};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.NiceCourseReports=api;
})(typeof window!=='undefined'?window:globalThis);
