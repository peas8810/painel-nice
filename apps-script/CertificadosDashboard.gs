/**
 * Dashboard público seguro + centro de controle administrativo de certificados NICE.
 * O endpoint público não expõe nome/e-mail. Ações administrativas exigem chave secreta
 * armazenada em Script Properties (CERT_DASHBOARD_ADMIN_KEY).
 */
const NICE_CERT_DASHBOARD = Object.freeze({
  ADMIN_KEY_PROPERTY:'CERT_DASHBOARD_ADMIN_KEY',
  OPEN_STATUS:'EMISSAO_ABERTA',
  CLOSED_STATUS:'EMISSAO_FECHADA',
  PUBLIC_BASE:'https://www.protocolo.me/certificados'
});

/** Execute uma vez no editor do Apps Script. Gera e mostra a chave do painel. */
function instalarPainelAdminCertificados(){
  const props=PropertiesService.getScriptProperties();
  let key=String(props.getProperty(NICE_CERT_DASHBOARD.ADMIN_KEY_PROPERTY)||'').trim();
  if(!key){
    key=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    props.setProperty(NICE_CERT_DASHBOARD.ADMIN_KEY_PROPERTY,key);
  }
  SpreadsheetApp.getUi().alert('Painel administrativo configurado.\n\nChave de acesso:\n'+key+'\n\nGuarde esta chave. Ela não deve ser publicada no GitHub.');
  return key;
}

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
      const tipoCert = String(niceApiCell_(values[i], h, 'TIPO_CERTIFICADO') || '').trim().toUpperCase();
      const customLinkId = String(niceApiCell_(values[i], h, 'CUSTOM_LINK_ID') || '').trim();
      if (!code) continue;
      if (status === 'REVOGADO') revogados++;
      if (['ENVIADO','ATIVO','REVOGADO'].includes(status)) enviados++;
      if(eventId) byEvent[eventId] = (byEvent[eventId] || 0) + (['ENVIADO','ATIVO','REVOGADO'].includes(status) ? 1 : 0);
      certs.push({
        codigo: code,
        evento_id: tipoCert==='CUSTOMIZADO'?(customLinkId||'CUSTOM'):String(eventId).padStart(4,'0'),
        status: status || 'SEM_STATUS',
        emitido_em: niceApiIso_(niceApiCell_(values[i], h, 'EMITIDO_EM')),
        validacao: NICE_CERT_DASHBOARD.PUBLIC_BASE + '/validar/?codigo=' + encodeURIComponent(code)
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
      if (status === NICE_CERT_DASHBOARD.OPEN_STATUS) abertos++;
      else fechados++;
      const id = String(idNum).padStart(4,'0');
      events.push({
        id,
        titulo: niceApiPublicText_(niceApiCell_(values[i], h, 'TITULO_EVENTO')),
        tipo: niceApiPublicText_(niceApiCell_(values[i], h, 'TIPO_EVENTO')),
        data_evento: niceApiIso_(niceApiCell_(values[i], h, 'DATA_EVENTO')),
        campus_unidade: niceApiPublicText_(niceApiCell_(values[i], h, 'CAMPUS_UNIDADE')),
        local: niceApiPublicText_(niceApiCell_(values[i], h, 'LOCAL')),
        carga_horaria: niceApiPublicText_(niceApiCell_(values[i], h, 'CARGA_HORARIA')),
        responsavel: niceApiPublicText_(niceApiCell_(values[i], h, 'RESPONSAVEL')),
        instituicao_emissora: niceApiPublicText_(niceApiCell_(values[i], h, 'INSTITUICAO_EMISSORA')),
        emissao_inicio: niceApiIso_(niceApiCell_(values[i], h, 'EMISSAO_INICIO')),
        emissao_fim: niceApiIso_(niceApiCell_(values[i], h, 'EMISSAO_FIM')),
        protocolo_nice: niceApiPublicText_(niceApiCell_(values[i], h, 'PROTOCOLO_NICE')),
        status: status || 'SEM_STATUS',
        certificados_emitidos: byEvent[idNum] || 0,
        url_publica: NICE_CERT_DASHBOARD.PUBLIC_BASE + '/' + id + '/'
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

/** Endpoint administrativo usado pelo dashboard. */
function niceCertDashboardAdmin_(params){
  const p=params||{};
  const key=String(p.admin_key||'').trim();
  niceCertDashboardRequireAdmin_(key);
  const op=String(p.op||'').trim().toLowerCase();
  if(op==='auth') return {ok:true,authorized:true};
  if(op==='create_event') return niceCertDashboardCreateEvent_(p);
  if(op==='set_status') return niceCertDashboardSetStatus_(p);
  if(op==='set_event_institution') return niceCertDashboardSetInstitution_(p);
  if(op==='create_custom_link') return niceCertCustomCreateLink_(p);
  if(op==='custom_links') return niceCertCustomAdminList_();
  if(op==='set_custom_status') return niceCertCustomSetStatus_(p);
  if(op==='regenerate_certificate') return niceCertRegenerateByCode_(p.code);
  if(op==='revoke_certificate') return niceCertRevokeByCode_(p.code,p.reason);
  return {ok:false,error:'Operação administrativa não reconhecida.'};
}

function niceCertDashboardRequireAdmin_(key){
  const saved=String(PropertiesService.getScriptProperties().getProperty(NICE_CERT_DASHBOARD.ADMIN_KEY_PROPERTY)||'').trim();
  if(!saved) throw new Error('Painel administrativo ainda não foi configurado. Execute instalarPainelAdminCertificados().');
  if(!key || key!==saved) throw new Error('Chave administrativa inválida.');
}

function niceCertDashboardCreateEvent_(p){
  const titulo=niceCertDashboardClean_(p.titulo,220);
  const tipo=niceCertDashboardClean_(p.tipo,120);
  const data=String(p.data||'').trim();
  const campus=niceCertDashboardClean_(p.campus,160);
  const local=niceCertDashboardClean_(p.local,180);
  const carga=niceCertDashboardClean_(p.carga,60);
  const responsavel=niceCertDashboardClean_(p.responsavel,180);
  const instituicao=niceCertDashboardClean_(p.instituicao_emissora||p.instituicao,160);
  const protocolo=niceCertDashboardClean_(p.protocolo,80).toUpperCase();
  const descricao=niceCertDashboardClean_(p.descricao,500);
  const inicio=niceCertParseLocalDateTime_(p.emissao_inicio);
  const fim=niceCertParseLocalDateTime_(p.emissao_fim);
  const abrir=String(p.abrir||'').toLowerCase()==='true'||String(p.abrir||'')==='1';
  if(titulo.length<3) return {ok:false,error:'Informe o título do evento.'};
  if(!data) return {ok:false,error:'Informe a data do evento.'};
  if(!instituicao) return {ok:false,error:'Informe a instituição emissora.'};
  if(String(p.emissao_inicio||'').trim()&&!inicio)return{ok:false,error:'Data/hora inicial da emissão inválida.'};
  if(String(p.emissao_fim||'').trim()&&!fim)return{ok:false,error:'Data/hora final da emissão inválida.'};
  if(inicio&&fim&&fim<=inicio)return{ok:false,error:'O fim da emissão deve ser posterior ao início.'};

  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try{
    const id=typeof niceCertPublicNextId_==='function'?niceCertPublicNextId_():niceCertNextEventId_();
    const code=String(id).padStart(4,'0');
    const dateObj=niceCertParseBrDate_(data)||new Date(data+'T12:00:00');
    if(!dateObj || isNaN(dateObj)) return {ok:false,error:'Data inválida.'};
    const folder=niceCertEventFolder_(id,titulo);
    const now=new Date();
    const event={
      EVENTO_ID:id,
      PROTOCOLO_NICE:protocolo,
      TITULO_EVENTO:titulo,
      TIPO_EVENTO:tipo,
      DATA_EVENTO:dateObj,
      CAMPUS_UNIDADE:campus,
      LOCAL:local,
      CARGA_HORARIA:carga,
      RESPONSAVEL:responsavel,
      INSTITUICAO_EMISSORA:instituicao,
      EMISSAO_INICIO:inicio||'',
      EMISSAO_FIM:fim||'',
      DESCRICAO:descricao,
      STATUS:abrir?NICE_CERT_DASHBOARD.OPEN_STATUS:NICE_CERT_DASHBOARD.CLOSED_STATUS,
      URL_PUBLICA:NICE_CERT_DASHBOARD.PUBLIC_BASE+'/'+code,
      PASTA_DRIVE:folder.getUrl(),
      CRIADO_EM:now,
      ATUALIZADO_EM:now
    };
    niceCertAppendObject_(niceCertEventsSheet_(),event);
    try{niceCertPublishEvent_(event)}catch(_){}
    if(typeof niceCertPublicEnsureEventPage_==='function') niceCertPublicEnsureEventPage_(code);
    if(typeof niceCertLog_==='function') niceCertLog_('EVENTO_CRIADO_DASHBOARD',id,'','Criado pelo dashboard administrativo.');
    return {ok:true,event:{id:code,titulo,url_publica:event.URL_PUBLICA,status:event.STATUS}};
  }finally{lock.releaseLock();}
}

function niceCertDashboardSetInstitution_(p){
  const id=Number(String(p.event_id||'').replace(/\D/g,''));
  const instituicao=niceCertDashboardClean_(p.instituicao_emissora||p.instituicao,160);
  if(!id)return{ok:false,error:'Evento inválido.'};
  if(!instituicao)return{ok:false,error:'Informe a instituição emissora.'};

  const sh=niceCertEventsSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return{ok:false,error:'Nenhum evento cadastrado.'};
  const m=niceCertHeaderMap_(v[0]);
  let found=false;
  for(let r=1;r<v.length;r++){
    if(Number(v[r][m.EVENTO_ID])!==id)continue;
    niceCertSetByMap_(sh,r+1,m,'INSTITUICAO_EMISSORA',instituicao);
    niceCertSetByMap_(sh,r+1,m,'ATUALIZADO_EM',new Date());
    found=true;
    break;
  }
  if(!found)return{ok:false,error:'Evento não encontrado.'};

  const ish=niceCertIssuesSheet_(),iv=ish.getDataRange().getValues(),im=niceCertHeaderMap_(iv[0]);
  let updated=0;
  for(let i=1;i<iv.length;i++){
    if(Number(iv[i][im.EVENTO_ID])!==id)continue;
    niceCertSetByMap_(ish,i+1,im,'INSTITUICAO_EMISSORA',instituicao);
    updated++;
  }

  const ev=niceCertFindEvent_(id);
  try{niceCertPublishEvent_(ev)}catch(_){}
  if(typeof niceCertPublicEnsureEventPage_==='function'){
    try{niceCertPublicEnsureEventPage_(String(id).padStart(4,'0'))}catch(_){}
  }
  if(typeof niceCertLog_==='function'){
    niceCertLog_('INSTITUICAO_EMISSORA_ATUALIZADA',id,'',instituicao+' · '+updated+' certificado(s) atualizado(s).');
  }

  return{ok:true,event_id:String(id).padStart(4,'0'),instituicao_emissora:instituicao,certificados_atualizados:updated};
}

function niceCertDashboardSetStatus_(p){
  const id=Number(String(p.event_id||'').replace(/\D/g,''));
  const wanted=String(p.status||'').trim().toUpperCase();
  if(!id) return {ok:false,error:'Evento inválido.'};
  if(![NICE_CERT_DASHBOARD.OPEN_STATUS,NICE_CERT_DASHBOARD.CLOSED_STATUS].includes(wanted)) return {ok:false,error:'Status inválido.'};
  const sh=niceCertEventsSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2) return {ok:false,error:'Nenhum evento cadastrado.'};
  const m=niceCertHeaderMap_(v[0]);
  for(let r=1;r<v.length;r++){
    if(Number(v[r][m.EVENTO_ID])!==id) continue;
    niceCertSetByMap_(sh,r+1,m,'STATUS',wanted);
    niceCertSetByMap_(sh,r+1,m,'ATUALIZADO_EM',new Date());
    const ev=niceCertFindEvent_(id);
    try{niceCertPublishEvent_(ev)}catch(_){}
    if(typeof niceCertPublicEnsureEventPage_==='function') niceCertPublicEnsureEventPage_(String(id).padStart(4,'0'));
    if(typeof niceCertLog_==='function') niceCertLog_(wanted,id,'','Alterado pelo dashboard administrativo.');
    return {ok:true,event_id:String(id).padStart(4,'0'),status:wanted,url_publica:NICE_CERT_DASHBOARD.PUBLIC_BASE+'/'+String(id).padStart(4,'0')+'/'};
  }
  return {ok:false,error:'Evento não encontrado.'};
}

function niceCertDashboardClean_(v,max){return String(v==null?'':v).replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max||300);}
