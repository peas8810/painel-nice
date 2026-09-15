/**
 * NICE Certificados — emissão pública/autônoma por evento.
 * URL pública sequencial: /certificados/0001, /0002, ...
 *
 * Fluxo:
 * página do evento -> nome + e-mail -> Apps Script -> PDF -> e-mail -> QR/validador.
 */

const NICE_CERT_PUBLIC = Object.freeze({
  PAD: 4,
  PUBLIC_BASE: 'https://www.protocolo.me/certificados',
  OWNER: 'peas8810',
  REPO: 'painel-nice',
  TOKEN_PROPERTY: 'GITHUB_SYNC_TOKEN',
  OPEN_STATUS: 'EMISSAO_ABERTA',
  CLOSED_STATUS: 'EMISSAO_FECHADA'
});

function instalarCertificadosPublicos(){
  if (typeof instalarSistemaCertificados === 'function') instalarSistemaCertificados();
  const ss=niceMaster_();
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='niceCertPublicOnOpen').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('niceCertPublicOnOpen').forSpreadsheet(ss).onOpen().create();
  niceCertPublicOnOpen();
  SpreadsheetApp.getUi().alert('Emissão pública instalada.\n\nOs eventos passam a usar URLs como /certificados/0001.');
}

function niceCertPublicOnOpen(){
  try{
    SpreadsheetApp.getUi().createMenu('NICE • Emissão Pública')
      .addItem('Criar novo evento público','criarEventoCertificacaoPublica')
      .addItem('Abrir emissão de um evento','abrirEmissaoCertificadosEvento')
      .addItem('Fechar emissão de um evento','fecharEmissaoCertificadosEvento')
      .addSeparator()
      .addItem('Recriar página pública do evento','recriarPaginaPublicaEvento')
      .addToUi();
  }catch(_){}
}

function criarEventoCertificacaoPublica(){
  const ui=SpreadsheetApp.getUi();
  const protocolo=niceCertPublicPrompt_(ui,'Novo evento público','Protocolo NICE (opcional). Ex.: NICE-2026-00023');
  if(protocolo===null)return;
  const base=typeof niceCertProtocolData_==='function'?niceCertProtocolData_(protocolo):{};
  const titulo=niceCertPublicPrompt_(ui,'Título do evento','Informe o título.\nSugestão: '+(base.titulo||'')); if(titulo===null)return;
  const tipo=niceCertPublicPrompt_(ui,'Tipo do evento','Ex.: Palestra, Curso, Congresso, Extensão.\nSugestão: '+(base.tipo||'')); if(tipo===null)return;
  const data=niceCertPublicPrompt_(ui,'Data do evento','Use DD/MM/AAAA.\nSugestão: '+(base.data||'')); if(data===null)return;
  const campus=niceCertPublicPrompt_(ui,'Campus / Unidade','Sugestão: '+(base.unidade||'')); if(campus===null)return;
  const local=niceCertPublicPrompt_(ui,'Local','Ex.: Auditório AlfaUnipac'); if(local===null)return;
  const carga=niceCertPublicPrompt_(ui,'Carga horária','Ex.: 4 horas'); if(carga===null)return;
  const responsavel=niceCertPublicPrompt_(ui,'Responsável','Sugestão: '+(base.responsavel||'')); if(responsavel===null)return;
  const descricao=niceCertPublicPrompt_(ui,'Descrição','Texto curto exibido na página pública.'); if(descricao===null)return;

  const id=niceCertPublicNextId_();
  const code=niceCertPublicFormatId_(id);
  const titleFinal=(titulo||base.titulo||('Evento '+code)).trim();
  const dateObj=(typeof niceCertParseBrDate_==='function'?niceCertParseBrDate_(data):null)||base.dateObj||'';
  const folder=typeof niceCertEventFolder_==='function'?niceCertEventFolder_(id,titleFinal):null;
  const now=new Date();
  const event={
    EVENTO_ID:id,
    PROTOCOLO_NICE:String(protocolo||'').trim().toUpperCase(),
    TITULO_EVENTO:titleFinal,
    TIPO_EVENTO:String(tipo||base.tipo||'').trim(),
    DATA_EVENTO:dateObj,
    CAMPUS_UNIDADE:String(campus||base.unidade||'').trim(),
    LOCAL:String(local||'').trim(),
    CARGA_HORARIA:String(carga||'').trim(),
    RESPONSAVEL:String(responsavel||base.responsavel||'').trim(),
    DESCRICAO:String(descricao||'').trim(),
    STATUS:NICE_CERT_PUBLIC.CLOSED_STATUS,
    URL_PUBLICA:NICE_CERT_PUBLIC.PUBLIC_BASE+'/'+code,
    PASTA_DRIVE:folder?folder.getUrl():'',
    CRIADO_EM:now,
    ATUALIZADO_EM:now
  };
  niceCertAppendObject_(niceCertEventsSheet_(),event);
  try{ if(typeof niceCertPublishEvent_==='function') niceCertPublishEvent_(event); }catch(_){}
  niceCertPublicEnsureEventPage_(code);
  if(typeof niceCertLog_==='function') niceCertLog_('EVENTO_PUBLICO_CRIADO',id,'','URL '+event.URL_PUBLICA);
  ui.alert('Evento '+code+' criado.\n\nPágina: '+event.URL_PUBLICA+'\n\nA emissão começa FECHADA. Use o menu para abrir quando quiser liberar os certificados.');
}

function abrirEmissaoCertificadosEvento(){niceCertPublicSetStatusFromPrompt_(NICE_CERT_PUBLIC.OPEN_STATUS);}
function fecharEmissaoCertificadosEvento(){niceCertPublicSetStatusFromPrompt_(NICE_CERT_PUBLIC.CLOSED_STATUS);}
function recriarPaginaPublicaEvento(){
  const ui=SpreadsheetApp.getUi();
  const txt=niceCertPublicPrompt_(ui,'Recriar página pública','Número do evento. Ex.: 1 ou 0001'); if(txt===null)return;
  const id=Number(String(txt).replace(/\D/g,'')); if(!id)return ui.alert('Evento inválido.');
  if(!niceCertFindEvent_(id))return ui.alert('Evento não encontrado.');
  niceCertPublicEnsureEventPage_(niceCertPublicFormatId_(id));
  ui.alert('Página pública recriada.');
}

function niceCertPublicSetStatusFromPrompt_(status){
  const ui=SpreadsheetApp.getUi();
  const txt=niceCertPublicPrompt_(ui,status===NICE_CERT_PUBLIC.OPEN_STATUS?'Abrir emissão':'Fechar emissão','Número do evento. Ex.: 1 ou 0001'); if(txt===null)return;
  const id=Number(String(txt).replace(/\D/g,'')); if(!id)return ui.alert('Evento inválido.');
  const sh=niceCertEventsSheet_(),v=sh.getDataRange().getValues(); if(v.length<2)return ui.alert('Nenhum evento cadastrado.');
  const m=niceCertHeaderMap_(v[0]);
  for(let r=1;r<v.length;r++){
    if(Number(v[r][m.EVENTO_ID])!==id)continue;
    niceCertSetByMap_(sh,r+1,m,'STATUS',status);
    niceCertSetByMap_(sh,r+1,m,'ATUALIZADO_EM',new Date());
    const ev=niceCertFindEvent_(id);
    try{ if(typeof niceCertPublishEvent_==='function') niceCertPublishEvent_(ev); }catch(_){}
    niceCertPublicEnsureEventPage_(niceCertPublicFormatId_(id));
    if(typeof niceCertLog_==='function') niceCertLog_(status==='EMISSAO_ABERTA'?'EMISSAO_ABERTA':'EMISSAO_FECHADA',id,'','Alteração manual.');
    return ui.alert('Evento '+niceCertPublicFormatId_(id)+': '+(status==='EMISSAO_ABERTA'?'emissão ABERTA.':'emissão FECHADA.'));
  }
  ui.alert('Evento não encontrado.');
}

/** Endpoint público: lista de eventos. */
function niceCertPublicEvents_(){
  const sh=niceCertEventsSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return{ok:true,events:[]};
  const m=niceCertHeaderMap_(v[0]),events=[];
  for(let r=v.length-1;r>=1;r--){
    const id=Number(v[r][m.EVENTO_ID]); if(!id)continue;
    events.push(niceCertPublicEventPayload_(niceCertFindEvent_(id)));
  }
  return{ok:true,events};
}

/** Endpoint público: dados do evento. */
function niceCertPublicEvent_(rawId){
  const id=Number(String(rawId||'').replace(/\D/g,''));
  if(!id)return{ok:false,error:'Evento inválido.'};
  const ev=niceCertFindEvent_(id);
  if(!ev)return{ok:false,error:'Evento não localizado.'};
  return{ok:true,event:niceCertPublicEventPayload_(ev)};
}

function niceCertPublicEventPayload_(ev){
  const id=Number(ev.EVENTO_ID);
  return{
    id:niceCertPublicFormatId_(id),
    id_num:id,
    titulo:String(ev.TITULO_EVENTO||''),
    tipo:String(ev.TIPO_EVENTO||''),
    data_evento:niceCertPublicIso_(ev.DATA_EVENTO),
    campus_unidade:String(ev.CAMPUS_UNIDADE||''),
    local:String(ev.LOCAL||''),
    carga_horaria:String(ev.CARGA_HORARIA||''),
    responsavel:String(ev.RESPONSAVEL||''),
    descricao:String(ev.DESCRICAO||''),
    protocolo_nice:String(ev.PROTOCOLO_NICE||''),
    status:String(ev.STATUS||''),
    emissao_aberta:String(ev.STATUS||'').toUpperCase()===NICE_CERT_PUBLIC.OPEN_STATUS,
    url:NICE_CERT_PUBLIC.PUBLIC_BASE+'/'+niceCertPublicFormatId_(id)
  };
}

/** Endpoint POST público: gera e envia o certificado. */
function niceCertPublicIssue_(params){
  const p=params||{};
  const id=Number(String(p.event_id||p.evento||'').replace(/\D/g,''));
  const nome=niceCertPublicClean_(p.name||p.nome,180);
  const email=String(p.email||'').trim().toLowerCase();
  if(!id)return{ok:false,error:'Evento inválido.'};
  if(nome.length<3)return{ok:false,error:'Informe seu nome completo.'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{ok:false,error:'Informe um e-mail válido.'};
  const ev=niceCertFindEvent_(id);
  if(!ev)return{ok:false,error:'Evento não localizado.'};
  if(String(ev.STATUS||'').toUpperCase()!==NICE_CERT_PUBLIC.OPEN_STATUS)return{ok:false,error:'A emissão de certificados deste evento não está disponível no momento.'};

  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try{
    const sh=niceCertIssuesSheet_();
    const v=sh.getDataRange().getValues();
    const m=niceCertHeaderMap_(v[0]);
    for(let r=1;r<v.length;r++){
      if(Number(v[r][m.EVENTO_ID])!==id)continue;
      if(String(v[r][m.EMAIL]||'').trim().toLowerCase()!==email)continue;
      const code=String(v[r][m.CODIGO]||'').trim();
      const status=String(v[r][m.STATUS]||'').trim().toUpperCase();
      if(code && status==='ENVIADO'){
        niceCertPublicResendExisting_(sh,r+1,m,ev,nome,email);
        if(typeof niceCertLog_==='function') niceCertLog_('CERTIFICADO_REENVIADO_PUBLICO',id,code,'Reenvio solicitado pelo próprio participante.');
        return{ok:true,sent:true,reused:true,code,event_id:niceCertPublicFormatId_(id),message:'Este certificado já existia e foi reenviado para o e-mail informado.'};
      }
      // Registro existente, mas ainda não concluído: tenta processar a mesma linha.
      if(typeof niceCertSetByMap_==='function') niceCertSetByMap_(sh,r+1,m,'NOME',nome);
      niceCertIssueRow_(sh,r+1,m,ev);
      return{ok:true,sent:true,reused:false,code:String(niceCertGetByMap_(sh,r+1,m,'CODIGO')||''),event_id:niceCertPublicFormatId_(id),message:'Certificado gerado e enviado.'};
    }

    niceCertAppendObject_(sh,{EVENTO_ID:id,NOME:nome,EMAIL:email,CARGA_HORARIA:ev.CARGA_HORARIA||'',STATUS:'PENDENTE'});
    const row=sh.getLastRow();
    const map=niceCertHeaderMap_(sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]);
    niceCertIssueRow_(sh,row,map,ev);
    const code=String(niceCertGetByMap_(sh,row,map,'CODIGO')||'');
    if(typeof niceCertLog_==='function') niceCertLog_('CERTIFICADO_AUTOEMITIDO',id,code,'Emissão pública para '+email);
    return{ok:true,sent:true,reused:false,code,event_id:niceCertPublicFormatId_(id),message:'Certificado gerado e enviado para o e-mail informado.'};
  }finally{lock.releaseLock();}
}

function niceCertPublicResendExisting_(sh,row,m,event,nome,email){
  const url=String(niceCertGetByMap_(sh,row,m,'PDF_URL')||'');
  const code=String(niceCertGetByMap_(sh,row,m,'CODIGO')||'');
  const fileId=niceCertPublicDriveId_(url);
  if(!fileId)throw new Error('PDF existente não localizado para reenvio.');
  const blob=DriveApp.getFileById(fileId).getBlob().setName(code+'.pdf');
  const verify=NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(code);
  MailApp.sendEmail({
    to:email,
    subject:'Seu certificado · '+String(event.TITULO_EVENTO||'Evento NICE'),
    body:'Olá, '+nome+'.\n\nSeu certificado está anexado.\n\nCódigo: '+code+'\nValidação: '+verify+'\n\nNICE · AlfaUnipac',
    htmlBody:'<p>Olá, <strong>'+niceCertPublicHtml_(nome)+'</strong>.</p><p>Seu certificado está anexado.</p><p><strong>Código:</strong> '+niceCertPublicHtml_(code)+'</p><p><a href="'+verify+'">Validar certificado</a></p><p>NICE · AlfaUnipac</p>',
    attachments:[blob],
    name:'NICE · Certificados'
  });
  niceCertSetByMap_(sh,row,m,'ENVIADO_EM',new Date());
  niceCertSetByMap_(sh,row,m,'TENTATIVAS_EMAIL',Number(niceCertGetByMap_(sh,row,m,'TENTATIVAS_EMAIL')||0)+1);
}

function niceCertPublicNextId_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=niceCertEventsSheet_();
    const v=sh.getDataRange().getValues(); let max=0;
    if(v.length>1){const m=niceCertHeaderMap_(v[0]);for(let r=1;r<v.length;r++)max=Math.max(max,Number(v[r][m.EVENTO_ID])||0);}
    const props=PropertiesService.getScriptProperties();
    const saved=Number(props.getProperty('CERT_PUBLIC_EVENT_SEQ')||0);
    const next=Math.max(max,saved)+1;
    props.setProperty('CERT_PUBLIC_EVENT_SEQ',String(next));
    return next;
  }finally{lock.releaseLock();}
}

function niceCertPublicEnsureEventPage_(code){
  const token=PropertiesService.getScriptProperties().getProperty(NICE_CERT_PUBLIC.TOKEN_PROPERTY);
  if(!token)throw new Error('GITHUB_SYNC_TOKEN não configurado.');
  const path='certificados/'+code+'/index.html';
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17365d"><link rel="icon" type="image/svg+xml" href="/assets/amonia-logo.svg"><title>Certificado · Evento '+code+'</title><link rel="stylesheet" href="/certificados/styles.css"></head><body><header class="top"><div class="top-inner"><a class="brand" href="/certificados/"><img src="/assets/amonia-logo.svg" alt=""><div><strong>Certificados NICE</strong><span>Emissão, rastreabilidade e validação digital</span></div></a><nav><a href="/protocolos/">Protocolos</a><a class="primary" href="/certificados/validar/">Validar certificado</a></nav></div></header><main class="container"><section class="hero"><div><span class="eyebrow">CERTIFICAÇÃO INSTITUCIONAL</span><h1>Emissão de certificado</h1><p>Informe seus dados exatamente como devem aparecer no documento.</p></div><div class="hero-badge"><strong>Evento '+code+'</strong><span>QR + validação pública</span></div></section><section id="content" class="card loading">Carregando evento…</section></main><footer>PEAS - Technology®</footer><script src="/certificados/config.js"></script><script src="/certificados/app.js"></script></body></html>';
  niceCertPublicGithubPut_(path,html,'chore: publica evento de certificado '+code,token);
}

function niceCertPublicGithubPut_(path,content,message,token){
  const api='https://api.github.com/repos/'+NICE_CERT_PUBLIC.OWNER+'/'+NICE_CERT_PUBLIC.REPO+'/contents/'+path;
  const headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
  let sha='';
  const get=UrlFetchApp.fetch(api,{method:'get',headers,muteHttpExceptions:true});
  if(get.getResponseCode()===200){try{sha=JSON.parse(get.getContentText()).sha||'';}catch(_){}}
  const body={message,content:Utilities.base64Encode(content,Utilities.Charset.UTF_8)}; if(sha)body.sha=sha;
  const put=UrlFetchApp.fetch(api,{method:'put',headers,contentType:'application/json',payload:JSON.stringify(body),muteHttpExceptions:true});
  if(![200,201].includes(put.getResponseCode()))throw new Error('Falha ao publicar página no GitHub: HTTP '+put.getResponseCode()+' '+put.getContentText());
}

function niceCertPublicFormatId_(id){return String(Number(id)||0).padStart(NICE_CERT_PUBLIC.PAD,'0');}
function niceCertPublicIso_(v){if(!v)return'';const d=v instanceof Date?v:new Date(v);return isNaN(d)?'':d.toISOString();}
function niceCertPublicPrompt_(ui,title,text){const r=ui.prompt(title,text,ui.ButtonSet.OK_CANCEL);return r.getSelectedButton()===ui.Button.OK?r.getResponseText():null;}
function niceCertPublicClean_(v,max){return String(v||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,max||200);}
function niceCertPublicHtml_(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function niceCertPublicDriveId_(url){const m=String(url||'').match(/[-\w]{20,}/);return m?m[0]:'';}
