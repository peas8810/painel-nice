/**
 * ACADEMY — emissão controlada, independente do NICE.
 * Arquivo: AcademyEmissao.gs, COPIAR para o Apps Script do Academy.
 * Não define doGet e não altera funções do NICE.
 * Registro separado: CERTIFICADOS (já existente).
 * Requer AcademyCore.gs, ACADEMY.SPREADSHEET_ID e pasta ACADEMY_FOLDER_CERTIFICADOS.
 *
 * NO AMBIENTE ATUAL somente prévias DEMO sem validade.
 * Habilitação comercial exige homologação e instalação das rotas públicas.
 */
const ACADEMY_EMISSAO = Object.freeze({
  publicBase: 'https://www.protocolo.me/academy/',
  headers: ['certificado_id','solicitacao_id','codigo_publico','versao','status',
            'emitido_em','drive_pdf_id','url_validacao','url_relatorio']
});
function academyEmissaoBook_() {
  return SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
}
function academyEmissaoSheet_(nome) {
  const sh = academyEmissaoBook_().getSheetByName(nome);
  if (!sh) throw new Error('Aba ausente: ' + nome);
  return sh;
}
function academyEmissaoRegistro_(sheet, id, idCol) {
  const rows = sheet.getDataRange().getValues();
  for (let i=1;i<rows.length;i++) {
    if (String(rows[i][idCol])===String(id)) return {row:i+1, data:rows[i]};
  }
  return null;
}
function academyEmissaoDados_(pedidoId) {
  const sol = academyEmissaoRegistro_(academyEmissaoSheet_('SOLICITACOES'),pedidoId,0);
  if (!sol) throw new Error('Solicitação não encontrada');
  const aluno = academyEmissaoRegistro_(academyEmissaoSheet_('ALUNOS'),sol.data[1],0);
  if (!aluno) throw new Error('Aluno não encontrado');
  const valid = academyEmissaoSheet_('VALIDACOES').getDataRange().getValues().slice(1)
    .filter(r=>String(r[1])===String(pedidoId))
    .sort((a,b)=>new Date(b[7])-new Date(a[7]))[0];
  const payments = academyEmissaoSheet_('PAGAMENTOS').getDataRange().getValues().slice(1)
    .filter(r=>String(r[1])===String(pedidoId));
  const pago = payments.some(r=>r[6]==='PAID_CONFIRMED' && String(r[5]).trim() &&
    Number(r[3])===15);
  return {
    id: String(pedidoId), nome:String(aluno.data[1]), atividade:String(sol.data[2]),
    inicio:String(sol.data[5]||''), fim:String(sol.data[6]||''),
    horasDeclaradas:Number(sol.data[7]), horasVerificadas:Number(sol.data[8]),
    status:String(sol.data[10]), validacao:valid,
    aprovado:!!valid && valid[3]==='APROVADO' &&
      Number(valid[5])>0 && Number(valid[5])<=Number(sol.data[7]) &&
      Number(sol.data[8])===Number(valid[5]) && sol.data[10]==='APROVADO',
    pago: pago
  };
}
function academyEmissaoChecar_(pedidoId) {
  const d = academyEmissaoDados_(pedidoId);
  return {solicitacaoId:d.id, documentacaoAprovada:d.aprovado,
          pagamentoConfirmado:d.pago, apto:d.aprovado&&d.pago};
}
function academyEmissaoTexto_(s) {return String(s||'').slice(0,1300);}
function academyEmissaoAssinar_(canonical) {
  const key=PropertiesService.getScriptProperties().getProperty('ACADEMY_SIGNING_SECRET');
  if (!key || key.length<32) throw new Error('Configure ACADEMY_SIGNING_SECRET (32+ caracteres) em Script Properties');
  const bytes=Utilities.computeHmacSha256Signature(canonical,key);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
function academyEmissaoQr_(url) {
  // Nenhuma informação pessoal na URL: somente código público do documento.
  const qrUrl='https://quickchart.io/qr?size=180&margin=2&text='+encodeURIComponent(url);
  const resp=UrlFetchApp.fetch(qrUrl,{muteHttpExceptions:true});
  if (resp.getResponseCode()!==200) throw new Error('Falha gerando QR Code');
  return resp.getBlob().setName('codigo-qr.png');
}
function academyEmissaoTextBox_(slide,txt,x,y,w,h,size,color,bold) {
  const sh=slide.insertTextBox(academyEmissaoTexto_(txt),x,y,w,h);
  sh.getText().getTextStyle().setFontFamily('Arial').setFontSize(size||12)
    .setForegroundColor(color||'#173B5E').setBold(!!bold);
  return sh;
}
function academyEmissaoPdf_(d, code, verifyUrl, reportUrl, signature) {
  const p=SlidesApp.create('ACADEMY DEMO '+code);
  try {
    const width=p.getPageWidth(), height=p.getPageHeight();
    const s=p.getSlides()[0]||p.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    s.getPageElements().forEach(e=>e.remove());
    s.getBackground().setSolidFill('#FFFFFF');
    const blue='#214C78', gray='#61738B';
    academyEmissaoTextBox_(s,'EDITORA UJN  •  PROTOCOLO ACADEMY',35,22,width-70,30,17,blue,true);
    academyEmissaoTextBox_(s,'MODELO DE HOMOLOGAÇÃO — SEM VALIDADE',35,53,width-70,24,12,'#B14C47',true);
    academyEmissaoTextBox_(s,'ATESTADO DE ATIVIDADE ACADÊMICA VERIFICADA',35,95,width-70,45,21,blue,true);
    academyEmissaoTextBox_(s,'Documento demonstrativo de '+d.nome,35,150,width-70,40,17,blue,true);
    academyEmissaoTextBox_(s,'Atividade: '+d.atividade,35,205,width-70,34,14,blue,false);
    academyEmissaoTextBox_(s,'Carga horária documentalmente verificada: '+d.horasVerificadas+' horas',35,250,width-70,34,13,blue,true);
    academyEmissaoTextBox_(s,'Código: '+code+'  |  Livro: DEMO  |  Registro: DEMO',35,302,width-70,22,10,gray,false);
    const qw=80, qy=Math.max(342,height-120);
    s.insertImage(academyEmissaoQr_(verifyUrl),40,qy,qw,qw);
    s.insertImage(academyEmissaoQr_(reportUrl),width-120,qy,qw,qw);
    academyEmissaoTextBox_(s,'AUTENTICIDADE (DEMO)',125,qy+25,170,30,9,blue,true);
    academyEmissaoTextBox_(s,'RELATÓRIO (DEMO)',width-290,qy+25,165,30,9,blue,true);
    const s2=p.appendSlide(SlidesApp.PredefinedLayout.BLANK);
    s2.getBackground().setSolidFill('#FFFFFF');
    academyEmissaoTextBox_(s2,'RELATÓRIO DOCUMENTAL — DEMONSTRAÇÃO',35,35,width-70,40,22,blue,true);
    academyEmissaoTextBox_(s2,'Atividade: '+d.atividade+'\nSolicitação: '+d.id+
      '\nResultado administrativo: '+d.status+
      '\nCarga horária declarada: '+d.horasDeclaradas+
      '\nCarga horária verificada: '+d.horasVerificadas+
      '\nAssinatura de registro (HMAC): '+signature.slice(0,36)+'…',35,100,width-70,200,13,blue,false);
    academyEmissaoTextBox_(s2,'A UJN registra a análise independente das evidências. O aproveitamento para horas complementares depende da instituição destinatária. Este arquivo é demonstração, não uma certificação do MEC nem da instituição onde ocorreu a atividade.',35,height-110,width-70,85,10,gray,false);
    SlidesApp.flush();
    return DriveApp.getFileById(p.getId()).getAs(MimeType.PDF)
      .setName('ACADEMY-DEMO-'+code+'.pdf');
  } finally {
    DriveApp.getFileById(p.getId()).setTrashed(true);
  }
}
/**
 * Gera documento DEMONSTRATIVO apenas quando o fluxo financeiro e documental
 * do pedido estiver completo. Não publica dados ou prova original.
 * Mantém bloqueio explícito de produção.
 */
function academyEmitirPreviaTeste(pedidoId) {
  const props=PropertiesService.getScriptProperties();
  if (props.getProperty('MP_ENVIRONMENT')!=='sandbox') {
    throw new Error('Emissão de prévia permitida somente no sandbox');
  }
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const d=academyEmissaoDados_(pedidoId);
    if (!d.aprovado) throw new Error('Falta aprovação documental');
    if (!d.pago) throw new Error('Falta confirmação financeira pela API');
    const certs=academyEmissaoSheet_('CERTIFICADOS');
    const existing=certs.getDataRange().getValues().slice(1).find(r=>
      String(r[1])===String(pedidoId) && String(r[4])==='DEMO');
    if (existing) return {status:'DEMO_EXISTENTE', codigo:String(existing[2])};
    const codigo='ACA-DEMO-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    const valid=ACADEMY_EMISSAO.publicBase+'validar/?codigo='+encodeURIComponent(codigo);
    const report=ACADEMY_EMISSAO.publicBase+'validar/?relatorio='+encodeURIComponent(codigo);
    const assinatura=academyEmissaoAssinar_([codigo,pedidoId,d.nome,d.atividade,d.horasVerificadas].join('|'));
    const blob=academyEmissaoPdf_(d,codigo,valid,report,assinatura);
    const folderId=props.getProperty('ACADEMY_FOLDER_CERTIFICADOS');
    if(!folderId)throw new Error('ACADEMY_FOLDER_CERTIFICADOS ausente');
    const file=DriveApp.getFolderById(folderId).createFile(blob);
    certs.appendRow(['CERT-'+Utilities.getUuid(),pedidoId,codigo,1,'DEMO',new Date(),
      file.getId(),valid,report]);
    academyEmissaoSheet_('AUDITORIA').appendRow(['AUD-'+Utilities.getUuid(),
      'CERTIFICADOS',codigo,'PREVIA_DEMO',Session.getEffectiveUser().getEmail(),
      new Date(),JSON.stringify({pedidoId,shaHmac:assinatura})]);
    return {status:'DEMO',codigo:codigo,mensagem:'PDF criado em pasta privada. Não é certificado válido.'};
  } finally {lock.releaseLock();}
}
