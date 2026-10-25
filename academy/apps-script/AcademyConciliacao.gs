/**
 * Protocolo Academy - Conciliacao Mercado Pago.
 * Copiar como AcademyConciliacao.gs no Apps Script existente.
 * Usa ACADEMY.SPREADSHEET_ID e MP_ACCESS_TOKEN ja configurados.
 * Nao registra pagamento com base em URL de retorno ou declaracao do aluno.
 *
 * IMPORTANTE: essa versao busca pagamentos por external_reference.
 * Pagamentos de producao so devem ser habilitados apos homologacao
 * de autenticacao, permissoes e idempotencia do fluxo integral.
 */
function academyConciliarPagamentosTeste() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MP_ENVIRONMENT') !== 'sandbox') {
    throw new Error('Conciliacao inicial restrita a sandbox.');
  }
  const token = props.getProperty('MP_ACCESS_TOKEN');
  if (!token) throw new Error('MP_ACCESS_TOKEN ausente');
  const book = SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
  const sheet = book.getSheetByName('PAGAMENTOS');
  const requests = book.getSheetByName('SOLICITACOES');
  const audit = book.getSheetByName('AUDITORIA');
  if (!sheet || !requests || !audit) throw new Error('Abas ausentes');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rows = sheet.getDataRange().getValues();
    let aprovados = 0, pendentes = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const pedidoId = String(row[1] || '');
      const valorEsperado = Number(row[3]);
      const estado = String(row[6] || '');
      if (!pedidoId.startsWith('ACA-TEST-')) continue;
      if (estado === 'PAID_CONFIRMED') continue;
      const url = 'https://api.mercadopago.com/v1/payments/search?external_reference=' +
        encodeURIComponent(pedidoId) + '&sort=date_created&criteria=desc&limit=30';
      const response = UrlFetchApp.fetch(url, {
        method: 'get', headers: {Authorization: 'Bearer ' + token},
        muteHttpExceptions: true
      });
      if (response.getResponseCode() !== 200) {
        throw new Error('Erro consultando pagamentos do pedido ' + pedidoId +
          ': HTTP ' + response.getResponseCode());
      }
      const body = JSON.parse(response.getContentText());
      const candidates = body.results || [];
      let confirmed = null;
      for (const p of candidates) {
        if (String(p.external_reference) !== pedidoId) continue;
        if (p.status !== 'approved') continue;
        if (p.currency_id !== 'BRL') continue;
        if (Math.abs(Number(p.transaction_amount) - valorEsperado) > 0.001) continue;
        if (!p.id) continue;
        // Conferir cada transacao individualmente na API autenticada.
        const paymentResponse = UrlFetchApp.fetch(
          'https://api.mercadopago.com/v1/payments/' + encodeURIComponent(String(p.id)),
          {method: 'get',headers:{Authorization:'Bearer ' + token},muteHttpExceptions:true}
        );
        if (paymentResponse.getResponseCode() !== 200) continue;
        const detail = JSON.parse(paymentResponse.getContentText());
        if (detail.status !== 'approved' ||
            detail.external_reference !== pedidoId ||
            detail.currency_id !== 'BRL' ||
            Math.abs(Number(detail.transaction_amount)-valorEsperado)>0.001) continue;
        confirmed = detail;
        break;
      }
      if (!confirmed) { pendentes++; continue; }
      sheet.getRange(i + 1, 6).setValue(String(confirmed.id));
      sheet.getRange(i + 1, 7).setValue('PAID_CONFIRMED');
      sheet.getRange(i + 1, 8).setValue(new Date());
      sheet.getRange(i + 1, 9).setValue(new Date());
      audit.appendRow(['AUD-' + Utilities.getUuid(), 'PAGAMENTOS',
        String(row[0]),'CONFIRMACAO_API',Session.getEffectiveUser().getEmail(),
        new Date(),JSON.stringify({pedidoId, paymentId:String(confirmed.id), valor:valorEsperado})]);
      aprovados++;
    }
    Logger.log(JSON.stringify({aprovados,pendentes}));
    return {aprovados, pendentes};
  } finally {lock.releaseLock();}
}
/** Consulta elegibilidade sem emitir documento. */
function academyElegibilidadeEmissaoTeste(solicitacaoId) {
  const book = SpreadsheetApp.openById(ACADEMY.SPREADSHEET_ID);
  const solicitacoes = book.getSheetByName('SOLICITACOES').getDataRange().getValues();
  const pagamentos = book.getSheetByName('PAGAMENTOS').getDataRange().getValues();
  const validacoes = book.getSheetByName('VALIDACOES').getDataRange().getValues();
  const pedido = solicitacoes.slice(1).find(r => String(r[0]) === String(solicitacaoId));
  if (!pedido) return {apto:false,motivo:'PEDIDO_NAO_ENCONTRADO'};
  const aprovacao = validacoes.slice(1).some(r =>
    String(r[1]) === String(solicitacaoId) &&
    String(r[3]) === 'APROVADO' && Number(r[5]) > 0);
  const pago = pagamentos.slice(1).some(r =>
    String(r[1]) === String(solicitacaoId) &&
    String(r[6]) === 'PAID_CONFIRMED' && String(r[5]) !== '');
  return {apto:aprovacao && pago, documentoAprovado:aprovacao,
    pagamentoConfirmado:pago, emissaoAutomaticaAtivada:false};
}
