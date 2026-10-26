/**
 * ACADEMY — homologação integrada (privada).
 * Adicionar ao mesmo Apps Script como AcademyIntegracao.gs.
 * NÃO contém doGet; rota em doGet existente: ?view=integracao
 * Somente administrador autorizado pode executar funções.
 */
function academyIntegracaoAuth_(){
  const email=String(Session.getActiveUser().getEmail()||'').toLowerCase().trim();
  const allow=String(PropertiesService.getScriptProperties().getProperty('ACADEMY_ADMIN_EMAILS')||'').toLowerCase().split(',').map(x=>x.trim());
  if(!email||!allow.includes(email))throw new Error('Usuário não autorizado. Configure ACADEMY_ADMIN_EMAILS e mantenha a implantação privada.');
  return email;
}
function academyIntegracaoPagina(){
  academyIntegracaoAuth_();
  return HtmlService.createHtmlOutputFromFile('AcademyIntegracao').setTitle('Academy — Centro de Homologação');
}
function academyIntegracaoDados(){
  academyIntegracaoAuth_();
  const props=PropertiesService.getScriptProperties();
  const s=SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
  const names=['ALUNOS','SOLICITACOES','EVIDENCIAS','VALIDACOES','PAGAMENTOS','CERTIFICADOS','AUDITORIA','CONFIGURACOES'];
  const tab={};names.forEach(n=>{const sh=s.getSheetByName(n);if(!sh)throw new Error('Aba ausente: '+n);const v=sh.getDataRange().getValues();tab[n]={total:Math.max(0,v.length-1),header:v[0]||[]};});
  const requests=s.getSheetByName('SOLICITACOES').getDataRange().getDisplayValues().slice(1);
  const paymentRows=s.getSheetByName('PAGAMENTOS').getDataRange().getDisplayValues().slice(1);
  const certs=s.getSheetByName('CERTIFICADOS').getDataRange().getDisplayValues().slice(1);
  const valid=s.getSheetByName('VALIDACOES').getDataRange().getDisplayValues().slice(1);
  const paymentCounts={},requestCounts={};
  paymentRows.forEach(r=>{const k=r[6]||'SEM_STATUS';paymentCounts[k]=(paymentCounts[k]||0)+1;});
  requests.forEach(r=>{const k=r[10]||'SEM_STATUS';requestCounts[k]=(requestCounts[k]||0)+1;});
  const last=requests.slice(-100).reverse().map(r=>({id:r[0],alunoId:r[1],atividade:r[2],horas:r[7],horasVerificadas:r[8],status:r[10],criado:r[11]}));
  return {environment:props.getProperty('MP_ENVIRONMENT')||'NÃO CONFIGURADO',
    publicPortalActive:false,realIssuanceActive:false,
    driveReady:!!props.getProperty('ACADEMY_FOLDER_EVIDENCIAS')&&!!props.getProperty('ACADEMY_FOLDER_CERTIFICADOS'),
    signingConfigured:!!props.getProperty('ACADEMY_SIGNING_SECRET'),
    marketplaceTokenConfigured:!!props.getProperty('MP_ACCESS_TOKEN'),
    tabs:tab,requestCounts,paymentCounts,
    certificadosAtivos:certs.filter(r=>r[4]==='ATIVO').length,
    certificadosDemo:certs.filter(r=>r[4]==='DEMO').length,
    pareceres:valid.length,registros:last,
    check:{doGet:'Rota manual requerida',cadastro:'Teste em painel existente',
      documentos:'Teste em painel existente',financeiro:'Sandbox',
      certificado:'Prévia DEMO',publico:'Ainda bloqueado'}};
}
function academyIntegracaoTesteUnico(){
  const admin=academyIntegracaoAuth_();
  const id='ACA-HOM-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
  const aluno='ALU-HOM-'+Utilities.getUuid().slice(0,8);
  const evid='EVI-HOM-'+Utilities.getUuid().slice(0,8);
  const now=new Date();
  const ss=SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
  const logs=[],lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const data=academyIntegracaoDados();
    if(!data.driveReady)throw new Error('Pastas do Drive não configuradas');
    if(data.environment!=='sandbox')throw new Error('Teste integrado só é autorizado em sandbox');
    const root=PropertiesService.getScriptProperties();
    const proofFolder=DriveApp.getFolderById(root.getProperty('ACADEMY_FOLDER_EVIDENCIAS'));
    const proof=proofFolder.createFile('ACADEMY-HOMOLOGACAO-'+id+'.txt',
      'EVIDÊNCIA FICTÍCIA GERADA POR ROTINA DE HOMOLOGAÇÃO. NÃO COMPROVA PARTICIPAÇÃO.',MimeType.PLAIN_TEXT);
    logs.push({passou:true,etapa:'Drive',detalhe:'Arquivo fictício criado em pasta privada'});
    ss.getSheetByName('ALUNOS').appendRow([aluno,'ALUNO FICTÍCIO — HOMOLOGAÇÃO','homologacao@example.invalid','','',now,'TESTE','NAO_APLICAVEL']);
    logs.push({passou:true,etapa:'Cadastro',detalhe:'Aluno fictício registrado'});
    ss.getSheetByName('SOLICITACOES').appendRow([id,aluno,'Grupo fictício de estudos','Grupo de estudos','Instituição fictícia',new Date(2026,9,1),new Date(2026,9,2),2,0,'Teste automatizado — não comprova atividade real','EM_ANALISE_TESTE',now,now]);
    logs.push({passou:true,etapa:'Solicitação',detalhe:'Solicitação criada'});
    ss.getSheetByName('EVIDENCIAS').appendRow([evid,id,'text/plain',proof.getId(),proof.getName(),'NAO_APLICAVEL',now,'TESTE_NAO_VALIDADO','Arquivo sintético de homologação']);
    logs.push({passou:true,etapa:'Evidência',detalhe:'Arquivo vinculado ao pedido'});
    ss.getSheetByName('VALIDACOES').appendRow(['VAL-HOM-'+Utilities.getUuid(),id,admin,'PENDENTE_DOCUMENTOS','O arquivo não comprova participação',0,'É necessária evidência autêntica',now]);
    logs.push({passou:true,etapa:'Análise',detalhe:'Parecer PENDENTE_DOCUMENTOS registrado'});
    ss.getSheetByName('PAGAMENTOS').appendRow(['PAG-HOM-'+Utilities.getUuid(),id,'PRIMEIRA_VIA',15,'','', 'NAO_INICIADO', '', now]);
    logs.push({passou:true,etapa:'Financeiro',detalhe:'Sem pagamento: não há aprovação artificial'});
    const blocked=typeof academyEmissaoChecar_==='function'?academyEmissaoChecar_(id):{apto:false};
    if(blocked.apto)throw new Error('FALHA CRÍTICA: solicitação de teste considerada apta a emitir');
    logs.push({passou:true,etapa:'Segurança da emissão',detalhe:'Emissão bloqueada por ausência de validação e pagamento'});
    ss.getSheetByName('AUDITORIA').appendRow(['AUD-HOM-'+Utilities.getUuid(),'HOMOLOGACAO',id,'TESTE_INTEGRADO',admin,now,JSON.stringify({resultado:'SEM_EMISSAO',codigo:id})]);
    logs.push({passou:true,etapa:'Auditoria',detalhe:'Rastreabilidade registrada'});
    return {sucesso:true,id,logs,nota:'Teste NEGATIVO seguro: nenhuma cobrança, certificado ou documento autêntico emitido.'};
  } catch(err) {
    logs.push({passou:false,etapa:'Falha',detalhe:String(err.message||err)});
    return {sucesso:false,id,logs,nota:'Pode ter gravado parte dos registros antes da falha; não execute repetidamente sem conferir a planilha.'};
  } finally {lock.releaseLock()}
}
