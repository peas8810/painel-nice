/**
 * Protocolo Academy — auditoria de prontidão para lançamento.
 * Instalar SOMENTE no backend privado. Não contém doGet.
 * Nunca converte flags de produção automaticamente.
 */
function academyAuditarLancamento() {
  if (typeof academyIntegracaoAuth_ === 'function') academyIntegracaoAuth_();
  else throw new Error('Autorização administrativa obrigatória.');
  const props=PropertiesService.getScriptProperties();
  const required=['ALUNOS','SOLICITACOES','EVIDENCIAS','VALIDACOES','PAGAMENTOS','CERTIFICADOS','AUDITORIA','CONFIGURACOES'];
  const ss=SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
  const tests=[];
  const add=(nome,ok,detalhe,bloqueio=true)=>tests.push({nome,ok:!!ok,bloqueio,detalhe});
  const missing=required.filter(n=>!ss.getSheetByName(n));
  add('Estrutura das oito abas',!missing.length,missing.length?'Ausentes: '+missing.join(', '):'Estrutura localizada');
  const folders=['EVIDENCIAS','CERTIFICADOS','RELATORIOS','MODELOS'];
  const absent=folders.filter(k=>!props.getProperty('ACADEMY_FOLDER_'+k));
  add('Pastas privadas do Drive',!absent.length,absent.length?'Faltam configurações: '+absent.join(', '):'IDs presentes; revisar permissões manualmente');
  const authorized=String(props.getProperty('ACADEMY_ADMIN_EMAILS')||'').split(',').map(x=>x.trim()).filter(Boolean);
  add('Administradores identificados',authorized.length>0,'Administradores configurados: '+authorized.length);
  add('Chave de integridade',String(props.getProperty('ACADEMY_SIGNING_SECRET')||'').length>=32,'Segredo HMAC configurado (sem divulgar valor)');
  const env=props.getProperty('MP_ENVIRONMENT')||'';
  add('Ambiente financeiro seguro',env==='sandbox'||env==='production',env||'Não configurado');
  add('Identidade pública com autorização individual',false,'Autenticação e isolamento entre alunos ainda não demonstrados');
  add('Upload público e antimalware',false,'Não homologado; interface atual é demonstrativa');
  add('Conciliação de pagamentos completa',false,'Não há homologação de estorno, chargeback e vendedor');
  add('Emissão definitiva de PDF',false,'Somente prévia DEMO');
  add('Dois verificadores públicos reais',false,'QR e relatório público ainda não disponíveis');
  add('E-mails transacionais',false,'Serviço de envio não homologado');
  add('Termos e privacidade definitivos',false,'Documentos publicados são minutas, sujeitos a aprovação');
  add('Testes ponta a ponta com usuários diferentes',false,'Não executados em produção');
  const blocking=tests.filter(t=>t.bloqueio&&!t.ok);
  return {prontoParaLancamento:blocking.length===0,
    liberacaoPublicaAutorizada:false,
    ambiente:env,aprovados:tests.filter(t=>t.ok).length,
    pendentes:blocking.length,checagens:tests,
    orientacao:'Não ativar cadastro público, pagamentos reais ou emissão oficial enquanto houver bloqueios.'};
}
function academyRegistrarAuditoriaLancamento() {
  const result=academyAuditarLancamento();
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
