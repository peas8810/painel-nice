/**
 * Dashboard público seguro de certificados NICE.
 * Não expõe nome, e-mail ou outros dados pessoais dos participantes.
 */
function niceCertDashboardPublic_(){
  const ss = SpreadsheetApp.openById(NICE_API.SPREADSHEET_ID);
  const shEvents = ss.getSheetByName('CERT_EVENTOS');
  const shIssues = ss.getSheetByName('CERT_EMISSOES');

  const events = [];
  const certs = [];
  const byEvent = {};
  let abertos = 0, fechados = 0, revogados = 0, enviados = 0;

  if (shIssues && shIssues.getLastRow() > 1) {
    const values = shIssues.getDataRange().getValues();
    const h = niceApiMapHeaders_(values[0]);
    for (let i = values.length - 1; i >= 1; i--) {
      const eventId = Number(niceApiCell_(values[i], h, 'EVENTO_ID') || 0);
      const code = String(niceApiCell_(values[i], h, 'CODIGO') || '').trim().toUpperCase();
      const status = String(niceApiCell_(values[i], h, 'STATUS') || '').trim().toUpperCase();
      if (!eventId || !code) continue;
      if (status === 'REVOGADO') revogados++;
      if (['ENVIADO','ATIVO','REVOGADO'].includes(status)) enviados++;
      byEvent[eventId] = (byEvent[eventId] || 0) + (['ENVIADO','ATIVO','REVOGADO'].includes(status) ? 1 : 0);
      certs.push({
        codigo: code,
        evento_id: String(eventId).padStart(4,'0'),
        status: status || 'SEM_STATUS',
        emitido_em: niceApiIso_(niceApiCell_(values[i], h, 'EMITIDO_EM')),
        validacao: 'https://www.protocolo.me/certificados/validar/?codigo=' + encodeURIComponent(code)
      });
      if (certs.length >= 1000) break;
    }
  }

  if (shEvents && shEvents.getLastRow() > 1) {
    const values = shEvents.getDataRange().getValues();
    const h = niceApiMapHeaders_(values[0]);
    for (let i = values.length - 1; i >= 1; i--) {
      const idNum = Number(niceApiCell_(values[i], h, 'EVENTO_ID') || 0);
      if (!idNum) continue;
      const status = String(niceApiCell_(values[i], h, 'STATUS') || '').trim().toUpperCase();
      if (status === 'EMISSAO_ABERTA') abertos++;
      else fechados++;
      const id = String(idNum).padStart(4,'0');
      events.push({
        id,
        titulo: niceApiPublicText_(niceApiCell_(values[i], h, 'TITULO_EVENTO')),
        data_evento: niceApiIso_(niceApiCell_(values[i], h, 'DATA_EVENTO')),
        campus_unidade: niceApiPublicText_(niceApiCell_(values[i], h, 'CAMPUS_UNIDADE')),
        local: niceApiPublicText_(niceApiCell_(values[i], h, 'LOCAL')),
        carga_horaria: niceApiPublicText_(niceApiCell_(values[i], h, 'CARGA_HORARIA')),
        protocolo_nice: niceApiPublicText_(niceApiCell_(values[i], h, 'PROTOCOLO_NICE')),
        status: status || 'SEM_STATUS',
        certificados_emitidos: byEvent[idNum] || 0,
        url_publica: 'https://www.protocolo.me/certificados/' + id + '/'
      });
    }
  }

  return {
    ok: true,
    updated_at: new Date().toISOString(),
    summary: {
      eventos: events.length,
      emissao_aberta: abertos,
      emissao_fechada: fechados,
      certificados_emitidos: enviados,
      certificados_revogados: revogados
    },
    events,
    certificates: certs,
    privacy: 'Nenhum nome ou e-mail é exposto por este endpoint.'
  };
}
