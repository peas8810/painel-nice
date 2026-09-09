const NICE = Object.freeze({
  FORMALIZACAO_SPREADSHEET_ID:'1midUEo4zaK2uyI_bJvD2NK2Efy1gYC0Ny_qHVJw_CVE',
  RELATORIO_SPREADSHEET_ID:'1M6I6Wc1d0IehylAbQ1Equ-NJ1_jZrwRhowuWZ6roBJk',
  CONTROLE:'CONTROLE_NICE', CONFIG:'CONFIG_NICE', HISTORICO:'HISTORICO_NICE', LOG:'LOG_NICE', PREFIXO:'NICE',
  STATUS:['PROTOCOLADO','EM_ANALISE','APROVADO','AGUARDANDO_REALIZACAO','AGUARDANDO_RELATORIO','RELATORIO_EM_ATRASO','FINALIZADO','CANCELADO'],
  HEADERS:['ID_NICE','STATUS','DATA_PROTOCOLO','TIPO_ACAO','CURSO','UNIDADE','RESPONSAVEL','EMAIL','TITULO_ACAO','DATA_INICIO','DATA_FIM','PRAZO_RELATORIO','DATA_RELATORIO','DATA_ENCERRAMENTO','DIAS_PENDENTE','ENCERRADO','LINK_PASTA','LINK_PROTOCOLO','LINK_RELATORIO','LINK_FORM_RELATORIO','PLANILHA_ORIGEM','ABA_ORIGEM','LINHA_ORIGEM','ULTIMA_ATUALIZACAO','OBSERVACOES']
});

function onOpen(){
  SpreadsheetApp.getUi().createMenu('NICE • Protocolos')
    .addItem('Instalar / atualizar estrutura','instalarEstruturaNICE')
    .addItem('Adicionar campo ID no Form de Relatório','adicionarCampoIdNoFormularioRelatorio')
    .addItem('Reinstalar gatilhos','instalarGatilhosNICE')
    .addSeparator()
    .addItem('Atualizar status agora','atualizarStatusDiario')
    .addItem('Aprovar linhas selecionadas','aprovarLinhasSelecionadas')
    .addToUi();
}

function instalarEstruturaNICE(){
  const ss=niceMaster_();
  niceSheet_(ss,NICE.CONTROLE,NICE.HEADERS);
  niceSheet_(ss,NICE.HISTORICO,['DATA_HORA','ID_NICE','STATUS_ANTERIOR','STATUS_NOVO','ORIGEM','USUARIO','OBSERVACAO']);
  niceSheet_(ss,NICE.LOG,['DATA_HORA','NIVEL','ROTINA','ID_NICE','MENSAGEM']);
  const cfg=niceSheet_(ss,NICE.CONFIG,['CHAVE','VALOR','DESCRICAO']);
  nicePutConfig_(cfg,[
    ['PRAZO_RELATORIO_DIAS','10','Dias corridos após a data final da ação.'],
    ['ROOT_FOLDER_ID','','ID da pasta raiz institucional do NICE no Drive.'],
    ['FECHAR_AO_RECEBER_RELATORIO','SIM','SIM fecha o chamado quando o relatório é recebido.'],
    ['CRIAR_PASTAS_DRIVE','SIM','Cria a estrutura documental quando ROOT_FOLDER_ID estiver configurado.']
  ]);
  instalarGatilhosNICE();
  SpreadsheetApp.getUi().alert('Estrutura NICE instalada. Preencha ROOT_FOLDER_ID em CONFIG_NICE e faça um protocolo de teste.');
}

function instalarGatilhosNICE(){
  const names=new Set(['onProtocolFormSubmit','onReportFormSubmit','atualizarStatusDiario']);
  ScriptApp.getProjectTriggers().forEach(t=>{if(names.has(t.getHandlerFunction()))ScriptApp.deleteTrigger(t)});
  ScriptApp.newTrigger('onProtocolFormSubmit').forSpreadsheet(SpreadsheetApp.openById(NICE.FORMALIZACAO_SPREADSHEET_ID)).onFormSubmit().create();
  ScriptApp.newTrigger('onReportFormSubmit').forSpreadsheet(SpreadsheetApp.openById(NICE.RELATORIO_SPREADSHEET_ID)).onFormSubmit().create();
  ScriptApp.newTrigger('atualizarStatusDiario').timeBased().everyDays(1).atHour(7).create();
  niceLog_('INFO','instalarGatilhosNICE','','Gatilhos instalados.');
}

function adicionarCampoIdNoFormularioRelatorio(){
  const ss=SpreadsheetApp.openById(NICE.RELATORIO_SPREADSHEET_ID),url=ss.getFormUrl();
  if(!url)throw new Error('A planilha de relatórios não está vinculada a um Google Forms.');
  const form=FormApp.openByUrl(url),title='Número do protocolo NICE';
  if(form.getItems().some(i=>niceNorm_(i.getTitle())===niceNorm_(title))){SpreadsheetApp.getUi().alert('O campo já existe.');return}
  const val=FormApp.createTextValidation().requireTextMatchesPattern('^NICE-[0-9]{4}-[0-9]{5}$').setHelpText('Exemplo: NICE-2026-00001.').build();
  form.addTextItem().setTitle(title).setHelpText('Informe o protocolo recebido na formalização.').setRequired(true).setValidation(val);
  SpreadsheetApp.getUi().alert('Campo de protocolo criado no formulário de relatório final.');
}

function onProtocolFormSubmit(e){
  try{
    const sh=e.range.getSheet(),row=e.range.getRow();
    const already=niceReadHelper_(sh,row,'ID_NICE'); if(niceExtractId_([already]))return;
    const d=niceRow_(sh,row);
    const stamp=niceDate_(niceValue_(d,['Carimbo de data/hora','Timestamp','Data e hora']))||new Date();
    const id=niceGenerateId_(stamp.getFullYear());
    const tipo=niceValue_(d,['Defina qual o tipo do evento','Tipo do evento','Tipo de evento','Tipo da ação','Tipo da atividade']);
    const curso=niceValue_(d,['Curso','Cursos','Qual curso','Curso(s)','Curso responsável']);
    const unidade=niceValue_(d,['Unidade','Campus','Unidade/campus','Polo']);
    const responsavel=niceValue_(d,['Professor responsável','Responsável','Nome do responsável','Coordenador responsável','Docente','Nome completo']);
    const email=niceEmail_(d);
    const titulo=niceValue_(d,['Identificação do evento','Identificação do projeto','Nome do evento','Nome do projeto','Título do evento','Título da ação','Tema do evento','Tema','Título'])||tipo||'Ação institucional';
    const inicio=niceDate_(niceValue_(d,['Data de início','Data início','Data do evento','Data da realização','Data de realização','Início do evento']));
    const fim=niceDate_(niceValue_(d,['Data de término','Data final','Data fim','Término do evento','Fim do evento']))||inicio;
    const prazo=fim?niceAddDays_(fim,Number(niceConfig_('PRAZO_RELATORIO_DIAS','10'))||10):'';
    const folder=niceCreateDrive_(id,titulo,stamp.getFullYear());
    const reportUrl=niceReportUrl_(id);
    niceWriteHelper_(sh,row,'ID_NICE',id); niceWriteHelper_(sh,row,'STATUS_NICE','PROTOCOLADO');
    niceWriteHelper_(sh,row,'LINK_PASTA_NICE',folder.url||''); niceWriteHelper_(sh,row,'LINK_RELATORIO_NICE',reportUrl||'');
    niceAppend_(niceControl_(),{
      ID_NICE:id,STATUS:'PROTOCOLADO',DATA_PROTOCOLO:stamp,TIPO_ACAO:tipo,CURSO:curso,UNIDADE:unidade,RESPONSAVEL:responsavel,EMAIL:email,TITULO_ACAO:titulo,
      DATA_INICIO:inicio||'',DATA_FIM:fim||'',PRAZO_RELATORIO:prazo,ENCERRADO:'NAO',LINK_PASTA:folder.url||'',LINK_FORM_RELATORIO:reportUrl||'',PLANILHA_ORIGEM:NICE.FORMALIZACAO_SPREADSHEET_ID,ABA_ORIGEM:sh.getName(),LINHA_ORIGEM:row,ULTIMA_ATUALIZACAO:new Date()
    });
    niceHistory_(id,'','PROTOCOLADO','FORMULARIO_PROTOCOLO','Chamado criado automaticamente.');
  }catch(err){niceLog_('ERRO','onProtocolFormSubmit','',err.stack||err.message);throw err}
}

function onReportFormSubmit(e){
  try{
    const sh=e.range.getSheet(),row=e.range.getRow(),d=niceRow_(sh,row);
    let id=niceExtractId_([niceValue_(d,['Número do protocolo NICE','Numero do protocolo NICE','Protocolo NICE','ID NICE','ID_NICE'])])||niceExtractId_(Object.values(d));
    if(!id){niceWriteHelper_(sh,row,'STATUS_NICE','SEM_PROTOCOLO_NICE');return}
    const found=niceFind_(id);
    if(!found){niceWriteHelper_(sh,row,'STATUS_NICE','PROTOCOLO_NAO_LOCALIZADO');niceWriteHelper_(sh,row,'VINCULO_NICE',id);return}
    const c=found.sheet,m=niceMap_(c),old=niceAt_(c,found.row,m.STATUS),folder=niceAt_(c,found.row,m.LINK_PASTA),urls=niceDriveUrls_(d),now=new Date();
    if(folder&&urls.length){try{niceMoveReport_(urls,folder)}catch(x){niceLog_('ALERTA','niceMoveReport_',id,x.message)}}
    const close=niceBool_('FECHAR_AO_RECEBER_RELATORIO',true),status=close?'FINALIZADO':'RELATORIO_RECEBIDO';
    niceSet_(c,found.row,m.DATA_RELATORIO,now); niceSet_(c,found.row,m.LINK_RELATORIO,urls.join(' ; ')); niceSet_(c,found.row,m.STATUS,status);
    niceSet_(c,found.row,m.ENCERRADO,close?'SIM':'NAO'); niceSet_(c,found.row,m.DATA_ENCERRAMENTO,close?now:''); niceSet_(c,found.row,m.DIAS_PENDENTE,0); niceSet_(c,found.row,m.ULTIMA_ATUALIZACAO,now);
    niceWriteHelper_(sh,row,'STATUS_NICE',status); niceWriteHelper_(sh,row,'VINCULO_NICE',id); niceWriteHelper_(sh,row,'LINK_PASTA_NICE',folder||'');
    niceHistory_(id,old,status,'FORMULARIO_RELATORIO','Relatório final vinculado.');
  }catch(err){niceLog_('ERRO','onReportFormSubmit','',err.stack||err.message);throw err}
}

function atualizarStatusDiario(){
  const sh=niceControl_(),v=sh.getDataRange().getValues(); if(v.length<2)return;
  const h={};v[0].forEach((x,i)=>h[String(x)]=i); const today=niceDay_(new Date());
  for(let r=1;r<v.length;r++){
    const x=v[r],id=x[h.ID_NICE];if(!id)continue;let old=String(x[h.STATUS]||'');if(['FINALIZADO','CANCELADO'].includes(old))continue;
    const inicio=niceDate_(x[h.DATA_INICIO]),fim=niceDate_(x[h.DATA_FIM])||inicio,prazo=niceDate_(x[h.PRAZO_RELATORIO]);let status=old,days=0;
    if(x[h.DATA_RELATORIO])status='FINALIZADO';
    else if(['APROVADO','AGUARDANDO_REALIZACAO','AGUARDANDO_RELATORIO','RELATORIO_EM_ATRASO'].includes(old)){
      if(fim&&niceDay_(fim)<today){status=prazo&&niceDay_(prazo)<today?'RELATORIO_EM_ATRASO':'AGUARDANDO_RELATORIO';days=Math.max(0,niceDiff_(today,niceDay_(fim)))}
      else if(inicio&&niceDay_(inicio)>=today)status='AGUARDANDO_REALIZACAO';
    }
    if(status!==old){x[h.STATUS]=status;niceHistory_(id,old,status,'ROTINA_DIARIA','Atualização automática por prazo.')}
    x[h.DIAS_PENDENTE]=days;x[h.ULTIMA_ATUALIZACAO]=new Date();if(status==='FINALIZADO'){x[h.ENCERRADO]='SIM';if(!x[h.DATA_ENCERRAMENTO])x[h.DATA_ENCERRAMENTO]=new Date()}
  }
  sh.getRange(2,1,v.length-1,v[0].length).setValues(v.slice(1));
}

function aprovarLinhasSelecionadas(){
  const sh=SpreadsheetApp.getActive().getActiveSheet();if(sh.getName()!==NICE.CONTROLE){SpreadsheetApp.getUi().alert('Selecione linhas na aba CONTROLE_NICE.');return}
  const rg=sh.getActiveRange(),m=niceMap_(sh);for(let r=rg.getRow();r<=rg.getLastRow();r++){if(r===1)continue;const id=niceAt_(sh,r,m.ID_NICE);if(!id)continue;const old=niceAt_(sh,r,m.STATUS);niceSet_(sh,r,m.STATUS,'APROVADO');niceSet_(sh,r,m.ULTIMA_ATUALIZACAO,new Date());niceHistory_(id,old,'APROVADO','GESTAO_NICE','Aprovação manual.')};atualizarStatusDiario();
}

function niceCreateDrive_(id,title,year){
  if(!niceBool_('CRIAR_PASTAS_DRIVE',true))return{url:'',id:''};const rootId=String(niceConfig_('ROOT_FOLDER_ID','')).trim();if(!rootId)return{url:'',id:''};
  const root=DriveApp.getFolderById(rootId),yf=niceFolder_(root,String(year)),pf=niceFolder_(yf,niceSafe_(id+' - '+title).slice(0,180));
  ['01_Protocolo','02_Anexos','03_Relatorio_Final','04_Evidencias'].forEach(n=>niceFolder_(pf,n));return{url:pf.getUrl(),id:pf.getId()};
}
function niceMoveReport_(urls,folderUrl){const id=niceDriveId_(folderUrl);if(!id)return;const dest=niceFolder_(DriveApp.getFolderById(id),'03_Relatorio_Final');urls.forEach(u=>{const f=niceDriveId_(u);if(f)DriveApp.getFileById(f).moveTo(dest)})}
function niceFolder_(p,n){const it=p.getFoldersByName(n);return it.hasNext()?it.next():p.createFolder(n)}

function niceReportUrl_(id){try{const ss=SpreadsheetApp.openById(NICE.RELATORIO_SPREADSHEET_ID),url=ss.getFormUrl();if(!url)return'';const form=FormApp.openByUrl(url),item=form.getItems(FormApp.ItemType.TEXT).map(i=>i.asTextItem()).find(i=>niceNorm_(i.getTitle())===niceNorm_('Número do protocolo NICE'));if(!item)return form.getPublishedUrl();const res=form.createResponse();res.withItemResponse(item.createResponse(id));return res.toPrefilledUrl()}catch(_){return''}}
function niceGenerateId_(year){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const sh=niceControl_(),m=niceMap_(sh);let max=0;if(sh.getLastRow()>=2){const re=new RegExp('^'+NICE.PREFIXO+'-'+year+'-([0-9]{5})$');sh.getRange(2,m.ID_NICE,sh.getLastRow()-1,1).getDisplayValues().flat().forEach(id=>{const x=String(id).match(re);if(x)max=Math.max(max,Number(x[1]))})}const props=PropertiesService.getScriptProperties(),key='SEQ_'+year,p=Number(props.getProperty(key)||0),next=Math.max(max,p)+1;props.setProperty(key,String(next));return NICE.PREFIXO+'-'+year+'-'+String(next).padStart(5,'0')}finally{lock.releaseLock()}}

function niceMaster_(){return SpreadsheetApp.openById(NICE.FORMALIZACAO_SPREADSHEET_ID)}
function niceControl_(){const sh=niceMaster_().getSheetByName(NICE.CONTROLE);if(!sh)throw new Error('Execute instalarEstruturaNICE().');return sh}
function niceSheet_(ss,n,heads){let sh=ss.getSheetByName(n)||ss.insertSheet(n);if(sh.getLastRow()===0)sh.getRange(1,1,1,heads.length).setValues([heads]);else{const now=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];heads.forEach(h=>{if(!now.includes(h)){sh.getRange(1,sh.getLastColumn()+1).setValue(h);now.push(h)}})}sh.setFrozenRows(1);sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold');return sh}
function nicePutConfig_(sh,rows){const ex={};if(sh.getLastRow()>=2)sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().flat().forEach(x=>ex[x]=1);rows.forEach(x=>{if(!ex[x[0]])sh.appendRow(x)})}
function niceConfig_(key,fallback){const sh=niceMaster_().getSheetByName(NICE.CONFIG);if(!sh||sh.getLastRow()<2)return fallback;for(const [k,v] of sh.getRange(2,1,sh.getLastRow()-1,2).getDisplayValues())if(k===key)return v||fallback;return fallback}
function niceBool_(key,f){const v=niceNorm_(niceConfig_(key,f?'SIM':'NAO'));return ['sim','true','1','yes'].includes(v)?true:['nao','não','false','0','no'].includes(v)?false:f}
function niceAppend_(sh,obj){const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];sh.appendRow(h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:''))}
function niceFind_(id){const sh=niceControl_(),m=niceMap_(sh);if(sh.getLastRow()<2)return null;const f=sh.getRange(2,m.ID_NICE,sh.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();return f?{sheet:sh,row:f.getRow()}:null}
function niceMap_(sh){const o={};sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].forEach((x,i)=>o[String(x)]=i+1);return o}
function niceAt_(sh,r,c){return c?sh.getRange(r,c).getValue():''}function niceSet_(sh,r,c,v){if(c)sh.getRange(r,c).setValue(v)}
function niceHistory_(id,a,b,orig,obs){try{niceMaster_().getSheetByName(NICE.HISTORICO).appendRow([new Date(),id,a,b,orig,Session.getActiveUser().getEmail()||'',obs||''])}catch(_){}}
function niceLog_(level,fn,id,msg){try{niceMaster_().getSheetByName(NICE.LOG).appendRow([new Date(),level,fn,id||'',String(msg||'')])}catch(_){}}
function niceRow_(sh,row){const n=sh.getLastColumn(),h=sh.getRange(1,1,1,n).getDisplayValues()[0],v=sh.getRange(row,1,1,n).getValues()[0],o={};h.forEach((x,i)=>{if(x)o[String(x)]=v[i]});return o}
function niceValue_(o,aliases){const a=aliases.map(niceNorm_);for(const [k,v] of Object.entries(o)){if(v!==''&&v!=null&&a.includes(niceNorm_(k)))return v}for(const [k,v] of Object.entries(o)){if(v===''||v==null)continue;const nk=niceNorm_(k);for(const x of a)if(x.length>=5&&(nk.includes(x)||x.includes(nk)))return v}return''}
function niceEmail_(o){for(const v of Object.values(o)){const m=String(v||'').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);if(m)return m[0]}return''}
function niceDriveUrls_(o){const a=[];Object.values(o).forEach(v=>(String(v||'').match(/https?:\/\/[^\s,;]+/g)||[]).forEach(u=>{if(u.includes('drive.google.com')||u.includes('docs.google.com'))a.push(u)}));return[...new Set(a)]}
function niceEnsure_(sh,h){const heads=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0],i=heads.findIndex(x=>niceNorm_(x)===niceNorm_(h));if(i>=0)return i+1;const c=sh.getLastColumn()+1;sh.getRange(1,c).setValue(h).setFontWeight('bold');return c}
function niceWriteHelper_(sh,r,h,v){sh.getRange(r,niceEnsure_(sh,h)).setValue(v)}function niceReadHelper_(sh,r,h){const heads=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0],i=heads.findIndex(x=>niceNorm_(x)===niceNorm_(h));return i<0?'':sh.getRange(r,i+1).getValue()}
function niceNorm_(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function niceExtractId_(vals){const re=/\bNICE-[0-9]{4}-[0-9]{5}\b/i;for(const v of vals||[]){const m=String(v||'').match(re);if(m)return m[0].toUpperCase()}return''}
function niceDate_(v){if(!v)return null;if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v))return v;const s=String(v).trim(),m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));const d=new Date(s);return isNaN(d)?null:d}
function niceAddDays_(d,n){const x=new Date(d);x.setDate(x.getDate()+Number(n));return x}function niceDay_(d){const x=new Date(d);x.setHours(0,0,0,0);return x}function niceDiff_(a,b){return Math.floor((niceDay_(a)-niceDay_(b))/86400000)}
function niceSafe_(s){return String(s||'').replace(/[\\/:*?"<>|#%{}~&]/g,'-').replace(/\s+/g,' ').trim()}
function niceDriveId_(u){for(const p of [/\/folders\/([A-Za-z0-9_-]+)/,/\/d\/([A-Za-z0-9_-]+)/,/[?&]id=([A-Za-z0-9_-]+)/]){const m=String(u||'').match(p);if(m)return m[1]}return''}
