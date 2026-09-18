/**
 * Inteligência Documental ao vivo para protocolos criados no Sistema NICE.
 * Expõe somente atributos derivados; não publica texto integral, nomes ou e-mails.
 */
function niceDocLive_(){
  const sh=niceControl_(), values=sh.getDataRange().getValues();
  if(values.length<2)return{ok:true,updated_at:new Date().toISOString(),n:0,docs:[],summary:{quality:{Alta:0,Moderada:0,Baixa:0},topics:[],ods:[],strongMatches:0}};
  const h=niceApiMapHeaders_(values[0]),docs=[],quality={Alta:0,Moderada:0,Baixa:0},topicCounts={},odsCounts={};
  let strongMatches=0;
  for(let i=1;i<values.length;i++){
    const row=values[i],id=String(niceApiCell_(row,h,'ID_NICE')||'').trim();
    if(!id)continue;
    const status=String(niceApiCell_(row,h,'STATUS')||'').trim().toUpperCase();
    const course=niceApiPublicText_(niceApiCell_(row,h,'CURSO'))||'Não informado';
    const type=niceApiPublicText_(niceApiCell_(row,h,'TIPO_ACAO'))||'Não informado';
    const title=niceApiPublicText_(niceApiCell_(row,h,'TITULO_ACAO'))||type;
    const date=niceApiCell_(row,h,'DATA_PROTOCOLO')||niceApiCell_(row,h,'DATA_INICIO');
    const d=date instanceof Date?date:new Date(date),year=!isNaN(d)?d.getFullYear():new Date().getFullYear();

    let src={};
    try{
      const sid=String(niceApiCell_(row,h,'PLANILHA_ORIGEM')||'').trim();
      const tab=String(niceApiCell_(row,h,'ABA_ORIGEM')||'').trim();
      const rn=Number(niceApiCell_(row,h,'LINHA_ORIGEM')||0);
      if(sid&&tab&&rn>1){
        const ss=SpreadsheetApp.openById(sid),s=ss.getSheetByName(tab);
        if(s)src=niceRow_(s,rn);
      }
    }catch(_){}

    const target=niceDocValue_(src,['Público-alvo','Público alvo','Publico-alvo','Publico alvo','Público','Publico']);
    const objective=niceDocValue_(src,['Objetivo','Objetivos','Objetivo geral','Objetivo do evento','Objetivo da ação']);
    const desc=niceDocValue_(src,['Descrição/Justificativa','Descrição','Descricao','Justificativa','Descrição do evento','Descrição da ação']);
    const method=niceDocValue_(src,['Metodologia/Resultados Esperados','Metodologia','Resultados esperados','Metodologia e resultados esperados']);
    const participants=niceDocValue_(src,['Número de participantes','Numero de participantes','Público estimado','Publico estimado','Quantidade de participantes','Participantes']);
    const themeField=niceDocValue_(src,['Aborda algum tema transversal? Se sim, marque o campo abaixo','Tema transversal','Temas transversais','Tema']);
    const combined=[title,target,objective,desc,method,themeField,course,type].filter(Boolean).join(' ');

    const q=niceDocCompleteness_({title,target,objective,desc,method,participants,date:niceApiCell_(row,h,'DATA_INICIO')});
    const qb=q>=80?'Alta':q>=60?'Moderada':'Baixa';quality[qb]++;
    const topics=niceDocTopics_(combined,themeField),ods=niceDocOds_(combined,course,topics),kw=niceDocKeywords_(combined),fl=niceDocFlags_({target,objective,desc,method,participants,date:niceApiCell_(row,h,'DATA_INICIO')});
    topics.forEach(x=>topicCounts[x]=(topicCounts[x]||0)+1);ods.forEach(x=>odsCounts[x]=(odsCounts[x]||0)+1);
    const matched=status==='FINALIZADO'||!!niceApiCell_(row,h,'DATA_RELATORIO');if(matched)strongMatches++;
    docs.push({id_nice:id,y:year,c:course,t:type,q,qb,tp:topics,ods,kw,fl,status,matched});
  }
  const sortCounts=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
  return{ok:true,updated_at:new Date().toISOString(),n:docs.length,docs,summary:{quality,topics:sortCounts(topicCounts),ods:sortCounts(odsCounts),strongMatches}};
}
function niceDocValue_(d,aliases){if(!d)return'';try{return niceValue_(d,aliases)}catch(_){return''}}
function niceDocCompleteness_(x){
  const checks=[
    !!String(x.title||'').trim(),
    !!String(x.target||'').trim(),
    !!String(x.objective||'').trim(),
    !!String(x.desc||'').trim(),
    !!String(x.method||'').trim(),
    !!String(x.participants||'').trim(),
    !!x.date
  ];
  return Math.round(100*checks.filter(Boolean).length/checks.length);
}
function niceDocFlags_(x){
  const a=[];if(!String(x.target||'').trim())a.push('Público-alvo não identificado');if(!String(x.objective||'').trim())a.push('Objetivo não identificado');if(!String(x.desc||'').trim())a.push('Descrição/justificativa ausente');if(!String(x.method||'').trim())a.push('Metodologia/resultados esperados ausentes');if(!String(x.participants||'').trim())a.push('Participantes não informados');if(!x.date)a.push('Data da ação não identificada');return a;
}
function niceDocNorm_(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function niceDocTopics_(text,theme){
  const s=niceDocNorm_(text),out=[];
  const rules=[
    ['Educação e Aprendizagem',/educa|ensino|aprendiz|escola|formacao|capacit|pedagog/],
    ['Saúde e Bem-Estar',/saude|medic|enferm|psic|odont|fisioter|nutri|farmac|biomed|terapia ocupacional|fono/],
    ['Direitos Humanos e Cidadania',/direit|cidad|justic|violenc|inclus|desigual|genero|racial|etnic/],
    ['Ciência e Pesquisa',/pesquisa|ciencia|cientif|iniciacao cientifica|metodolog/],
    ['Tecnologia e Inovação',/tecnolog|inovacao|software|comput|inteligencia artificial|sistemas de informacao/],
    ['Meio Ambiente e Sustentabilidade',/ambient|sustent|reciclag|residuo|clima|ecolog/],
    ['Trabalho, Gestão e Empreendedorismo',/empreend|gestao|administr|trabalho|emprego|carreira|negocio/]
  ];
  rules.forEach(([n,re])=>{if(re.test(s))out.push(n)});
  if(theme&&String(theme).trim()&&!out.includes(String(theme).trim()))out.push(String(theme).trim().slice(0,120));
  return out.slice(0,5);
}
function niceDocOds_(text,course,topics){
  const s=niceDocNorm_([text,course,(topics||[]).join(' ')].join(' ')),o=[];
  if(/saude|medic|enferm|psic|odont|fisioter|nutri|farmac|biomed|fono/.test(s))o.push('ODS 3 · Saúde e Bem-Estar');
  if(/educa|ensino|aprendiz|pedagog|capacit/.test(s))o.push('ODS 4 · Educação de Qualidade');
  if(/genero|mulher/.test(s))o.push('ODS 5 · Igualdade de Gênero');
  if(/desigual|inclus|racial|etnic|direitos humanos/.test(s))o.push('ODS 10 · Redução das Desigualdades');
  if(/ambient|sustent|residuo|reciclag/.test(s))o.push('ODS 12 · Consumo e Produção Responsáveis');
  if(/clima|ambient/.test(s))o.push('ODS 13 · Ação Climática');
  if(/direito|justic|cidad|violenc/.test(s))o.push('ODS 16 · Paz, Justiça e Instituições Eficazes');
  if(/trabalho|empreend|gestao|administr|emprego/.test(s))o.push('ODS 8 · Trabalho Decente e Crescimento Econômico');
  return [...new Set(o)].slice(0,5);
}
function niceDocKeywords_(text){
  const stop=new Set('para com uma umas uns dos das de da do e em no na nos nas por ao aos a o as os que se um sua seu suas seus como mais ou entre sobre esta este esse essa ser foi sao são'.split(' '));
  const toks=niceDocNorm_(text).replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(x=>x.length>3&&!stop.has(x)),m={};
  toks.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10).map(x=>x[0]);
}
