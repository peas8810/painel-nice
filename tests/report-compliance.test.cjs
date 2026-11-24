const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../protocolos/relatorios/compliance.js');
const policy={effective_from:'2026-09-01',cancelled_exempt:true};
function row(date='2026-09-01',due='2026-10-01',received=false){return {id:'A',courses:['Farmácia'],original_protocol_date:date,
 protocols:['NICE-2026-00001'],states:{'NICE-2026-00001':'PROTOCOLADO'},closed_protocols:[],
 protocol_details:{'NICE-2026-00001':{data_protocolo:date,prazo_relatorio:due,relatorio_recebido:received,data_relatorio:received?'2026-10-02':'',relatorio_verificacao_status:'confirmado'}}};}
test('importação recente não transforma uma formalização histórica em inadimplência',()=>{
 const r=row('2025-08-01');r.protocol_details['NICE-2026-00001'].data_protocolo='2026-11-17';
 const s=R.analyze([r],policy,'2026-11-24');assert.equal(s.historical,1);assert.equal(s.eligible,0);assert.equal(R.rateText(s),'Não aplicável');
});
test('taxa usa somente o conjunto exigível, com prazo já vencido',()=>{
 const done=row('2026-09-01','2026-10-01',true),pending=row(),future=row('2026-10-01','2026-12-01',true);
 const s=R.analyze([done,pending,future,row('2025-01-01')],policy,'2026-11-24');
 assert.equal(s.eligible,2);assert.equal(s.received,1);assert.equal(s.pending,1);assert.equal(s.notDue,1);assert.equal(s.rate,50);assert.equal(s.total,4);
});
test('recebimento não apurado não vira não entrega e nem taxa zero',()=>{
 const r=row();r.protocol_details['NICE-2026-00001'].relatorio_recebido=null;r.closed_protocols=['NICE-2026-00001'];
 const s=R.analyze([r],policy,'2026-11-24');assert.equal(s.unknown,1);assert.equal(s.pending,0);assert.equal(s.rate,null);assert.equal(s.documentaryReceived,0);assert.equal(s.administrativeClosed,1);
});
test('falta de marco, data ou prazo exige verificação sem cobrança presumida',()=>{
 assert.equal(R.analyze([row()],{},'2026-11-24').rateLabel,'Marco pendente');
 const unknown=row('');unknown.year=2026;unknown.protocol_details={};
 assert.equal(R.analyze([unknown],policy,'2026-11-24').unclassified,1);
 assert.equal(R.analyze([row('2026-09-01','')],policy,'2026-11-24').missingDeadline,1);
});
test('duplicidade de IDs, cancelamento e prazo no dia não ampliam o denominador',()=>{
 const r=row();r.protocols.push('NICE-2026-00002');r.protocol_details['NICE-2026-00002']={...r.protocol_details['NICE-2026-00001']};
 const cancelled=row();cancelled.states={'NICE-2026-00001':'CANCELADO'};
 const s=R.analyze([r,cancelled,row('2026-09-01','2026-11-24')],policy,'2026-11-24');assert.equal(s.eligible,1);assert.equal(s.excluded,1);assert.equal(s.notDue,1);
});
test('prazos conflitantes e fonte desatualizada não produzem indicador enganoso',()=>{
 const r=row();r.protocols.push('NICE-2026-00002');r.protocol_details['NICE-2026-00002']={prazo_relatorio:'2026-10-02'};
 assert.equal(R.analyze([r],policy,'2026-11-24').missingDeadline,1);
 const stale=row();stale.protocol_details['NICE-2026-00001'].relatorio_verificacao_status='desatualizado';
 assert.equal(R.analyze([stale],policy,'2026-11-24').unknown,1);
});
test('data local é validada e não é inferida apenas pelo ano',()=>{
 assert.equal(R.day('2026-02-30'),null);assert.equal(R.day('2026-11-24T01:00:00Z'),'2026-11-23');
 assert.equal(R.originalDay({year:2026}),null);
});
