const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={niceCertDashboardClean_:(s,n)=>String(s??'').replace(/[<>]/g,'').trim().slice(0,n),Utilities:{getUuid:()=> 'uuid'},niceCertCustomGetLinkByToken_:()=>null};vm.createContext(ctx);vm.runInContext(fs.readFileSync('apps-script/CursosEventos.gs','utf8'),ctx);
const base=()=>({cliente:'Empresa',emissor:'Emissor',titulo:'Curso',data:'11/10/2026',signatario:'Responsável',pessoas:[{nome:'Maria Silva',email:'maria@example.com',funcao:'Participante',carga:'2'}]});
test('autorizações preservam horas individuais e normalizam email',()=>{const c=base();c.pessoas[0].email='MARIA@example.com';const out=ctx.niceCoursesValidate_(c);assert.equal(out.pessoas[0].email,'maria@example.com');assert.equal(out.pessoas[0].carga,'2 horas')});
test('conclusão exige aprovação explícita',()=>{const c=base();c.pessoas[0].funcao='Concluinte';assert.throws(()=>ctx.niceCoursesValidate_(c),/critérios/);c.pessoas[0].aprovado=true;assert.equal(ctx.niceCoursesValidate_(c).pessoas[0].funcao,'Concluinte')});
test('mesma pessoa pode ter duas funções, sem duplicar a mesma função',()=>{const c=base();c.pessoas.push({...c.pessoas[0],funcao:'Palestrante',carga:1});assert.equal(ctx.niceCoursesValidate_(c).pessoas.length,2);c.pessoas.push({...c.pessoas[0]});assert.throws(()=>ctx.niceCoursesValidate_(c),/duplicados/)});
test('bloqueia horas inválidas, imagens remotas e CPF público',()=>{for(const val of [-1,0,'NaN']){const c=base();c.pessoas[0].carga=val;assert.throws(()=>ctx.niceCoursesValidate_(c),/Pessoa inválida/)}assert.throws(()=>ctx.niceCoursesValidate_({...base(),logo:'https://example.com/a.png'}),/PNG/);assert.throws(()=>ctx.niceCoursesValidate_({...base(),documento:'123.456.789-00'}),/CPF/)});
test('não aceita alterar dados ou emitir para pessoa não autorizada',()=>{const c=ctx.niceCoursesValidate_(base());ctx.niceCoursesByLink_=()=>c;assert.throws(()=>ctx.niceCoursesAuthorize_({id:'C1'},{email:'outra@example.com',funcao:'Participante'}),/autorização/);const out=ctx.niceCoursesAuthorize_({id:'C1'},{email:'maria@example.com',funcao:'Participante',nome:'Fraude',carga:'1000',evento:'Outro'});assert.equal(out.nome,'Maria Silva');assert.equal(out.carga,'2 horas');assert.equal(out.evento,'Curso')});
test('emissão legada mantém parâmetros',()=>{ctx.niceCoursesByLink_=()=>null;const p={nome:'Legado'};assert.equal(ctx.niceCoursesAuthorize_({id:'C1'},p),p)});
test('edição preserva IDs, cria revisão e mantém snapshots dos certificados existentes',()=>{
 const old={...base(),id:'CUR-1',link_id:'C0001',cliente_id:'CLIENT-1',url:'https://example.com/link',revisao:1};
 const stored={text:JSON.stringify(old)},snapshots=[],writes=[];let released=false;
 ctx.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){released=true}})};
 ctx.niceCoursesSheet_=()=>({getDataRange:()=>({getValues:()=>[['ID','LINK','CLIENT','FILE'],['CUR-1','C0001','CLIENT-1','FILE1']]})});
 ctx.DriveApp={getFileById:()=>({getBlob:()=>({getDataAsString:()=>stored.text}),setContent:s=>stored.text=s})};
 ctx.niceCertCustomGetLinkById_=()=>({id_num:1,pasta_drive:'folder'});
 ctx.niceCertIssuesSheet_=()=>({getDataRange:()=>({getValues:()=>[['CUSTOM_LINK_ID','CODIGO'],['C0001','CERT-1']]})});
 ctx.niceCertHeaderMap_=heads=>Object.fromEntries(heads.map((x,i)=>[x,i]));
 ctx.niceCoursesSnapshot_=(link,code,c)=>snapshots.push({code,title:c.titulo});
 ctx.niceCertFolderFromUrl_=()=>({createFile(){}});ctx.Utilities.newBlob=x=>x;
 ctx.niceCertCustomLinksSheet_=()=>({getDataRange:()=>({getValues:()=>[['LINK_ID'],[1]]})});
 ctx.niceCertSetByMap_=(sh,row,h,key,value)=>writes.push({key,value});ctx.niceCertLog_=()=>{};ctx.niceCertParseLocalDateTime_=()=>null;
 const revised={...base(),titulo:'Curso corrigido',cliente_id:'tentativa-de-troca'};
 const out=ctx.niceCoursesUpdate_({id:'CUR-1',revisao:1,dados:JSON.stringify(revised)});
 assert.equal(out.course.id,'CUR-1');assert.equal(out.course.link_id,'C0001');assert.equal(out.course.cliente_id,'CLIENT-1');assert.equal(out.course.revisao,2);assert.equal(snapshots[0].title,'Curso');assert.equal(JSON.parse(stored.text).titulo,'Curso corrigido');assert.ok(released);
 assert.throws(()=>ctx.niceCoursesUpdate_({id:'CUR-1',revisao:1,dados:JSON.stringify(revised)}),/outra sessão/);
});
test('criação sem participantes permite aprovar modelo sem liberar emissão',()=>{const c=ctx.niceCoursesValidate_({...base(),pessoas:[]});assert.equal(c.pessoas.length,0);ctx.niceCoursesByLink_=()=>c;assert.throws(()=>ctx.niceCoursesAuthorize_({id:'C1'},{email:'maria@example.com',funcao:'Participante'}),/autorização/)});
test('limites são inteiros e limite zero bloqueia operação',()=>{assert.equal(ctx.niceCoursesLimit_('',100),100);assert.equal(ctx.niceCoursesLimit_(0,100),0);for(const n of [-1,1.5,'x',100001])assert.throws(()=>ctx.niceCoursesLimit_(n,100),/limite inteiro/)});
test('cotas somam concluídos e reservas, excluem falhas e outros clientes',()=>{
 const data=[['CURSO_ID','EMAIL','STATUS','PESO'],['CUR-1','a@b.com','CONCLUIDO',2],['CUR-1','a@b.com','RESERVADO',1],['CUR-1','a@b.com','FALHOU',1],['CUR-2','a@b.com','CONCLUIDO',99]];
 ctx.niceCoursesQuotaSheet_=()=>({getDataRange:()=>({getValues:()=>data})});const q=ctx.niceCoursesQuota_({id:'CUR-1',limite_total:5,limite_pessoa:3},'a@b.com');assert.equal(q.usados,2);assert.equal(q.reservados,1);assert.equal(q.disponiveis,2);assert.equal(q.pessoa_usados,3);
});
test('PDF ignora campo opcional vazio antes de chamar getText',()=>{
 const source=fs.readFileSync('apps-script/CursosEventos.gs','utf8');assert.match(source,/function text\(t[^\n]+if\(!String\(t\|\|''\)\.trim\(\)\)return null/);
});
test('servidor bloqueia total e pessoa antes de emitir e evita reenvio da mesma solicitação',()=>{
 function fresh(){const x={Utilities:{getUuid:()=> 'req-new-uuid'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}};vm.createContext(x);vm.runInContext(fs.readFileSync('apps-script/CursosEventos.gs','utf8'),x);const c={id:'C1',pessoas:[{nome:'Maria Silva',email:'a@b.com',funcao:'Participante',carga:'2 horas'}]};x.niceCoursesLoadClient_=()=>({c,link:{id:'LINK',token:'token'}});x.niceCertEmissionWindow_=()=>({open:true});x.niceCertHeaderMap_=heads=>Object.fromEntries(heads.map((h,i)=>[h,i]));x.niceCoursesPerson_=p=>p;x.niceCoursesBaselineLocked_=()=>{};x.niceCoursesQuotaSheet_=()=>({getDataRange:()=>({getValues:()=>[['SOLICITACAO_ID','CURSO_ID','STATUS','CODIGO']]})});x.niceCertCustomIssue_=()=>{throw new Error('Não deveria emitir');};return x;}
 const p={chave:'token',email:'a@b.com',funcao:'Participante',solicitacao_id:'request-1'};
 const total=fresh();total.niceCoursesQuota_=()=>({disponiveis:0,pessoa_usados:0,limite_pessoa:2});assert.throws(()=>total.niceCoursesClientIssue_(p),/limite deste link/);
 const person=fresh();person.niceCoursesQuota_=()=>({disponiveis:5,pessoa_usados:2,limite_pessoa:2});assert.throws(()=>person.niceCoursesClientIssue_(p),/limite de envios para esta pessoa/);
 const replay=fresh();replay.niceCoursesQuotaSheet_=()=>({getDataRange:()=>({getValues:()=>[['SOLICITACAO_ID','CURSO_ID','STATUS','CODIGO'],['request-1','C1','CONCLUIDO','CERT-1']]})});const out=replay.niceCoursesClientIssue_(p);assert.equal(out.code,'CERT-1');assert.equal(out.reused,true);
 const active=fresh();active.niceCoursesQuotaSheet_=()=>({getDataRange:()=>({getValues:()=>[['SOLICITACAO_ID','CURSO_ID','STATUS','CODIGO'],['request-1','C1','RESERVADO','']]})});assert.throws(()=>active.niceCoursesClientIssue_(p),/andamento/);
});
test('conteúdo preserva quebras de linha e aceita justificado ou tópicos',()=>{const c=ctx.niceCoursesValidate_({...base(),conteudo:'Módulo 1\r\nMódulo 2\nMódulo 3',conteudo_formato:'topicos'});assert.equal(c.conteudo,'Módulo 1\nMódulo 2\nMódulo 3');assert.equal(c.conteudo_formato,'topicos');assert.equal(ctx.niceCoursesValidate_({...base(),conteudo_formato:'inválido'}).conteudo_formato,'justificado')});
test('tópicos saem um por linha, sem dividir palavras com hífen',()=>{assert.equal(ctx.niceCoursesContentPages_('Teoria\nHands-on\nPrática','topicos')[0],'• Teoria\n• Hands-on\n• Prática');assert.equal(ctx.niceCoursesContentPages_('Teoria - Hands-on - Prática','topicos')[0],'• Teoria\n• Hands-on\n• Prática');assert.ok(ctx.niceCoursesContentPages_(Array.from({length:50},(_,i)=>'Módulo '+i).join('\n'),'topicos').length>1)});
test('dois QR Codes apontam à validação e ao próprio PDF',()=>{
 const x={NICE_CERT:{PUBLIC_BASE:'https://protocolo.me/certificados'},UrlFetchApp:{fetch:url=>{urls.push(url);return{getBlob:()=>({})}}},niceCertText_:()=>({getText:()=>({getTextStyle:()=>({setLinkUrl:url=>links.push(url)})})})};let urls=[],links=[],images=0;vm.createContext(x);vm.runInContext(fs.readFileSync('apps-script/CursosEventos.gs','utf8'),x);x.niceCoursesValidationPanel_({insertImage(){images++}},{codigo:'CERT-1',signature:'hash'},'Emissor','https://drive.google.com/file/d/PDF1/view','#123456');assert.equal(images,2);assert.ok(decodeURIComponent(urls[0]).includes('validar/?codigo=CERT-1'));assert.ok(decodeURIComponent(urls[1]).includes('https://drive.google.com/file/d/PDF1/view'));assert.equal(links[0],'https://drive.google.com/file/d/PDF1/view');
});
