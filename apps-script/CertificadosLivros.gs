/**
 * Livro Digital de Certificações
 * Registro sequencial, imutável e independente por instituição.
 *
 * Regras:
 * - Cada instituição possui sua própria sequência de livros.
 * - Cada ano abre automaticamente um novo livro para a instituição.
 * - O registro reinicia em 000001 a cada novo livro.
 * - Registros nunca são reutilizados, mesmo quando o certificado é revogado.
 * - A alocação é protegida por LockService para evitar duplicidade.
 */
const NICE_CERT_BOOK = Object.freeze({
  INSTITUTIONS:'CERT_INSTITUICOES',
  BOOKS:'CERT_LIVROS',
  REGISTERS:'CERT_LIVRO_REGISTROS',
  INSTITUTION_HEADERS:[
    'INSTITUICAO_ID','NOME','CHAVE_NORMALIZADA','STATUS','CRIADA_EM','ATUALIZADA_EM'
  ],
  BOOK_HEADERS:[
    'LIVRO_ID','INSTITUICAO_ID','INSTITUICAO','NUMERO_LIVRO','ANO','STATUS',
    'REGISTRO_INICIAL','ULTIMO_REGISTRO','TOTAL_REGISTROS','ABERTO_EM','ENCERRADO_EM','ATUALIZADO_EM'
  ],
  REGISTER_HEADERS:[
    'REGISTRO_ID','INSTITUICAO_ID','INSTITUICAO','LIVRO_ID','NUMERO_LIVRO','ANO','REGISTRO',
    'CODIGO_CERTIFICADO','TIPO_CERTIFICADO','EVENTO_ID','CUSTOM_LINK_ID','TITULAR','EMAIL',
    'TITULO_EVENTO','FUNCAO','CARGA_HORARIA','EMITIDO_EM','STATUS','HASH_PDF','PDF_URL',
    'REVOGADO_EM','MOTIVO_REVOGACAO','CRIADO_EM','ATUALIZADO_EM'
  ]
});

function instalarLivroDigitalCertificacoes(){
  const ss=niceMaster_();
  niceCertSheet_(ss,NICE_CERT_BOOK.INSTITUTIONS,NICE_CERT_BOOK.INSTITUTION_HEADERS);
  niceCertSheet_(ss,NICE_CERT_BOOK.BOOKS,NICE_CERT_BOOK.BOOK_HEADERS);
  niceCertSheet_(ss,NICE_CERT_BOOK.REGISTERS,NICE_CERT_BOOK.REGISTER_HEADERS);
  if(typeof niceCertIssuesSheet_==='function'){
    const sh=niceCertIssuesSheet_();
    ['INSTITUICAO_ID','LIVRO_DIGITAL','ANO_LIVRO','REGISTRO_DIGITAL','REGISTRO_ID','HASH_PDF'].forEach(h=>{
      const heads=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
      if(!heads.includes(h))sh.getRange(1,sh.getLastColumn()+1).setValue(h);
    });
  }
  try{SpreadsheetApp.getUi().alert('Livro Digital de Certificações instalado e atualizado.');}catch(_){}
}

function niceCertBookInstitutionsSheet_(){
  return niceCertSheet_(niceMaster_(),NICE_CERT_BOOK.INSTITUTIONS,NICE_CERT_BOOK.INSTITUTION_HEADERS);
}
function niceCertBooksSheet_(){
  return niceCertSheet_(niceMaster_(),NICE_CERT_BOOK.BOOKS,NICE_CERT_BOOK.BOOK_HEADERS);
}
function niceCertRegistersSheet_(){
  return niceCertSheet_(niceMaster_(),NICE_CERT_BOOK.REGISTERS,NICE_CERT_BOOK.REGISTER_HEADERS);
}

function niceCertBookNormalizeInstitution_(name){
  return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,' ').trim().toUpperCase();
}

function niceCertBookEnsureInstitutionLocked_(name){
  const clean=String(name||'').trim();
  if(!clean)throw new Error('Instituição emissora não informada.');
  const key=niceCertBookNormalizeInstitution_(clean);
  const sh=niceCertBookInstitutionsSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  let max=0;
  for(let i=1;i<v.length;i++){
    const n=Number(String(v[i][m.INSTITUICAO_ID]||'').replace(/\D/g,''))||0;
    max=Math.max(max,n);
    if(String(v[i][m.CHAVE_NORMALIZADA]||'')===key){
      return{id:String(v[i][m.INSTITUICAO_ID]),nome:String(v[i][m.NOME]||clean),row:i+1};
    }
  }
  const id='INST-'+String(max+1).padStart(4,'0'),now=new Date();
  niceCertAppendObject_(sh,{INSTITUICAO_ID:id,NOME:clean,CHAVE_NORMALIZADA:key,STATUS:'ATIVA',CRIADA_EM:now,ATUALIZADA_EM:now});
  return{id,nome:clean,row:sh.getLastRow()};
}

function niceCertBookEnsureBookLocked_(inst,year){
  const sh=niceCertBooksSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  let maxBook=0;
  for(let i=1;i<v.length;i++){
    if(String(v[i][m.INSTITUICAO_ID]||'')!==inst.id)continue;
    const num=Number(v[i][m.NUMERO_LIVRO])||0;
    maxBook=Math.max(maxBook,num);
    if(Number(v[i][m.ANO])===Number(year)&&String(v[i][m.STATUS]||'ABERTO').toUpperCase()==='ABERTO'){
      return{
        id:String(v[i][m.LIVRO_ID]),numero:num,ano:Number(year),row:i+1,
        ultimo:Number(v[i][m.ULTIMO_REGISTRO])||0,total:Number(v[i][m.TOTAL_REGISTROS])||0
      };
    }
  }
  const numero=maxBook+1;
  const id='LIV-'+inst.id.replace(/\D/g,'')+'-'+String(year)+'-'+String(numero).padStart(3,'0');
  const now=new Date();
  niceCertAppendObject_(sh,{
    LIVRO_ID:id,INSTITUICAO_ID:inst.id,INSTITUICAO:inst.nome,NUMERO_LIVRO:numero,ANO:Number(year),
    STATUS:'ABERTO',REGISTRO_INICIAL:1,ULTIMO_REGISTRO:0,TOTAL_REGISTROS:0,ABERTO_EM:now,ENCERRADO_EM:'',ATUALIZADO_EM:now
  });
  return{id,numero,ano:Number(year),row:sh.getLastRow(),ultimo:0,total:0};
}

function niceCertBookAllocate_(o){
  const data=o||{},instituicao=String(data.instituicao||'').trim();
  if(!instituicao)throw new Error('Não é possível registrar o certificado sem instituição emissora.');
  const issued=data.emitido instanceof Date?data.emitido:new Date(data.emitido||new Date());
  const year=Number(Utilities.formatDate(issued,Session.getScriptTimeZone()||'America/Sao_Paulo','yyyy'));
  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const inst=niceCertBookEnsureInstitutionLocked_(instituicao);
    const book=niceCertBookEnsureBookLocked_(inst,year);
    const regNum=book.ultimo+1;
    const reg=String(regNum).padStart(6,'0');
    const bookDisplay='Livro '+String(book.numero).padStart(3,'0')+' — '+year;
    const regId='REG-'+inst.id.replace(/\D/g,'')+'-'+String(year)+'-'+String(book.numero).padStart(3,'0')+'-'+reg;
    const now=new Date();

    const bsh=niceCertBooksSheet_(),bv=bsh.getDataRange().getValues(),bm=niceCertHeaderMap_(bv[0]);
    niceCertSetByMap_(bsh,book.row,bm,'ULTIMO_REGISTRO',regNum);
    niceCertSetByMap_(bsh,book.row,bm,'TOTAL_REGISTROS',book.total+1);
    niceCertSetByMap_(bsh,book.row,bm,'ATUALIZADO_EM',now);

    niceCertAppendObject_(niceCertRegistersSheet_(),{
      REGISTRO_ID:regId,INSTITUICAO_ID:inst.id,INSTITUICAO:inst.nome,LIVRO_ID:book.id,
      NUMERO_LIVRO:book.numero,ANO:year,REGISTRO:reg,CODIGO_CERTIFICADO:String(data.codigo||'').toUpperCase(),
      TIPO_CERTIFICADO:String(data.tipo||'PADRAO'),EVENTO_ID:data.evento_id||'',CUSTOM_LINK_ID:data.custom_link_id||'',
      TITULAR:data.nome||'',EMAIL:data.email||'',TITULO_EVENTO:data.evento||'',FUNCAO:data.funcao||'',
      CARGA_HORARIA:data.carga||'',EMITIDO_EM:issued,STATUS:'RESERVADO',HASH_PDF:'',PDF_URL:'',
      REVOGADO_EM:'',MOTIVO_REVOGACAO:'',CRIADO_EM:now,ATUALIZADO_EM:now
    });

    return{
      instituicao_id:inst.id,instituicao:inst.nome,livro_id:book.id,numero_livro:book.numero,ano:year,
      livro_display:bookDisplay,registro:reg,registro_id:regId,status:'RESERVADO'
    };
  }finally{lock.releaseLock();}
}

function niceCertBookFinalize_(registry,o){
  if(!registry||!registry.registro_id)return;
  const data=o||{},sh=niceCertRegistersSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(String(v[i][m.REGISTRO_ID]||'')!==String(registry.registro_id))continue;
    niceCertSetByMap_(sh,i+1,m,'STATUS','ATIVO');
    niceCertSetByMap_(sh,i+1,m,'HASH_PDF',data.hash_pdf||'');
    niceCertSetByMap_(sh,i+1,m,'PDF_URL',data.pdf_url||'');
    niceCertSetByMap_(sh,i+1,m,'ATUALIZADO_EM',new Date());
    return;
  }
}

function niceCertBookMarkRevokedByCode_(code,reason,date){
  const wanted=String(code||'').trim().toUpperCase();
  if(!wanted)return;
  const sh=niceCertRegistersSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(String(v[i][m.CODIGO_CERTIFICADO]||'').trim().toUpperCase()!==wanted)continue;
    niceCertSetByMap_(sh,i+1,m,'STATUS','REVOGADO');
    niceCertSetByMap_(sh,i+1,m,'REVOGADO_EM',date||new Date());
    niceCertSetByMap_(sh,i+1,m,'MOTIVO_REVOGACAO',String(reason||''));
    niceCertSetByMap_(sh,i+1,m,'ATUALIZADO_EM',new Date());
    return;
  }
}

function niceCertBookFindByCode_(code){
  const wanted=String(code||'').trim().toUpperCase();
  if(!wanted)return null;
  const sh=niceCertRegistersSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(String(v[i][m.CODIGO_CERTIFICADO]||'').trim().toUpperCase()!==wanted)continue;
    return{
      registro_id:String(v[i][m.REGISTRO_ID]||''),
      instituicao_id:String(v[i][m.INSTITUICAO_ID]||''),
      instituicao:String(v[i][m.INSTITUICAO]||''),
      livro_id:String(v[i][m.LIVRO_ID]||''),
      numero_livro:Number(v[i][m.NUMERO_LIVRO])||0,
      ano:Number(v[i][m.ANO])||0,
      livro_display:'Livro '+String(Number(v[i][m.NUMERO_LIVRO])||0).padStart(3,'0')+' — '+String(v[i][m.ANO]||''),
      registro:String(v[i][m.REGISTRO]||''),
      status:String(v[i][m.STATUS]||''),
      hash_pdf:String(v[i][m.HASH_PDF]||''),
      pdf_url:String(v[i][m.PDF_URL]||'')
    };
  }
  return null;
}

function niceCertBookRegistryFromIssue_(sh,row,m){
  const registroId=String(niceCertGetByMap_(sh,row,m,'REGISTRO_ID')||'').trim();
  if(!registroId)return null;
  return{
    registro_id:registroId,
    instituicao_id:String(niceCertGetByMap_(sh,row,m,'INSTITUICAO_ID')||''),
    instituicao:String(niceCertGetByMap_(sh,row,m,'INSTITUICAO_EMISSORA')||''),
    livro_display:String(niceCertGetByMap_(sh,row,m,'LIVRO_DIGITAL')||''),
    ano:Number(niceCertGetByMap_(sh,row,m,'ANO_LIVRO'))||0,
    registro:String(niceCertGetByMap_(sh,row,m,'REGISTRO_DIGITAL')||'')
  };
}

function niceCertBookWriteIssue_(sh,row,m,registry){
  niceCertSetByMap_(sh,row,m,'INSTITUICAO_ID',registry.instituicao_id||'');
  niceCertSetByMap_(sh,row,m,'LIVRO_DIGITAL',registry.livro_display||'');
  niceCertSetByMap_(sh,row,m,'ANO_LIVRO',registry.ano||'');
  niceCertSetByMap_(sh,row,m,'REGISTRO_DIGITAL',registry.registro||'');
  niceCertSetByMap_(sh,row,m,'REGISTRO_ID',registry.registro_id||'');
  // Compatibilidade com certificados customizados legados.
  if(m.LIVRO_ATA!==undefined)niceCertSetByMap_(sh,row,m,'LIVRO_ATA',registry.livro_display||'');
  if(m.REGISTRO_CERTIFICADO!==undefined)niceCertSetByMap_(sh,row,m,'REGISTRO_CERTIFICADO',registry.registro||'');
  if(m.VIA_EMITIDA!==undefined&&!niceCertGetByMap_(sh,row,m,'VIA_EMITIDA'))niceCertSetByMap_(sh,row,m,'VIA_EMITIDA','1ª Via Emitida');
}

function niceCertBookSha256Blob_(blob){
  const bytes=blob.getBytes();
  const digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes);
  return digest.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('').toUpperCase();
}

function niceCertBookAdminData_(){
  const bsh=niceCertBooksSheet_(),bv=bsh.getDataRange().getValues(),bm=niceCertHeaderMap_(bv[0]),books=[];
  for(let i=bv.length-1;i>=1;i--){
    books.push({
      livro_id:String(bv[i][bm.LIVRO_ID]||''),
      instituicao_id:String(bv[i][bm.INSTITUICAO_ID]||''),
      instituicao:String(bv[i][bm.INSTITUICAO]||''),
      numero_livro:Number(bv[i][bm.NUMERO_LIVRO])||0,
      ano:Number(bv[i][bm.ANO])||0,
      livro:'Livro '+String(Number(bv[i][bm.NUMERO_LIVRO])||0).padStart(3,'0')+' — '+String(bv[i][bm.ANO]||''),
      ultimo_registro:String(Number(bv[i][bm.ULTIMO_REGISTRO])||0).padStart(6,'0'),
      total_registros:Number(bv[i][bm.TOTAL_REGISTROS])||0,
      status:String(bv[i][bm.STATUS]||'ABERTO')
    });
  }
  const rsh=niceCertRegistersSheet_(),rv=rsh.getDataRange().getValues(),rm=niceCertHeaderMap_(rv[0]),recent=[];
  for(let i=rv.length-1;i>=1&&recent.length<100;i--){
    recent.push({
      registro_id:String(rv[i][rm.REGISTRO_ID]||''),
      instituicao:String(rv[i][rm.INSTITUICAO]||''),
      livro:'Livro '+String(Number(rv[i][rm.NUMERO_LIVRO])||0).padStart(3,'0')+' — '+String(rv[i][rm.ANO]||''),
      registro:String(rv[i][rm.REGISTRO]||''),
      codigo:String(rv[i][rm.CODIGO_CERTIFICADO]||''),
      status:String(rv[i][rm.STATUS]||''),
      emitido_em:niceApiIso_(rv[i][rm.EMITIDO_EM])
    });
  }
  return{ok:true,books,recent,summary:{livros:books.length,registros:Math.max(0,rv.length-1),instituicoes:niceCertBookInstitutionsSheet_().getLastRow()-1}};
}
