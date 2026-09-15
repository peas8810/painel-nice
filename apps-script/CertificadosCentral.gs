/**
 * Extensão centralizada do Sistema NICE de Certificados.
 * Substitui a necessidade de criar um Forms + Sheets + Autocrat para cada evento.
 *
 * Fluxo único:
 * 1) CERT_EVENTOS mantém todos os eventos.
 * 2) Um único Google Forms recebe participantes de qualquer evento.
 * 3) CERT_EMISSOES concentra todos os participantes e emissões.
 * 4) CertificadosNICE.gs gera PDF, QR, validação, log e envia o e-mail.
 *
 * Este arquivo trabalha em conjunto com CertificadosNICE.gs.
 */

const NICE_CERT_CENTRAL = Object.freeze({
  FORM_ID_PROPERTY: 'CERT_FORM_CENTRAL_ID',
  FORM_TITLE: 'NICE · Cadastro para emissão de certificados',
  RESPONSE_MARKER: 'CERT_FORM_CENTRAL',
  EVENT_LINK_HEADER: 'FORM_PARTICIPANTES_URL',
  CATEGORY_HEADER: 'CATEGORIA',
  DOCUMENT_HEADER: 'DOCUMENTO',
  PRESENCE_HEADER: 'PRESENCA_CONFIRMADA',
  SOURCE_HEADER: 'ORIGEM_CADASTRO'
});

function instalarProcessoCentralCertificados(){
  // Garante a estrutura principal.
  if (typeof instalarSistemaCertificados === 'function') instalarSistemaCertificados();

  const ss = niceMaster_();
  niceCertCentralEnsureColumns_();
  const form = niceCertCentralEnsureForm_();
  niceCertCentralInstallTrigger_();
  niceCertCentralRefreshEventLinks_();
  niceCertCentralMenu_();

  SpreadsheetApp.getUi().alert(
    'Processo central de certificados instalado.\n\n' +
    'Formulário único: ' + form.getPublishedUrl() + '\n\n' +
    'A partir de agora, todos os eventos usam a mesma base de participantes.'
  );
}

function niceCertCentralMenu_(){
  try{
    SpreadsheetApp.getUi().createMenu('NICE • Certificados Central')
      .addItem('Instalar / atualizar processo central','instalarProcessoCentralCertificados')
      .addItem('Atualizar links dos eventos','atualizarLinksFormularioEventos')
      .addItem('Abrir formulário central','abrirFormularioCentralCertificados')
      .addSeparator()
      .addItem('Importar participantes da seleção','importarParticipantesDaAbaAtiva')
      .addItem('Conferir duplicidades','conferirDuplicidadesCertificados')
      .addToUi();
  }catch(_){}
}

function abrirFormularioCentralCertificados(){
  const form = niceCertCentralEnsureForm_();
  SpreadsheetApp.getUi().alert('Formulário central de participantes:\n\n' + form.getPublishedUrl());
}

function atualizarLinksFormularioEventos(){
  niceCertCentralRefreshEventLinks_();
  SpreadsheetApp.getUi().alert('Links pré-preenchidos dos eventos atualizados.');
}

function niceCertCentralEnsureColumns_(){
  const events = niceCertEventsSheet_();
  niceCertCentralEnsureHeader_(events, NICE_CERT_CENTRAL.EVENT_LINK_HEADER);

  const issues = niceCertIssuesSheet_();
  [
    NICE_CERT_CENTRAL.CATEGORY_HEADER,
    NICE_CERT_CENTRAL.DOCUMENT_HEADER,
    NICE_CERT_CENTRAL.PRESENCE_HEADER,
    NICE_CERT_CENTRAL.SOURCE_HEADER
  ].forEach(h => niceCertCentralEnsureHeader_(issues,h));
}

function niceCertCentralEnsureHeader_(sh, header){
  const last = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1,1,1,last).getDisplayValues()[0];
  if (headers.some(x => String(x).trim() === header)) return;
  sh.getRange(1,last+1).setValue(header);
}

function niceCertCentralEnsureForm_(){
  const props = PropertiesService.getScriptProperties();
  let form = null;
  const formId = props.getProperty(NICE_CERT_CENTRAL.FORM_ID_PROPERTY);
  if(formId){
    try{ form = FormApp.openById(formId); }catch(_){}
  }
  if(!form){
    form = FormApp.create(NICE_CERT_CENTRAL.FORM_TITLE);
    props.setProperty(NICE_CERT_CENTRAL.FORM_ID_PROPERTY, form.getId());
  }

  form.setTitle(NICE_CERT_CENTRAL.FORM_TITLE)
      .setDescription('Formulário único do Sistema NICE para registro de participantes e emissão posterior de certificados. O código do evento identifica automaticamente a qual ação o participante pertence.')
      .setConfirmationMessage('Cadastro recebido. A emissão do certificado ocorrerá após validação da participação pelo NICE.');

  const wanted = [
    ['EVENTO_ID','Número do evento',true],
    ['NOME','Nome completo',true],
    ['EMAIL','E-mail para recebimento do certificado',true],
    ['DOCUMENTO','CPF ou documento (opcional)',false],
    ['CATEGORIA','Categoria no evento (Participante, Palestrante, Organizador, Monitor etc.)',false]
  ];
  const existing = {};
  form.getItems().forEach(i => existing[niceCertCentralNorm_(i.getTitle())] = i);
  wanted.forEach(([key,title,required]) => {
    const norm = niceCertCentralNorm_(title);
    if(existing[norm]) return;
    const it = form.addTextItem().setTitle(title).setRequired(required);
    if(key==='EVENTO_ID'){
      it.setHelpText('Informe somente o número do evento, por exemplo: 23.');
      it.setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[0-9]{1,6}$').setHelpText('Use somente números. Ex.: 23').build());
    }
    if(key==='EMAIL'){
      it.setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Informe um e-mail válido.').build());
    }
  });

  // Destino único: a planilha mestre do NICE.
  try{
    const ss = niceMaster_();
    const current = form.getDestinationId();
    if(current !== ss.getId()) form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  }catch(_){}
  return form;
}

function niceCertCentralInstallTrigger_(){
  const ss = niceMaster_();
  ScriptApp.getProjectTriggers().forEach(t => {
    if(t.getHandlerFunction()==='niceCertCentralOnFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('niceCertCentralOnFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
}

function niceCertCentralOnFormSubmit(e){
  if(!e || !e.range) return;
  const sh = e.range.getSheet();
  // Só processa a aba de respostas gerada pelo formulário central.
  const d = niceCertCentralRowObject_(sh,e.range.getRow());
  if(!niceCertCentralLooksLikeCentralResponse_(d)) return;

  const id = Number(String(niceCertCentralPick_(d,['Número do evento','Evento','EVENTO_ID'])||'').replace(/\D/g,''));
  const nome = String(niceCertCentralPick_(d,['Nome completo','Nome','NOME'])||'').trim();
  const email = String(niceCertCentralPick_(d,['E-mail para recebimento do certificado','E-mail','Email','EMAIL'])||'').trim().toLowerCase();
  const documento = String(niceCertCentralPick_(d,['CPF ou documento (opcional)','CPF','Documento'])||'').trim();
  const categoria = String(niceCertCentralPick_(d,['Categoria no evento (Participante, Palestrante, Organizador, Monitor etc.)','Categoria'])||'Participante').trim();

  if(!id || !nome || !email) return;
  const event = niceCertFindEvent_(id);
  if(!event){
    niceCertLog_('CADASTRO_REJEITADO',id,'','Evento inexistente · '+nome+' · '+email);
    return;
  }

  const issues = niceCertIssuesSheet_();
  niceCertCentralEnsureColumns_();
  if(niceCertCentralDuplicate_(issues,id,email)){
    niceCertLog_('CADASTRO_DUPLICADO',id,'','Participante já cadastrado: '+email);
    return;
  }

  const obj = {
    EVENTO_ID:id,
    NOME:nome,
    EMAIL:email,
    CARGA_HORARIA:event.CARGA_HORARIA||'',
    STATUS:'PENDENTE',
    CATEGORIA:categoria||'Participante',
    DOCUMENTO:documento,
    PRESENCA_CONFIRMADA:'PENDENTE',
    ORIGEM_CADASTRO:'FORM_CENTRAL'
  };
  niceCertAppendObject_(issues,obj);
  niceCertLog_('PARTICIPANTE_CADASTRADO',id,'',nome+' · '+email+' · '+categoria);
}

function niceCertCentralLooksLikeCentralResponse_(d){
  const keys = Object.keys(d).map(niceCertCentralNorm_);
  return keys.some(k=>k==='numero do evento') && keys.some(k=>k==='nome completo') && keys.some(k=>k.includes('email para recebimento'));
}

function niceCertCentralRefreshEventLinks_(){
  niceCertCentralEnsureColumns_();
  const form = niceCertCentralEnsureForm_();
  const eventItem = form.getItems(FormApp.ItemType.TEXT).map(i=>i.asTextItem()).find(i=>niceCertCentralNorm_(i.getTitle())==='numero do evento');
  if(!eventItem) throw new Error('Campo Número do evento não encontrado no formulário central.');

  const sh = niceCertEventsSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length<2) return;
  const map = niceCertHeaderMap_(values[0]);
  for(let r=1;r<values.length;r++){
    const id = Number(values[r][map.EVENTO_ID]);
    if(!id) continue;
    const response = form.createResponse().withItemResponse(eventItem.createResponse(String(id)));
    const url = response.toPrefilledUrl();
    niceCertSetByMap_(sh,r+1,map,NICE_CERT_CENTRAL.EVENT_LINK_HEADER,url);
  }
}

function importarParticipantesDaAbaAtiva(){
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  if(sh.getName()===NICE_CERT.EMISSOES){ui.alert('Selecione uma aba de origem com participantes, não a CERT_EMISSOES.');return}
  const eventTxt = niceCertPrompt_(ui,'Importar participantes','Informe o número do evento de destino.');
  if(eventTxt===null)return;
  const eventId = Number(String(eventTxt).replace(/\D/g,''));
  if(!eventId || !niceCertFindEvent_(eventId)){ui.alert('Evento inválido ou inexistente.');return}

  const range = sh.getActiveRange();
  const vals = range.getDisplayValues();
  if(vals.length<2){ui.alert('Selecione cabeçalho + participantes.');return}
  const headers = vals[0].map(niceCertCentralNorm_);
  const idxName = niceCertCentralFindHeader_(headers,['nome','nome completo','participante']);
  const idxEmail = niceCertCentralFindHeader_(headers,['email','e-mail','e mail']);
  const idxCat = niceCertCentralFindHeader_(headers,['categoria','tipo']);
  const idxCarga = niceCertCentralFindHeader_(headers,['carga horaria','carga horária','horas']);
  if(idxName<0 || idxEmail<0){ui.alert('A seleção precisa ter colunas Nome e E-mail.');return}

  const dest = niceCertIssuesSheet_();
  niceCertCentralEnsureColumns_();
  const event = niceCertFindEvent_(eventId);
  let added=0,dup=0;
  for(let i=1;i<vals.length;i++){
    const nome=String(vals[i][idxName]||'').trim();
    const email=String(vals[i][idxEmail]||'').trim().toLowerCase();
    if(!nome||!email)continue;
    if(niceCertCentralDuplicate_(dest,eventId,email)){dup++;continue}
    niceCertAppendObject_(dest,{
      EVENTO_ID:eventId,NOME:nome,EMAIL:email,
      CARGA_HORARIA:idxCarga>=0?vals[i][idxCarga]:(event.CARGA_HORARIA||''),
      STATUS:'PENDENTE',
      CATEGORIA:idxCat>=0?(vals[i][idxCat]||'Participante'):'Participante',
      PRESENCA_CONFIRMADA:'PENDENTE',
      ORIGEM_CADASTRO:'IMPORTACAO'
    });
    added++;
  }
  niceCertLog_('IMPORTACAO_PARTICIPANTES',eventId,'','Adicionados '+added+' · duplicados '+dup);
  ui.alert('Importação concluída.\n\nAdicionados: '+added+'\nDuplicados ignorados: '+dup);
}

function conferirDuplicidadesCertificados(){
  const sh = niceCertIssuesSheet_();
  const v = sh.getDataRange().getDisplayValues();
  if(v.length<2){SpreadsheetApp.getUi().alert('Nenhum participante cadastrado.');return}
  const map = niceCertHeaderMap_(v[0]);
  const seen={},dups=[];
  for(let r=1;r<v.length;r++){
    const id=String(v[r][map.EVENTO_ID]||'').trim();
    const email=String(v[r][map.EMAIL]||'').trim().toLowerCase();
    if(!id||!email)continue;
    const key=id+'|'+email;
    if(seen[key])dups.push('Evento '+id+' · '+email+' · linhas '+seen[key]+' e '+(r+1));
    else seen[key]=r+1;
  }
  SpreadsheetApp.getUi().alert(dups.length?'Duplicidades encontradas:\n\n'+dups.slice(0,30).join('\n'):'Nenhuma duplicidade por evento + e-mail.');
}

function niceCertCentralDuplicate_(sh,eventId,email){
  const v=sh.getDataRange().getDisplayValues();
  if(v.length<2)return false;
  const map=niceCertHeaderMap_(v[0]);
  for(let r=1;r<v.length;r++){
    if(Number(v[r][map.EVENTO_ID])===Number(eventId) && String(v[r][map.EMAIL]||'').trim().toLowerCase()===String(email).trim().toLowerCase()) return true;
  }
  return false;
}

function niceCertCentralRowObject_(sh,row){
  const last=sh.getLastColumn();
  const h=sh.getRange(1,1,1,last).getDisplayValues()[0];
  const v=sh.getRange(row,1,1,last).getDisplayValues()[0];
  const o={};h.forEach((x,i)=>o[String(x).trim()]=v[i]);return o;
}
function niceCertCentralPick_(obj,names){
  const norm={};Object.keys(obj).forEach(k=>norm[niceCertCentralNorm_(k)]=obj[k]);
  for(const n of names){const k=niceCertCentralNorm_(n);if(Object.prototype.hasOwnProperty.call(norm,k)&&String(norm[k]).trim()!=='')return norm[k];}
  return '';
}
function niceCertCentralNorm_(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
function niceCertCentralFindHeader_(headers,names){for(const n of names){const x=niceCertCentralNorm_(n);const i=headers.findIndex(h=>h===x||h.includes(x));if(i>=0)return i}return -1;}
