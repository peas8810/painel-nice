/**
 * NICE -> GitHub: sincronização imediata do painel público
 *
 * Este arquivo NÃO contém o token do GitHub.
 * O token deve ser salvo em:
 * Apps Script > Configurações do projeto > Propriedades do script
 * Chave: GITHUB_SYNC_TOKEN
 *
 * Fluxo:
 * Formulário -> função original do SistemaNICE -> repository_dispatch ->
 * GitHub Actions -> live-data.json -> portal público.
 */

const NICE_GITHUB_SYNC = Object.freeze({
  OWNER: 'peas8810',
  REPO: 'painel-nice',
  EVENT_TYPE: 'nice-sync',
  TOKEN_PROPERTY: 'GITHUB_SYNC_TOKEN'
});

/**
 * Instala gatilhos rápidos em substituição aos dois gatilhos originais
 * de submissão. As funções originais continuam sendo executadas, mas
 * agora, ao final, o GitHub é avisado imediatamente.
 */
function instalarSincronizacaoImediataNICE() {
  const handlers = new Set([
    'onProtocolFormSubmit',
    'onReportFormSubmit',
    'niceProtocolFastSubmit',
    'niceReportFastSubmit'
  ]);

  ScriptApp.getProjectTriggers().forEach(t => {
    if (handlers.has(t.getHandlerFunction())) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('niceProtocolFastSubmit')
    .forSpreadsheet(SpreadsheetApp.openById(NICE.FORMALIZACAO_SPREADSHEET_ID))
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger('niceReportFastSubmit')
    .forSpreadsheet(SpreadsheetApp.openById(NICE.RELATORIO_SPREADSHEET_ID))
    .onFormSubmit()
    .create();

  // Mantém a rotina diária caso ela já não exista.
  const dailyExists = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'atualizarStatusDiario');
  if (!dailyExists) {
    ScriptApp.newTrigger('atualizarStatusDiario')
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
  }

  testarSincronizacaoGitHub();

  SpreadsheetApp.getUi().alert(
    'Sincronização imediata instalada.\n\n' +
    'Novos protocolos e relatórios passarão a acionar o GitHub automaticamente.'
  );
}

/** Novo protocolo: executa a rotina original e só depois sincroniza. */
function niceProtocolFastSubmit(e) {
  onProtocolFormSubmit(e);
  const id = niceSyncExtractIdFromEvent_(e);
  niceTriggerGitHubSync_('PROTOCOLO_CRIADO', id);
}

/** Novo relatório: executa a rotina original e só depois sincroniza. */
function niceReportFastSubmit(e) {
  onReportFormSubmit(e);
  const id = niceSyncExtractIdFromEvent_(e);
  niceTriggerGitHubSync_('RELATORIO_RECEBIDO', id);
}

/** Pode ser executada manualmente para validar token + GitHub. */
function testarSincronizacaoGitHub() {
  const result = niceTriggerGitHubSync_('TESTE_MANUAL', '');
  SpreadsheetApp.getUi().alert(
    'GitHub respondeu HTTP ' + result.code + '.\n\n' +
    (result.ok
      ? 'Solicitação de sincronização aceita.'
      : 'Falha ao disparar a sincronização: ' + result.body)
  );
}

/**
 * Dispara repository_dispatch. O endpoint retorna normalmente HTTP 204.
 */
function niceTriggerGitHubSync_(reason, id) {
  const token = PropertiesService.getScriptProperties()
    .getProperty(NICE_GITHUB_SYNC.TOKEN_PROPERTY);

  if (!token) {
    throw new Error(
      'Propriedade GITHUB_SYNC_TOKEN não encontrada. ' +
      'Cadastre o token em Configurações do projeto > Propriedades do script.'
    );
  }

  const url = 'https://api.github.com/repos/' +
    NICE_GITHUB_SYNC.OWNER + '/' + NICE_GITHUB_SYNC.REPO + '/dispatches';

  const payload = {
    event_type: NICE_GITHUB_SYNC.EVENT_TYPE,
    client_payload: {
      reason: String(reason || 'ATUALIZACAO').slice(0, 100),
      id: String(id || '').slice(0, 100),
      requested_at: new Date().toISOString()
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify(payload)
  });

  const code = response.getResponseCode();
  const body = response.getContentText() || '';
  const ok = code === 204;

  try {
    if (typeof niceLog_ === 'function') {
      niceLog_(
        ok ? 'INFO' : 'ERRO',
        'niceTriggerGitHubSync_',
        id || '',
        'GitHub HTTP ' + code + ' · ' + (reason || '') + (body ? ' · ' + body : '')
      );
    }
  } catch (_) {}

  if (!ok) {
    throw new Error('GitHub retornou HTTP ' + code + (body ? ': ' + body : ''));
  }

  return {ok: true, code: code, body: body};
}

function niceSyncExtractIdFromEvent_(e) {
  try {
    if (!e || !e.range) return '';
    const sh = e.range.getSheet();
    const row = e.range.getRow();
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    const values = sh.getRange(row, 1, 1, lastCol).getDisplayValues()[0];
    const re = /\bNICE-[0-9]{4}-[0-9]{5}\b/i;

    for (let i = 0; i < values.length; i++) {
      const m = String(values[i] || '').match(re);
      if (m) return m[0].toUpperCase();
    }

    const idCol = headers.findIndex(h => String(h).trim() === 'ID_NICE');
    if (idCol >= 0) {
      const m = String(values[idCol] || '').match(re);
      if (m) return m[0].toUpperCase();
    }
  } catch (_) {}
  return '';
}
