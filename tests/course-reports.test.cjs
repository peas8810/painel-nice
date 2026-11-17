const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const M=require('../protocolos/relatorios/model.js');
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
  const base={id:'NICE-2026-00091',curso:'Farmácia',unidade:'Teófilo Otoni',data_protocolo:'2026-11-18T12:00:00Z',tema:'Orientação em saúde',responsavel:'Pessoa',status:'PROTOCOLADO'};
  const records=M.merge(history,{projects:{projects:[base,{...base,id:'NICE-2026-00092',status:'FINALIZADO'}]}});
  assert.equal(records.length,history.records.length+1);
  assert.deepEqual(records.at(-1).protocols,['NICE-2026-00091','NICE-2026-00092']);
  assert.deepEqual(records.at(-1).closed_protocols,['NICE-2026-00092']);
});
test('novo identificador de uma origem conhecida se vincula ao histórico',()=>{
  const extra={...live.projects.projects[0],id:'NICE-2026-00091'};
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
test('ODS e correlação tratam dados ausentes e variância nula',()=>{
  assert.deepEqual(M.ods({ods:'ODS 3; ODS 4'}),[3,4]);
  assert.equal(M.spearman([{a:1,b:2},{a:2,b:3},{a:3,b:4}],r=>r.a,r=>r.b).value,1);
  assert.equal(M.spearman([{a:1,b:2},{a:1,b:3},{a:1,b:4}],r=>r.a,r=>r.b).value,null);
  assert.equal(M.spearman([{a:null,b:2},{a:3,b:null}],r=>r.a,r=>r.b).n,0);
});
test('a base pública contém somente os campos analíticos permitidos',()=>{
  const allowed=['id','year','courses','unit','type','ods','expected','protocols','closed_protocols','placeholder'];
  assert(history.records.every(row=>Object.keys(row).every(k=>allowed.includes(k))));
  assert(!fs.readFileSync('protocolos/relatorios/historico.json','utf8').includes('@'));
});
