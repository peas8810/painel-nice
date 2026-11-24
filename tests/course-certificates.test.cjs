const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../protocolos/relatorios/model.js'),C=require('../protocolos/relatorios/certificates.js');
const action=(id,protocols,courses=['Farmácia'],expected=20)=>({id,protocols,courses,expected,unit:'Teófilo Otoni',ods:[],closed_protocols:[],year:2026});
const rows=[action('a',['NICE-2026-00001','NICE-2026-00002'],['Farmácia','Direito']),action('b',['NICE-2026-00003'],['Medicina'])];
const baseline={updated_at:'2026-11-17T20:00:00Z',source_book_records:2,protocol_source_check:{responses:329,identifiers:368},events:[{id:'1',protocol:'NICE-2026-00001'},{id:'2',protocol:'NICE 0001'},{id:'3',protocol:'NICE-2026-99999'}],certificates:[
 {code:'A',event_id:'1',status:'ENVIADO',registered:true},{code:'A',event_id:'1',status:'ENVIADO'},
 {code:'B',event_id:'1',status:'REVOGADO',registered:true},{code:'C',event_id:'2',status:'ATIVO'},
 {code:'D',event_id:'3',status:'ATIVO'},{code:'E',event_id:'',status:'ATIVO'}]};
baseline.certificates.forEach(c=>c.institution='AlfaUnipac');
test('deduplica códigos e não soma o livro como novas emissões',()=>{
 const d=C.resolve(baseline,null),s=C.analyze(d,rows,rows);
 assert.equal(s.global.total,5);assert.equal(s.global.valid,4);assert.equal(s.global.revoked,1);assert.equal(s.global.registered,2);
 assert.equal(s.scope.total,2);assert.equal(s.scope.actions,1);assert.equal(s.global.unlinked,3);
 assert.equal(s.actions[0].protocols.length,2);
});
test('curso e unidade só recebem emissões via protocolo completo existente',()=>{
 const d=C.resolve(baseline,null),selected=M.filter(rows,{course:'Medicina'}),s=C.analyze(d,selected,rows);
 assert.equal(s.scope.total,0);assert.equal(s.global.total,5);
 const both=C.analyze(d,rows,rows);assert.equal(both.courses.find(c=>c.course==='Farmácia').valid,1);assert.equal(both.courses.find(c=>c.course==='Direito').valid,1);
 assert.equal(both.scope.valid,1); // shared course evidence is not added twice globally
 assert.equal(C.displayScope(s).total,null);assert.equal(C.displayScope(s).pending,true);
});
test('zero emissões só é apresentado como zero quando não há vínculos pendentes na fonte',()=>{
 const source={...baseline,certificates:[]};const s=C.analyze(C.resolve(source,null),rows,rows);
 assert.equal(C.displayScope(s).total,0);assert.equal(C.displayScope(s).pending,false);
});
test('cache mais novo incompleto não reduz a cobertura do arquivo',()=>{
 const d=C.resolve(baseline,{ok:true,updated_at:'2026-11-17T21:00:00Z',certificates:[],events:[]});
 assert.equal(d.certificates.length,5);assert.equal(d.source,'Planilha enviada');assert(d.warning);
});
test('cache novo atualiza revogação e mantém referência do livro ausente no cache',()=>{
 const live={ok:true,updated_at:'2026-11-17T21:00:00Z',certificates:[{codigo:'A',evento_id:'1',status:'REVOGADO',instituicao_emissora:'AlfaUnipac'},...baseline.certificates.filter(c=>c.code!=='A')],events:[]};
 const s=C.analyze(C.resolve(baseline,live),rows,rows);
 assert.equal(s.global.revoked,2);assert.equal(s.global.registered,2);assert.equal(s.scope.total,2);
});
test('amostras insuficientes ficam ND e a fonte ausente não vira zero',()=>{
 assert.equal(C.resolve(null,null),null);assert.equal(C.analyze(null,rows,rows),null);
 const s=C.analyze(C.resolve(baseline,null),rows,rows);assert.equal(s.correlation.value,null);assert.equal(s.correlation.n,1);
});
test('somente AlfaUnipac entra nos totais e vínculos, inclusive com protocolo compartilhado',()=>{
 const extra={...baseline,certificates:[...baseline.certificates,
  {code:'OTHER',event_id:'1',status:'ATIVO',institution:'DIX Academy',registered:true},
  {code:'UNKNOWN',event_id:'1',status:'ATIVO'},
  {code:'ALFA',event_id:'1',status:'ATIVO',institution:' ALFA UNIPAC '}]};
 const s=C.analyze(C.resolve(extra,null),rows,rows);
 assert.equal(s.global.total,6);assert.equal(s.scope.total,3);assert.equal(s.scope.valid,2);
 assert.deepEqual(s.institutions,[['AlfaUnipac',6]]);assert.equal(s.snapshot.certificates,6);
 assert.equal(s.snapshot.bookRecords,2);
});
test('base sem emissões AlfaUnipac não atribui registros de terceiros à instituição',()=>{
 const other={...baseline,certificates:[{code:'OTHER',event_id:'1',status:'ATIVO',institution:'DIX Academy'}]};
 const s=C.analyze(C.resolve(other,null),rows,rows);
 assert.equal(s.global.total,0);assert.equal(s.scope.total,0);assert.deepEqual(s.institutions,[]);
});
test('snapshot do arquivo mantém somente os campos analíticos públicos',()=>{
 const path='protocolos/relatorios/certificacoes.json',s=JSON.parse(fs.readFileSync(path));
 const allowedCert=['code','event_id','status','year','registered','institution'];
 assert(s.certificates.every(c=>Object.keys(c).every(k=>allowedCert.includes(k))));
 assert(s.events.every(e=>Object.keys(e).every(k=>['id','protocol','title','unit'].includes(k))));
 assert(!fs.readFileSync(path,'utf8').includes('@'));
 assert.equal(C.resolve(s,null).certificates.length,998);assert.equal(s.source_book_records,929);
 const analysis=C.analyze(C.resolve(s,null),[],[]);
 assert.equal(analysis.global.total,908);assert.equal(analysis.global.registered,904);assert.equal(analysis.snapshot.bookRecords,904);assert.equal(analysis.snapshot.bookUnmatched,null);
});
