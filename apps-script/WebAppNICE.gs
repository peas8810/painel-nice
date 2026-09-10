const NICE_API = Object.freeze({
  SPREADSHEET_ID: '1midUEo4zaK2uyI_bJvD2NK2Efy1gYC0Ny_qHVJw_CVE',
  CONTROL_SHEET: 'CONTROLE_NICE',
  CACHE_SECONDS: 30,
  PUBLIC_LIST_LIMIT: 500
});

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'health').toLowerCase();
  const transport = String(p.transport || '').toLowerCase();

  try {
    let payload;
    if (action === 'health') payload = niceApiHealth_();
    else if (action === 'stats') payload = niceApiStats_();
    else if (action === 'protocol') payload = niceApiProtocol_(String(p.id || '').toUpperCase());
    else if (action === 'projects') payload = niceApiProjects_(String(p.q || ''), String(p.status || ''), Number(p.limit || NICE_API.PUBLIC_LIST_LIMIT));
    else payload = {ok:false,error:'Ação não reconhecida.'};

    if (transport === 'bridge') return niceApiBridgeOutput_(payload, p.request_id);
    return niceApiOutput_(payload, p.callback);
  } catch (err) {
    const payload = {ok:false,error:'Falha interna da API NICE.'};
    if (transport === 'bridge') return niceApiBridgeOutput_(payload, p.request_id);
    return niceApiOutput_(payload, p.callback);
  }
}

function niceApiHealth_() {
  const sh = niceApiSheet_();
  return {ok:true,service:'NICE Protocolos',version:'1.3',rows:Math.max(0,sh.getLastRow()-1),updated_at:new Date().toISOString(),transport:'bridge'};
}

function niceApiStats_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('nice_api_stats_v3');
  if (cached) return JSON.parse(cached);
  const sh = niceApiSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return {ok:true,stats:{abertos:0,aguardando_relatorio:0,atrasados:0,finalizados:0,por_status:{}}};
  const h = niceApiMapHeaders_(values[0]);
  const counts = {};
  let abertos=0,aguardando=0,atrasados=0,finalizados=0;
  for (let i=1;i<values.length;i++) {
    const id = niceApiCell_(values[i], h, 'ID_NICE');
    if (!id) continue;
    const status = String(niceApiCell_(values[i], h, 'STATUS') || 'SEM_STATUS').trim().toUpperCase();
    counts[status]=(counts[status]||0)+1;
    if (!['FINALIZADO','CANCELADO'].includes(status)) abertos++;
    if (status==='AGUARDANDO_RELATORIO') aguardando++;
    if (status==='RELATORIO_EM_ATRASO') atrasados++;
    if (status==='FINALIZADO') finalizados++;
  }
  const out={ok:true,stats:{abertos,aguardando_relatorio:aguardando,atrasados,finalizados,por_status:counts}};
  cache.put('nice_api_stats_v3',JSON.stringify(out),NICE_API.CACHE_SECONDS);
  return out;
}

function niceApiProjects_(q, statusFilter, limit) {
  const sh = niceApiSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return {ok:true,total:0,projects:[]};
  const h = niceApiMapHeaders_(values[0]);
  const query = niceApiNorm_(q);
  const wantedStatus = String(statusFilter || '').trim().toUpperCase();
  const max = Math.min(Math.max(Number(limit) || NICE_API.PUBLIC_LIST_LIMIT, 1), NICE_API.PUBLIC_LIST_LIMIT);
  const projects = [];
  for (let i=values.length-1;i>=1;i--) {
    const row = values[i];
    const id = String(niceApiCell_(row,h,'ID_NICE') || '').trim().toUpperCase();
    if (!id) continue;
    const status = String(niceApiCell_(row,h,'STATUS') || '').trim().toUpperCase();
    if (wantedStatus && status !== wantedStatus) continue;
    const responsavel = niceApiPublicText_(niceApiCell_(row,h,'RESPONSAVEL'));
    const titulo = niceApiPublicText_(niceApiCell_(row,h,'TITULO_ACAO'));
    const curso = niceApiPublicText_(niceApiCell_(row,h,'CURSO'));
    const unidade = niceApiPublicText_(niceApiCell_(row,h,'UNIDADE'));
    const auditorio = niceApiPublicText_(niceApiCell_(row,h,'AUDITORIO'));
    if (query) {
      const haystack = niceApiNorm_([id,responsavel,titulo,curso,unidade,auditorio,status].join(' '));
      if (!haystack.includes(query)) continue;
    }
    projects.push({id,responsavel,titulo,curso,unidade,auditorio,status,
      data_protocolo:niceApiIso_(niceApiCell_(row,h,'DATA_PROTOCOLO')),
      data_inicio:niceApiIso_(niceApiCell_(row,h,'DATA_INICIO')),
      prazo_relatorio:niceApiIso_(niceApiCell_(row,h,'PRAZO_RELATORIO'))});
    if (projects.length >= max) break;
  }
  return {ok:true,total:projects.length,projects,public_fields:['id','responsavel','titulo','curso','unidade','auditorio','status','data_protocolo','data_inicio','prazo_relatorio']};
}

function niceApiProtocol_(id) {
  if (!/^NICE-\d{4}-\d{5}$/.test(id)) return {ok:false,error:'Protocolo inválido. Use NICE-AAAA-00000.'};
  const sh=niceApiSheet_();
  if (sh.getLastRow()<2) return {ok:true,protocol:null};
  const values=sh.getDataRange().getValues();
  const h=niceApiMapHeaders_(values[0]);
  for (let i=1;i<values.length;i++) {
    if (String(niceApiCell_(values[i],h,'ID_NICE')||'').trim().toUpperCase()!==id) continue;
    const status=String(niceApiCell_(values[i],h,'STATUS')||'').toUpperCase();
    const dataRelatorio=niceApiIso_(niceApiCell_(values[i],h,'DATA_RELATORIO'));
    const encerradoRaw=String(niceApiCell_(values[i],h,'ENCERRADO')||'').toUpperCase();
    return {ok:true,protocol:{
      id,status,
      responsavel:niceApiPublicText_(niceApiCell_(values[i],h,'RESPONSAVEL')),
      titulo:niceApiPublicText_(niceApiCell_(values[i],h,'TITULO_ACAO')),
      curso:niceApiPublicText_(niceApiCell_(values[i],h,'CURSO')),
      unidade:niceApiPublicText_(niceApiCell_(values[i],h,'UNIDADE')),
      auditorio:niceApiPublicText_(niceApiCell_(values[i],h,'AUDITORIO')),
      data_protocolo:niceApiIso_(niceApiCell_(values[i],h,'DATA_PROTOCOLO')),
      data_inicio:niceApiIso_(niceApiCell_(values[i],h,'DATA_INICIO')),
      data_fim:niceApiIso_(niceApiCell_(values[i],h,'DATA_FIM')),
      prazo_relatorio:niceApiIso_(niceApiCell_(values[i],h,'PRAZO_RELATORIO')),
      data_relatorio:dataRelatorio,
      relatorio_recebido:!!dataRelatorio,
      encerrado:encerradoRaw==='SIM'||status==='FINALIZADO',
      link_form_relatorio:niceApiSafePublicUrl_(niceApiCell_(values[i],h,'LINK_FORM_RELATORIO'))
    }};
  }
  return {ok:true,protocol:null};
}

function niceApiSheet_() {const ss=SpreadsheetApp.openById(NICE_API.SPREADSHEET_ID);const sh=ss.getSheetByName(NICE_API.CONTROL_SHEET);if (!sh) throw new Error('CONTROLE_NICE não encontrada.');return sh;}
function niceApiMapHeaders_(headers) {const out={}; headers.forEach((v,i)=>out[String(v).trim()]=i); return out;}
function niceApiCell_(row, h, name) {return Object.prototype.hasOwnProperty.call(h,name) ? row[h[name]] : '';}
function niceApiIso_(v) {if (!v) return '';if (Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.toISOString();const d=new Date(v); return isNaN(d)?'':d.toISOString();}
function niceApiPublicText_(v) {return String(v==null?'':v).replace(/[<>]/g,'').trim().slice(0,300);}
function niceApiNorm_(v) {return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function niceApiSafePublicUrl_(v) {const s=String(v||'').trim();if (/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(s)) return s;return '';}
function niceApiOutput_(obj,callback) {const json=JSON.stringify(obj);const cb=String(callback||'').trim();if (cb&&/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(cb)) {return ContentService.createTextOutput(cb+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);}return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);}
function niceApiBridgeOutput_(obj, requestId) {const rid = String(requestId || '').replace(/[^A-Za-z0-9_-]/g,'').slice(0,120);const safeJson = JSON.stringify(obj).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');const ridJson = JSON.stringify(rid);const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>(function(){var message={source:"NICE_API_BRIDGE",request_id:' + ridJson + ',payload:' + safeJson + '};try{window.parent.postMessage(message,"*");}catch(e){}try{if(window.top!==window.parent){window.top.postMessage(message,"*");}}catch(e){}})();<\\/script></body></html>';return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
