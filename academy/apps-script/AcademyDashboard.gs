/**
 * AcademyDashboard.gs - dashboard administrativo restrito.
 * Mantém o doGet existente: NÃO adicionar outro doGet.
 * Exige ACADEMY_ADMIN_EMAILS em Script Properties e sessão identificada.
 */
function academyDashboardAutorizado_() {
  const email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  const allowed=String(PropertiesService.getScriptProperties()
    .getProperty('ACADEMY_ADMIN_EMAILS')||'').toLowerCase()
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(!email || !allowed.includes(email)) throw new Error('Acesso administrativo não autorizado.');
  return email;
}
function academyDashboardLer_(ss,nome) {
  const sh=ss.getSheetByName(nome);
  if(!sh)throw new Error('Aba não encontrada: '+nome);
  const data=sh.getDataRange().getValues();
  if(!data.length)return [];
  const heads=data[0].map(x=>String(x).trim());
  return data.slice(1).filter(row=>row.some(v=>String(v).trim()!==''))
    .map(row=>Object.fromEntries(heads.map((h,i)=>[h,row[i]])));
}
function academyDashboardData_(d) {
  if(!d)return '';
  if(d instanceof Date)return isNaN(d.getTime())?'':d.toISOString();
  return String(d);
}
function academyDashboardResumo() {
  academyDashboardAutorizado_();
  const ss=SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
  const solicitacoes=academyDashboardLer_(ss,'SOLICITACOES');
  const alunos=academyDashboardLer_(ss,'ALUNOS');
  const pagamentos=academyDashboardLer_(ss,'PAGAMENTOS');
  const evidencias=academyDashboardLer_(ss,'EVIDENCIAS');
  const validacoes=academyDashboardLer_(ss,'VALIDACOES');
  const certificados=academyDashboardLer_(ss,'CERTIFICADOS');
  const porAluno=new Map(alunos.map(x=>[String(x.aluno_id),x]));
  const validPorPedido=new Map();
  validacoes.forEach(v=>{
    const k=String(v.solicitacao_id);
    const old=validPorPedido.get(k);
    if(!old || new Date(v.decidido_em||0)>=new Date(old.decidido_em||0)) validPorPedido.set(k,v);
  });
  const certPorPedido=new Map();
  certificados.forEach(c=>{if(String(c.status).toUpperCase()!=='DEMO')
    certPorPedido.set(String(c.solicitacao_id),c);});
  const payPorPedido=new Map();
  pagamentos.forEach(p=>{
    const k=String(p.solicitacao_id);
    if(!payPorPedido.has(k))payPorPedido.set(k,[]);
    payPorPedido.get(k).push(p);
  });
  const count={total:solicitacoes.length,emAnalise:0,aprovados:0,
    reprovados:0,correcao:0,pagos:0,pagamentosPendentes:0,emitidos:0,semPagamento:0};
  const registros=solicitacoes.map(s=>{
    const id=String(s.solicitacao_id);
    const analise=validPorPedido.get(id);
    const situacao=String(analise?.resultado||s.status||'SEM_STATUS').toUpperCase();
    const ps=payPorPedido.get(id)||[];
    const confirmado=ps.some(p=>String(p.status).toUpperCase()==='PAID_CONFIRMED');
    const pendente=ps.some(p=>['PREFERENCE_CREATED','PENDING','IN_PROCESS',
      'PAGAMENTO_TESTE_PENDENTE'].includes(String(p.status).toUpperCase()));
    const pagamento=confirmado?'CONFIRMADO':pendente?'PENDENTE':ps.length?'VERIFICAR':'NÃO INICIADO';
    if(['APROVADO','DEFERIDO'].includes(situacao))count.aprovados++;
    else if(['REPROVADO','INDEFERIDO'].includes(situacao))count.reprovados++;
    else if(['PENDENTE_DOCUMENTOS','CORRECAO_SOLICITADA','CORREÇÃO_SOLICITADA'].includes(situacao))count.correcao++;
    else count.emAnalise++;
    if(confirmado)count.pagos++;
    else if(pendente)count.pagamentosPendentes++;
    else count.semPagamento++;
    const cert=certPorPedido.get(id);
    if(cert && String(cert.status).toUpperCase()==='ATIVO')count.emitidos++;
    const aluno=porAluno.get(String(s.aluno_id));
    return {
      id,nome: String(aluno?.nome_completo||'Aluno não identificado'),
      email:String(aluno?.email||''),atividade:String(s.atividade||''),
      horasDeclaradas:Number(s.horas_declaradas)||0,
      horasVerificadas:Number(s.horas_verificadas)||0,
      situacao,pagamento,valorPago:confirmado?ps.filter(p=>p.status==='PAID_CONFIRMED')
        .reduce((n,p)=>n+Number(p.valor_brl||0),0):0,
      documentos:evidencias.filter(e=>String(e.solicitacao_id)===id).length,
      parecer:String(analise?.observacoes_publicas||''),
      atualizado:academyDashboardData_(s.atualizado_em||s.criado_em),
      certificado:cert?String(cert.codigo_publico||''):''
    };
  }).sort((a,b)=>String(b.atualizado).localeCompare(String(a.atualizado)));
  // Apenas para administradores autenticados. Nunca expor via endpoint público.
  return {geradoEm:new Date().toISOString(),indicadores:count,registros:registros.slice(0,500),
    totalExibido:Math.min(registros.length,500)};
}
function academyDashboardAbrir() {
  academyDashboardAutorizado_();
  const html=HtmlService.createHtmlOutputFromFile('AcademyDashboard')
    .setTitle('Protocolo Academy · Dashboard');
  return html;
}
