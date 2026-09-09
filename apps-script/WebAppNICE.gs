const NICE_API = Object.freeze({
  SPREADSHEET_ID: '1midUEo4zaK2uyI_bJvD2NK2Efy1gYC0Ny_qHVJw_CVE',
  CONTROL_SHEET: 'CONTROLE_NICE',
  CACHE_SECONDS: 30
});

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'health').toLowerCase();
  try {
    let payload;
    if (action === 'health') payload = niceApiHealth_();
    else if (action === 'stats') payload = niceApiStats_();
    else if (action === 'protocol') payload = niceApiProtocol_(String(p.id || '').toUpperCase());
    else payload = {ok:false,error:'Ação não reconhecida.'};
    return niceApiOutput_(payload, p.callback);
  } catch (err) {
    return niceApiOutput_({ok:false,error:'Falha interna da API NICE.'}, p.callback);
  }
}

function niceApiHealth_() {
  const sh = niceApiSheet_();
  return {ok:true,service:'NICE Protocolos',version:'1.0',rows:Math.max(0,sh.getLastRow()-1),updated_at:new Date().toISOString()};
}

function niceApiStats_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('nice_api_stats_v1');
  if (cached) return JSON.parse(cached);
  const sh = niceApiSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return {ok:true,stats:{abertos:0,aguardando_relatorio:0,atrasados:0,finalizados:0,por_status:{}}};
  const h = niceApiMapHeaders_(values[0]);
  const counts = {};
  let abertos=0,aguardando=0,atrasados=0,finalizados=0;
  for (let i=1;i<values.length;i++) {
    const id = String(values[i][h.ID_NICE] || '').trim();
    if (!id) continue;
    const status = String(values[i][h.STATUS] || 'SEM_STATUS').trim().toUpperCase();
    counts[status]=(counts[status]||0)+1;
    if (!['FINALIZADO','CANCELADO'].includes(status)) abertos++;
    if (status==='AGUARDANDO_RELATORIO') aguardando++;
    if (status==='RELATORIO_EM_ATRASO') atrasados++;
    if (status==='FINALIZADO') finalizados++;
  }
  const out={ok:true,stats:{abertos,aguardando_relatorio:aguardando,atrasados,finalizados,por_status:counts}};
  cache.put('nice_api_stats_v1',JSON.stringify(out),NICE_API.CACHE_SECONDS);
  return out;
}

function niceApiProtocol_(id) {
  if (!/^NICE-\d{4}-\d{5}$/.test(id)) return {ok:false,error:'Protocolo inválido. Use NICE-AAAA-00000.'};
  const sh=niceApiSheet_();
  if (sh.getLastRow()<2) return {ok:true,protocol:null};
  const values=sh.getDataRange().getValues();
  const h=niceApiMapHeaders_(values[0]);
  for (let i=1;i<values.length;i++) {
    if (String(values[i][h.ID_NICE]||'').trim().toUpperCase()!==id) continue;
    const status=String(values[i][h.STATUS]||'').toUpperCase();
    const dataRelatorio=niceApiIso_(values[i][h.DATA_RELATORIO]);
    const encerradoRaw=String(values[i][h.ENCERRADO]||'').toUpperCase();
    return {ok:true,protocol:{
      id,
      status,
      titulo:niceApiPublicText_(values[i][h.TITULO_ACAO]),
      curso:niceApiPublicText_(values[i][h.CURSO]),
      unidade:niceApiPublicText_(values[i][h.UNIDADE]),
      data_protocolo:niceApiIso_(values[i][h.DATA_PROTOCOLO]),
      data_inicio:niceApiIso_(values[i][h.DATA_INICIO]),
      data_fim:niceApiIso_(values[i][h.DATA_FIM]),
      prazo_relatorio:niceApiIso_(values[i][h.PRAZO_RELATORIO]),
      data_relatorio:dataRelatorio,
      relatorio_recebido:!!dataRelatorio,
      encerrado:encerradoRaw==='SIM'||status==='FINALIZADO',
      link_form_relatorio:niceApiSafePublicUrl_(values[i][h.LINK_FORM_RELATORIO])
    }};
  }
  return {ok:true,protocol:null};
}

function niceApiSheet_() {
  const ss=SpreadsheetApp.openById(NICE_API.SPREADSHEET_ID);
  const sh=ss.getSheetByName(NICE_API.CONTROL_SHEET);
  if (!sh) throw new Error('CONTROLE_NICE não encontrada.');
  return sh;
}

function niceApiMapHeaders_(headers) {
  const out={}; headers.forEach((v,i)=>out[String(v).trim()]=i); return out;
}

function niceApiIso_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v)) return v.toISOString();
  const d=new Date(v); return isNaN(d)?'':d.toISOString();
}

function niceApiPublicText_(v) {
  return String(v==null?'':v).replace(/[<>]/g,'').trim().slice(0,300);
}

function niceApiSafePublicUrl_(v) {
  const s=String(v||'').trim();
  if (/^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(s)) return s;
  return '';
}

function niceApiOutput_(obj,callback) {
  const json=JSON.stringify(obj);
  const cb=String(callback||'').trim();
  if (cb&&/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(cb)) return ContentService.createTextOutput(cb+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
