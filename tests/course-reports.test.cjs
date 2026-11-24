const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const M=require('../protocolos/relatorios/model.js');
const N=require('../protocolos/relatorios/narrative.js');
const history=JSON.parse(fs.readFileSync('protocolos/relatorios/historico.json','utf8'));
const fixtureRecord=history.records.find(r=>r.protocols.length>1&&r.unit==='Teófilo Otoni'&&r.courses.includes('Farmácia'));
const live={projects:{projects:fixtureRecord.protocols.map((id,i)=>({id,curso:'Farmácia',unidade:'Teófilo Otoni',data_protocolo:'2026-10-01T12:00:00Z',tema:'Orientação em saúde',responsavel:'Pessoa',status:i===0?'FINALIZADO':'PROTOCOLADO'}))}};
test('reconcilia protocolos sem duplicar o histórico',()=>{
  const records=M.merge(history,live),summary=M.summarize(records);
  assert.equal(records.length,history.records.length);
  assert.equal(summary.protocols,new Set(history.records.flatMap(r=>r.protocols)).size);
  assert.equal(records.find(r=>r.id===fixtureRecord.id).states[fixtureRecord.protocols[0]],'FINALIZADO');
});
test('novos identificadores duplicados representam uma formalização',()=>{
  const base={id:'NICE-2099-90001',curso:'Farmácia',unidade:'Teófilo Otoni',data_protocolo:'2026-11-18T12:00:00Z',tema:'Orientação em saúde',responsavel:'Pessoa',status:'PROTOCOLADO'};
  const records=M.merge(history,{projects:{projects:[base,{...base,id:'NICE-2099-90002',status:'FINALIZADO'}]}});
  assert.equal(records.length,history.records.length+1);
  assert.deepEqual(records.at(-1).protocols,['NICE-2099-90001','NICE-2099-90002']);
  assert.deepEqual(records.at(-1).closed_protocols,['NICE-2099-90002']);
});
test('novo identificador de uma origem conhecida se vincula ao histórico',()=>{
  const extra={...live.projects.projects[0],id:'NICE-2099-90001'};
  assert.equal(M.merge(history,{projects:{projects:[extra,...live.projects.projects]}}).length,history.records.length);
});
test('filtros combinam campus curso e ano',()=>{
  const records=M.merge(history,live),rows=M.filter(records,{unit:'Teófilo Otoni',course:'Farmácia',year:'2026'});
  assert.equal(rows.length,4);
  assert(rows.every(r=>r.unit==='Teófilo Otoni'&&r.courses.includes('Farmácia')&&r.year===2026));
  assert.equal(M.filter(records,{unit:'Guanhães',course:'Medicina'}).length,0);
});
test('mudança de status substitui a situação anterior',()=>{
  const target=live.projects.projects.find(p=>p.status==='FINALIZADO');
  const updated=JSON.parse(JSON.stringify(live));updated.projects.projects.find(p=>p.id===target.id).status='EM_ANALISE';
  const row=M.merge(history,updated).find(r=>r.protocols.includes(target.id));
  assert(!row.closed_protocols.includes(target.id));assert.equal(row.states[target.id],'EM_ANALISE');
});
test('normalização preserva novos cursos e rejeita Sim e Não como municípios',()=>{
  assert.deepEqual(M.courses('Fono Audiologia e Terapia Ocupacional'),['Fonoaudiologia','Terapia Ocupacional']);
  assert.deepEqual(M.courses('Biomedicina'),['Biomedicina']);
  assert.deepEqual(M.courses('Engenharia Mecânica'),['Engenharia Mecânica']);
  assert.equal(M.unit('Não'),'Unidade não identificada');assert.equal(M.unit('Sim'),'Unidade não identificada');
});
test('importação com unidade ausente preserva o contexto territorial já reconciliado',()=>{
  const h={records:[{id:'ACAO-1',courses:['Farmácia'],unit:'EaD e polos sem município',ods:[],protocols:['NICE-2025-00001'],closed_protocols:[]}]};
  const r=M.merge(h,{projects:{projects:[{id:'NICE-2025-00001',curso:'Farmácia',unidade:'',data_protocolo:'2025-09-01'}]}});
  assert.equal(r.length,1);assert.equal(r[0].unit,'EaD e polos sem município');
});
test('título lançado como curso no formulário antigo não cria categoria de curso no relatório',()=>{
  const h={records:[{id:'ACAO-1',courses:['Curso não padronizado'],unit:'Unidade não identificada',ods:[],protocols:['NICE-2025-00001'],closed_protocols:[]}]};
  const project={id:'NICE-2025-00001',curso:'Calendário Nacional de Vacinação',data_protocolo:'2025-09-01'};
  assert.deepEqual(M.merge(h,{projects:{projects:[project]}})[0].courses,['Curso não padronizado']);
  assert.deepEqual(M.merge(h,{projects:{projects:[{...project,curso:'Enfermagem'}]}})[0].courses,['Enfermagem']);
});
test('ODS e correlação tratam dados ausentes e variância nula',()=>{
  assert.deepEqual(M.ods({ods:'ODS 3; ODS 4'}),[3,4]);
  assert.equal(M.spearman([{a:1,b:2},{a:2,b:3},{a:3,b:4}],r=>r.a,r=>r.b).value,1);
  assert.equal(M.spearman([{a:1,b:2},{a:1,b:3},{a:1,b:4}],r=>r.a,r=>r.b).value,null);
  assert.equal(M.spearman([{a:null,b:2},{a:3,b:null}],r=>r.a,r=>r.b).n,0);
});
test('a base pública contém somente os campos analíticos permitidos',()=>{
  const allowed=['id','year','courses','unit','type','ods','expected','protocols','closed_protocols','placeholder','context','original_protocol_date'];
  assert(history.records.every(row=>Object.keys(row).every(k=>allowed.includes(k))));
  assert(!fs.readFileSync('protocolos/relatorios/historico.json','utf8').includes('@'));
  assert(history.records.every(r=>Object.entries(r.context||{}).every(([key,values])=>['themes','formats','audiences'].includes(key)&&values.every(id=>N[key][id]))));
});
const action=(id,courses,expected,ods=[],year=2026)=>({id,courses,expected,ods,year,unit:'Teófilo Otoni',protocols:[],closed_protocols:[],titles:[],type:'Palestra'});
const comparison=[action('a',['Farmácia','Nutrição'],10,[3]),action('b',['Farmácia'],30,[3,4]),action('c',['Nutrição'],null,[],2025),action('d',['Direito'],100,[16])];
test('comparação mantém denominador distinto e mediana ignora ausências',()=>{
  const farm=N.statistics('Farmácia',comparison),nutri=N.statistics('Nutrição',comparison);
  assert.equal(farm.share,.5);assert.equal(farm.median,20);assert.equal(farm.s.expected,40);
  assert.equal(nutri.s.expectedN,1);assert.equal(nutri.median,10);
  assert.equal(farm.position,nutri.position);assert.equal(N.statistics('Direito',comparison).position,3);
  assert.equal(N.statistics('Novo curso',comparison).median,null);
});
test('interseção multicursos usa união sem duplicar a ação compartilhada',()=>{
  const p=N.peers('Farmácia',comparison);
  assert.equal(p.length,1);assert.equal(p[0].common,1);assert.equal(p[0].union,3);assert.equal(p[0].jaccard,1/3);
});
test('relatório filtrado compara o curso com a base do mesmo campus e ano',()=>{
  const records=M.filter(comparison,{course:'Farmácia'}),snapshot={records,comparisonRecords:comparison,summary:M.summarize(records),filters:{course:'Farmácia'},history};
  assert.deepEqual(N.courseNames(snapshot),['Farmácia']);
  const prose=N.courseAnalysis('Farmácia',snapshot).join(' ');
  assert(prose.includes('50%'));assert(prose.includes('Nutrição'));assert(prose.includes('mediana é 20'));
  assert(prose.includes('ND (n=2'));assert(!prose.includes('2026 apresenta 2 registros e Sem data'));
});
test('ação sem estimativa e registro de teste não recebem benefício inventado',()=>{
  const prose=N.actionAnalysis(comparison[2],comparison,history).join(' ');
  assert(prose.includes('ausência de público previsto'));assert(!prose.includes('prevê 0 participações'));
  const testProse=N.actionAnalysis({...comparison[0],placeholder:true},comparison,history).join(' ');
  assert(testProse.includes('indício de teste'));assert(!testProse.includes('contribuição potencial'));
});
test('análise individual explicita a base da participação prevista e preserva identificador',()=>{
  const prose=N.actionAnalysis(comparison[0],comparison.filter(r=>r.courses.includes('Farmácia')),history,'Farmácia').join(' ');
  assert(prose.includes('formalização a,'));assert(prose.includes('25%'));assert(prose.includes('2 formalizações de Farmácia'));
});
test('contextualização publica apenas categorias controladas e prioriza o tema do título',()=>{
  const context=N.classify({title:'Uso de medicamentos',description:'Cultura, educação ambiental, alimentação e saúde bucal',method:'Palestra com roda de conversa',audience:'Pessoas idosas. Contato privado pessoa@example.org'});
  assert.equal(context.themes[0],'medicine');assert(context.formats.includes('lecture'));assert(context.audiences.includes('elderly'));
  assert(!JSON.stringify(context).includes('example.org'));
  const row={...comparison[0],context};const prose=N.actionAnalysis(row,comparison,history).join(' ');
  assert(prose.includes('Uso de medicamentos'));assert(prose.includes('Pessoas idosas'));
});
