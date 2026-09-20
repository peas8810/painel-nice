/**
 * Sistema NICE de Certificados
 * - eventos sequenciais: /certificados/23
 * - certificados individuais com código único + QR Code
 * - selo de integridade HMAC-SHA256
 * - rastreabilidade (emissão, envio, revogação e reemissão)
 * - envio por e-mail pelo usuário efetivo do Apps Script
 *
 * Requisitos já existentes no projeto:
 * - GITHUB_SYNC_TOKEN em Propriedades do script
 * - execução do Apps Script pela conta nice@unipacto.com.br (ou alias configurado)
 */

const NICE_CERT = Object.freeze({
  EVENTOS:'CERT_EVENTOS',
  EMISSOES:'CERT_EMISSOES',
  LOG:'CERT_LOG',
  OWNER:'peas8810',
  REPO:'painel-nice',
  TOKEN_PROPERTY:'GITHUB_SYNC_TOKEN',
  SIGNING_SECRET_PROPERTY:'CERT_SIGNING_SECRET',
  EVENT_SEQ_PROPERTY:'CERT_EVENT_SEQ',
  ROOT_FOLDER_PROPERTY:'CERT_ROOT_FOLDER_ID',
  PUBLIC_BASE:'https://www.protocolo.me/certificados',
  SENDER:'nice@unipacto.com.br',
  BATCH_LIMIT:40,
  EVENT_HEADERS:['EVENTO_ID','PROTOCOLO_NICE','TITULO_EVENTO','TIPO_EVENTO','DATA_EVENTO','CAMPUS_UNIDADE','LOCAL','CARGA_HORARIA','RESPONSAVEL','DESCRICAO','STATUS','URL_PUBLICA','PASTA_DRIVE','CRIADO_EM','ATUALIZADO_EM'],
  ISSUE_HEADERS:['EVENTO_ID','NOME','EMAIL','CARGA_HORARIA','CODIGO','ASSINATURA_HMAC','STATUS','EMITIDO_EM','ENVIADO_EM','PDF_URL','TENTATIVAS_EMAIL','ULTIMO_ERRO','MOTIVO_REVOGACAO','REVOGADO_EM','TIPO_CERTIFICADO','FUNCAO_EVENTO','TITULO_EVENTO_CUSTOM','CUSTOM_LINK_ID'],
  LOG_HEADERS:['DATA_HORA','ACAO','EVENTO_ID','CODIGO','DETALHE','USUARIO']
});

function niceCertOnOpen(){
  try{
    SpreadsheetApp.getUi().createMenu('NICE • Certificados')
      .addItem('Instalar / atualizar sistema','instalarSistemaCertificados')
      .addItem('Criar novo evento','novoEventoCertificados')
      .addItem('Abrir planilha de participantes','abrirEmissoesCertificados')
      .addSeparator()
      .addItem('Emitir certificados pendentes','emitirCertificadosPendentes')
      .addItem('Republicar evento selecionado','republicarEventoSelecionado')
      .addItem('Revogar certificado por código','revogarCertificadoPorCodigo')
      .addToUi();
  }catch(_){}
}

function instalarSistemaCertificados(){
  const ss=niceMaster_();
  niceCertSheet_(ss,NICE_CERT.EVENTOS,NICE_CERT.EVENT_HEADERS);
  niceCertSheet_(ss,NICE_CERT.EMISSOES,NICE_CERT.ISSUE_HEADERS);
  niceCertSheet_(ss,NICE_CERT.LOG,NICE_CERT.LOG_HEADERS);
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty(NICE_CERT.SIGNING_SECRET_PROPERTY)) props.setProperty(NICE_CERT.SIGNING_SECRET_PROPERTY,Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());
  niceCertEnsureRootFolder_();
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='niceCertOnOpen').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('niceCertOnOpen').forSpreadsheet(ss).onOpen().create();
  niceCertOnOpen();
  SpreadsheetApp.getUi().alert('Sistema de certificados instalado.\n\nUse NICE • Certificados → Criar novo evento.');
}

function novoEventoCertificados(){
  const ui=SpreadsheetApp.getUi();
  const protocolo=niceCertPrompt_(ui,'Novo evento','Protocolo NICE (opcional).\nEx.: NICE-2026-00023'); if(protocolo===null)return;
  const base=niceCertProtocolData_(protocolo);
  const titulo=niceCertPrompt_(ui,'Título do evento','Informe o título.\nSugestão: '+(base.titulo||'')); if(titulo===null)return;
  const tipo=niceCertPrompt_(ui,'Tipo do evento','Ex.: Palestra, Curso, Congresso, Projeto de Extensão.\nSugestão: '+(base.tipo||'')); if(tipo===null)return;
  const data=niceCertPrompt_(ui,'Data do evento','Use DD/MM/AAAA.\nSugestão: '+(base.data||'')); if(data===null)return;
  const campus=niceCertPrompt_(ui,'Campus / Unidade','Sugestão: '+(base.unidade||'')); if(campus===null)return;
  const local=niceCertPrompt_(ui,'Local','Ex.: Auditório AlfaUnipac / Teófilo Otoni'); if(local===null)return;
  const carga=niceCertPrompt_(ui,'Carga horária','Ex.: 4 horas'); if(carga===null)return;
  const responsavel=niceCertPrompt_(ui,'Responsável','Sugestão: '+(base.responsavel||'')); if(responsavel===null)return;
  const descricao=niceCertPrompt_(ui,'Descrição','Descrição curta que aparecerá na página pública do evento.'); if(descricao===null)return;
  const id=niceCertNextEventId_(),titleFinal=(titulo||base.titulo||('Evento '+id)).trim(),eventDate=niceCertParseBrDate_(data)||base.dateObj||'',folder=niceCertEventFolder_(id,titleFinal),now=new Date();
  const event={EVENTO_ID:id,PROTOCOLO_NICE:(protocolo||'').trim().toUpperCase(),TITULO_EVENTO:titleFinal,TIPO_EVENTO:(tipo||base.tipo||'').trim(),DATA_EVENTO:eventDate,CAMPUS_UNIDADE:(campus||base.unidade||'').trim(),LOCAL:(local||'').trim(),CARGA_HORARIA:(carga||'').trim(),RESPONSAVEL:(responsavel||base.responsavel||'').trim(),DESCRICAO:(descricao||'').trim(),STATUS:'ATIVO',URL_PUBLICA:NICE_CERT.PUBLIC_BASE+'/'+id,PASTA_DRIVE:folder.getUrl(),CRIADO_EM:now,ATUALIZADO_EM:now};
  niceCertAppendObject_(niceCertEventsSheet_(),event);niceCertPublishEvent_(event);niceCertLog_('EVENTO_CRIADO',id,'','Evento criado e publicado.');
  ui.alert('Evento '+id+' criado.\n\nPágina pública:\n'+event.URL_PUBLICA+'\n\nAgora preencha a aba CERT_EMISSOES com EVENTO_ID, NOME e EMAIL.');
}

function abrirEmissoesCertificados(){const sh=niceCertIssuesSheet_();SpreadsheetApp.getActive().setActiveSheet(sh);sh.activate()}
function emitirCertificadosPendentes(){
  const ui=SpreadsheetApp.getUi(),eventId=niceCertPrompt_(ui,'Emitir certificados','Informe o número do evento.');if(eventId===null)return;
  const id=Number(String(eventId).replace(/\D/g,''));if(!id){ui.alert('Número de evento inválido.');return}const event=niceCertFindEvent_(id);if(!event){ui.alert('Evento '+id+' não encontrado.');return}
  const sh=niceCertIssuesSheet_(),values=sh.getDataRange().getValues(),map=niceCertHeaderMap_(values[0]);let processed=0,sent=0,errors=0;
  for(let r=1;r<values.length&&processed<NICE_CERT.BATCH_LIMIT;r++){const row=values[r];if(Number(row[map.EVENTO_ID])!==id)continue;const status=String(row[map.STATUS]||'').trim().toUpperCase();if(['ENVIADO','ATIVO','REVOGADO'].includes(status))continue;const nome=String(row[map.NOME]||'').trim(),email=String(row[map.EMAIL]||'').trim();if(!nome||!email)continue;processed++;try{niceCertIssueRow_(sh,r+1,map,event);sent++}catch(err){errors++;niceCertSetByMap_(sh,r+1,map,'STATUS','ERRO');niceCertSetByMap_(sh,r+1,map,'ULTIMO_ERRO',String(err.message||err).slice(0,1000));niceCertSetByMap_(sh,r+1,map,'TENTATIVAS_EMAIL',Number(niceCertGetByMap_(sh,r+1,map,'TENTATIVAS_EMAIL')||0)+1);niceCertLog_('ERRO_EMISSAO',id,String(niceCertGetByMap_(sh,r+1,map,'CODIGO')||''),String(err.stack||err))}}
  niceCertPublishEvent_(niceCertFindEvent_(id));ui.alert('Processamento concluído.\n\nEmitidos/enviados: '+sent+'\nErros: '+errors+'\nLimite por execução: '+NICE_CERT.BATCH_LIMIT)
}

function niceCertIssueRow_(sh,row,map,event){
  const nome=String(niceCertGetByMap_(sh,row,map,'NOME')||'').trim(),email=String(niceCertGetByMap_(sh,row,map,'EMAIL')||'').trim(),carga=String(niceCertGetByMap_(sh,row,map,'CARGA_HORARIA')||event.CARGA_HORARIA||'').trim();
  let codigo=String(niceCertGetByMap_(sh,row,map,'CODIGO')||'').trim().toUpperCase();if(!codigo)codigo=niceCertNewCode_(event.EVENTO_ID);
  const emittedAt=new Date(),canonical=niceCertCanonical_({codigo,eventId:event.EVENTO_ID,nome,titulo:event.TITULO_EVENTO,data:niceCertIsoDate_(event.DATA_EVENTO),carga,emitido:emittedAt.toISOString()}),signature=niceCertSign_(canonical),pdf=niceCertGeneratePdf_(event,{nome,email,carga,codigo,signature,emitido:emittedAt});
  niceCertSendMail_(email,nome,event,pdf,codigo);niceCertSetByMap_(sh,row,map,'CODIGO',codigo);niceCertSetByMap_(sh,row,map,'ASSINATURA_HMAC',signature);niceCertSetByMap_(sh,row,map,'STATUS','ENVIADO');niceCertSetByMap_(sh,row,map,'EMITIDO_EM',emittedAt);niceCertSetByMap_(sh,row,map,'ENVIADO_EM',new Date());niceCertSetByMap_(sh,row,map,'PDF_URL',pdf.url);niceCertSetByMap_(sh,row,map,'TENTATIVAS_EMAIL',Number(niceCertGetByMap_(sh,row,map,'TENTATIVAS_EMAIL')||0)+1);niceCertSetByMap_(sh,row,map,'ULTIMO_ERRO','');niceCertLog_('CERTIFICADO_EMITIDO',event.EVENTO_ID,codigo,'Enviado para '+email)
}

function niceCertGeneratePdf_(event,cert){
  const folder=niceCertFolderFromUrl_(event.PASTA_DRIVE),pres=SlidesApp.create('TMP '+cert.codigo),slide=pres.getSlides()[0];slide.getPageElements().forEach(x=>x.remove());
  const C=niceCertPremiumFrame_(slide);
  niceCertPremiumHeader_(slide,'CERTIFICADO DE PARTICIPAÇÃO','CERTIFICATE OF PARTICIPATION');
  niceCertText_(slide,'Certificamos que',90,143,540,18,10,C.gray,false,'CENTER');
  niceCertText_(slide,cert.nome,58,165,604,32,20,C.navy,true,'CENTER');
  const body='participou do evento “'+event.TITULO_EVENTO+'”, realizado em '+niceCertBrDate_(event.DATA_EVENTO)+(event.LOCAL?' no(a) '+event.LOCAL:'')+(event.CAMPUS_UNIDADE?' · '+event.CAMPUS_UNIDADE:'')+', com carga horária de '+(cert.carga||'não informada')+'.';
  niceCertText_(slide,body,72,207,576,47,11,'#384657',false,'CENTER');
  niceCertText_(slide,'Evento '+String(event.EVENTO_ID).padStart(4,'0')+'  ·  Protocolo NICE: '+(event.PROTOCOLO_NICE||'—'),76,258,568,16,9,C.gray,true,'CENTER');
  niceCertPremiumValidation_(slide,cert.codigo,cert.signature,cert.emitido);
  pres.saveAndClose();Utilities.sleep(2000);
  const sourceFile=DriveApp.getFileById(pres.getId()),pdfBlob=sourceFile.getBlob().getAs(MimeType.PDF).setName(cert.codigo+'.pdf'),file=folder.createFile(pdfBlob);
  file.setDescription('Certificado NICE · Evento '+event.EVENTO_ID+' · '+cert.codigo);sourceFile.setTrashed(true);
  return{blob:pdfBlob,url:file.getUrl(),id:file.getId()}
}

function niceCertPremiumFrame_(slide){
  const C={navy:'#17365D',navy2:'#214D7A',gold:'#C59A45',gray:'#667788',light:'#F6F8FB',line:'#D9E1E8'};
  slide.getBackground().setSolidFill('#FFFFFF');
  const outer=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,10,10,700,385);outer.getFill().setTransparent();outer.getBorder().getLineFill().setSolidFill(C.navy);outer.getBorder().setWeight(2.2);
  const inner=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,17,17,686,371);inner.getFill().setTransparent();inner.getBorder().getLineFill().setSolidFill(C.gold);inner.getBorder().setWeight(.8);
  const accent=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,31,29,92,4);accent.getFill().setSolidFill(C.gold);accent.getBorder().setTransparent();
  niceCertText_(slide,'NICE · CERTIFICAÇÃO INSTITUCIONAL',31,38,330,16,9,C.navy,true,'START');
  niceCertPeasBrand_(slide,517,31);
  return C;
}

function niceCertPremiumHeader_(slide,title,subtitle){
  const navy='#17365D',gold='#C59A45',gray='#667788';
  niceCertText_(slide,title,72,68,576,31,23,navy,true,'CENTER');
  niceCertText_(slide,subtitle,72,101,576,15,9,gray,false,'CENTER');
  const line=slide.insertLine(SlidesApp.LineCategory.STRAIGHT,132,126,588,126);line.getLineFill().setSolidFill(gold);line.setWeight(1.2);
}

function niceCertPremiumValidation_(slide,codigo,signature,emitido){
  const navy='#17365D',blue='#2F75B5',gold='#C59A45',gray='#667788',light='#F6F8FB';
  const verify=NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(codigo);
  const card=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,42,289,636,74);card.getFill().setSolidFill(light);card.getBorder().getLineFill().setSolidFill('#D9E1E8');card.getBorder().setWeight(.7);
  const qr=UrlFetchApp.fetch('https://quickchart.io/qr?size=220&margin=1&ecLevel=M&text='+encodeURIComponent(verify),{muteHttpExceptions:false}).getBlob().setName('qr.png');
  slide.insertImage(qr,54,297,58,58);
  niceCertText_(slide,'VALIDAÇÃO DIGITAL',128,297,166,13,8,gold,true,'START');
  niceCertText_(slide,'Autenticidade verificável por QR Code',128,312,290,14,9,navy,true,'START');
  niceCertText_(slide,'Código: '+codigo,128,329,360,13,8,gray,false,'START');
  niceCertText_(slide,'protocolo.me/certificados/validar',128,344,310,12,8,blue,true,'START');
  niceCertText_(slide,'HMAC-SHA256',514,298,140,12,8,gold,true,'END');
  niceCertText_(slide,String(signature||'').slice(0,20)+'…',470,315,184,12,7,gray,false,'END');
  niceCertText_(slide,'Emitido em',514,335,140,11,7,gray,false,'END');
  niceCertText_(slide,Utilities.formatDate(emitido,Session.getScriptTimeZone()||'America/Sao_Paulo','dd/MM/yyyy HH:mm'),470,348,184,12,8,navy,true,'END');
  niceCertText_(slide,'Documento emitido eletronicamente pelo NICE · PEAS Technology®',80,373,560,10,7,gray,false,'CENTER');
}

function niceCertPeasBrand_(slide,x,y){niceCertText_(slide,'PEAS',x,y,70,18,13,'#17365D',true,'END');niceCertText_(slide,'Technology®',x+74,y+2,95,15,8,'#E97824',true,'START')}
function niceCertLogo_(slide,x,y){const navy='#17365D',orange='#F4A11A';const line1=slide.insertLine(SlidesApp.LineCategory.STRAIGHT,x+16,y+16,x+7,y+31);line1.getLineFill().setSolidFill(navy);line1.setWeight(2.4);const line2=slide.insertLine(SlidesApp.LineCategory.STRAIGHT,x+16,y+16,x+29,y+31);line2.getLineFill().setSolidFill(navy);line2.setWeight(2.4);const line3=slide.insertLine(SlidesApp.LineCategory.STRAIGHT,x+16,y+16,x+16,y+2);line3.getLineFill().setSolidFill(navy);line3.setWeight(2.4);[[x+10,y+10,12,navy],[x+1,y+28,12,orange],[x+23,y+28,12,orange],[x+10,y-4,12,orange]].forEach(a=>{const s=slide.insertShape(SlidesApp.ShapeType.ELLIPSE,a[0],a[1],a[2],a[2]);s.getFill().setSolidFill(a[3]);s.getBorder().setTransparent()})}
function niceCertText_(slide,text,left,top,width,height,size,color,bold,align){const box=slide.insertTextBox(String(text||''),left,top,width,height),range=box.getText();range.getTextStyle().setFontFamily('Arial').setFontSize(size).setForegroundColor(color).setBold(!!bold);const a=align==='CENTER'?SlidesApp.ParagraphAlignment.CENTER:align==='END'?SlidesApp.ParagraphAlignment.END:SlidesApp.ParagraphAlignment.START;range.getParagraphStyle().setParagraphAlignment(a);return box}
function niceCertSendMail_(email,nome,event,pdf,codigo){const validate=NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(codigo),subject='[NICE] Certificado · '+event.TITULO_EVENTO,plain='Olá, '+nome+'.\n\nSeu certificado referente ao evento '+event.TITULO_EVENTO+' está anexo.\n\nCódigo: '+codigo+'\nValidação: '+validate+'\n\nNICE · AlfaUnipac',html='<p>Olá, <strong>'+niceCertHtml_(nome)+'</strong>.</p><p>Seu certificado referente ao evento <strong>'+niceCertHtml_(event.TITULO_EVENTO)+'</strong> está anexo.</p><p><strong>Código:</strong> '+niceCertHtml_(codigo)+'<br><strong>Validação:</strong> <a href="'+niceCertHtml_(validate)+'">'+niceCertHtml_(validate)+'</a></p><p>NICE · AlfaUnipac</p>',opts={htmlBody:html,attachments:[pdf.blob],name:'NICE - Certificados'},sender=niceCertSenderOptions_();Object.keys(sender).forEach(k=>opts[k]=sender[k]);GmailApp.sendEmail(email,subject,plain,opts)}
function niceCertSenderOptions_(){const effective=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();if(effective===NICE_CERT.SENDER.toLowerCase())return{};try{const aliases=GmailApp.getAliases().map(x=>String(x).toLowerCase());if(aliases.includes(NICE_CERT.SENDER.toLowerCase()))return{from:NICE_CERT.SENDER}}catch(_){}throw new Error('O sistema de certificados deve ser executado por '+NICE_CERT.SENDER+' ou por uma conta que possua esse endereço como alias do Gmail.')}
function niceCertPublicVerify_(code){const wanted=String(code||'').trim().toUpperCase();if(/^CERT-NICE-CUS-[A-Z0-9]{10}$/.test(wanted)&&typeof niceCertCustomVerify_==='function')return niceCertCustomVerify_(wanted);if(!/^CERT-NICE-\d{5}-[A-Z0-9]{10}$/.test(wanted))return{ok:true,valid:false,error:'Formato de código inválido.'};const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues();if(v.length<2)return{ok:true,valid:false,error:'Certificado não encontrado.'};const m=niceCertHeaderMap_(v[0]);for(let i=1;i<v.length;i++){if(String(v[i][m.CODIGO]||'').trim().toUpperCase()!==wanted)continue;const event=niceCertFindEvent_(Number(v[i][m.EVENTO_ID]));if(!event)return{ok:true,valid:false,error:'Evento associado não localizado.'};const emitted=niceCertDate_(v[i][m.EMITIDO_EM]),payload=niceCertCanonical_({codigo:wanted,eventId:event.EVENTO_ID,nome:String(v[i][m.NOME]||''),titulo:event.TITULO_EVENTO,data:niceCertIsoDate_(event.DATA_EVENTO),carga:String(v[i][m.CARGA_HORARIA]||event.CARGA_HORARIA||''),emitido:emitted?emitted.toISOString():''}),expected=niceCertSign_(payload),stored=String(v[i][m.ASSINATURA_HMAC]||''),valid=stored&&expected===stored,status=String(v[i][m.STATUS]||'').toUpperCase();return{ok:true,valid:!!valid,revoked:status==='REVOGADO',status,nome:String(v[i][m.NOME]||''),codigo:wanted,carga_horaria:String(v[i][m.CARGA_HORARIA]||event.CARGA_HORARIA||''),emitido_em:emitted?emitted.toISOString():'',selo:stored,evento:{id:event.EVENTO_ID,titulo:event.TITULO_EVENTO,data_evento:niceCertBrDate_(event.DATA_EVENTO),campus_unidade:event.CAMPUS_UNIDADE,local:event.LOCAL,protocolo_nice:event.PROTOCOLO_NICE},motivo_revogacao:String(v[i][m.MOTIVO_REVOGACAO]||'')}}return{ok:true,valid:false,error:'Certificado não encontrado.'}}
function revogarCertificadoPorCodigo(){const ui=SpreadsheetApp.getUi(),code=niceCertPrompt_(ui,'Revogar certificado','Informe o código completo.');if(code===null)return;const reason=niceCertPrompt_(ui,'Motivo da revogação','Informe o motivo que ficará disponível no validador.');if(reason===null)return;const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]),wanted=String(code).trim().toUpperCase();for(let i=1;i<v.length;i++)if(String(v[i][m.CODIGO]||'').trim().toUpperCase()===wanted){niceCertSetByMap_(sh,i+1,m,'STATUS','REVOGADO');niceCertSetByMap_(sh,i+1,m,'MOTIVO_REVOGACAO',reason);niceCertSetByMap_(sh,i+1,m,'REVOGADO_EM',new Date());niceCertLog_('CERTIFICADO_REVOGADO',v[i][m.EVENTO_ID],wanted,reason);ui.alert('Certificado revogado.');return}ui.alert('Código não localizado.')}
function republicarEventoSelecionado(){const sh=SpreadsheetApp.getActiveSheet();if(sh.getName()!==NICE_CERT.EVENTOS){SpreadsheetApp.getUi().alert('Selecione uma linha na aba CERT_EVENTOS.');return}const row=sh.getActiveRange().getRow();if(row<2)return;const event=niceCertObjectFromRow_(sh,row);niceCertPublishEvent_(event);SpreadsheetApp.getUi().alert('Evento '+event.EVENTO_ID+' republicado.')}
function niceCertPublishEvent_(event){if(!event||!event.EVENTO_ID)return;const id=Number(event.EVENTO_ID),pub={id,status:event.STATUS||'ATIVO',protocolo_nice:event.PROTOCOLO_NICE||'',titulo:event.TITULO_EVENTO||'',tipo:event.TIPO_EVENTO||'',data_evento:niceCertIsoDate_(event.DATA_EVENTO),campus_unidade:event.CAMPUS_UNIDADE||'',local:event.LOCAL||'',carga_horaria:event.CARGA_HORARIA||'',responsavel:event.RESPONSAVEL||'',descricao:event.DESCRICAO||'',certificados_emitidos:niceCertIssuedCount_(id),updated_at:new Date().toISOString()};niceCertGithubPut_('certificados/data/events/'+id+'.json',JSON.stringify(pub,null,2)+'\n','certificados: publica evento '+id);niceCertGithubPut_('certificados/'+id+'/index.html',niceCertEventPageHtml_(id),'certificados: cria rota do evento '+id);const idx=niceCertGithubGetJson_('certificados/data/events-index.json')||{events:[]};idx.events=Array.isArray(idx.events)?idx.events:[];const short={id:pub.id,titulo:pub.titulo,data_evento:pub.data_evento,campus_unidade:pub.campus_unidade,protocolo_nice:pub.protocolo_nice,status:pub.status,certificados_emitidos:pub.certificados_emitidos};const pos=idx.events.findIndex(x=>Number(x.id)===id);if(pos>=0)idx.events[pos]=short;else idx.events.push(short);idx.events.sort((a,b)=>Number(b.id)-Number(a.id));idx.updated_at=new Date().toISOString();niceCertGithubPut_('certificados/data/events-index.json',JSON.stringify(idx,null,2)+'\n','certificados: atualiza índice de eventos')}
function niceCertEventPageHtml_(id){return'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0; url=../?evento='+id+'"><link rel="canonical" href="'+NICE_CERT.PUBLIC_BASE+'/'+id+'"><title>Evento '+id+' | Certificados NICE</title></head><body><p>Carregando evento '+id+'…</p><script>location.replace(\'../?evento='+id+'\'+location.hash)</script></body></html>'}
function niceCertGithubPut_(path,content,message){const token=PropertiesService.getScriptProperties().getProperty(NICE_CERT.TOKEN_PROPERTY);if(!token)throw new Error('GITHUB_SYNC_TOKEN não configurado.');const base='https://api.github.com/repos/'+NICE_CERT.OWNER+'/'+NICE_CERT.REPO+'/contents/'+path;let sha='';const get=UrlFetchApp.fetch(base,{muteHttpExceptions:true,headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(get.getResponseCode()===200){try{sha=JSON.parse(get.getContentText()).sha||''}catch(_){}}const payload={message,content:Utilities.base64Encode(content,Utilities.Charset.UTF_8)};if(sha)payload.sha=sha;const res=UrlFetchApp.fetch(base,{method:'put',muteHttpExceptions:true,contentType:'application/json',headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},payload:JSON.stringify(payload)});if(![200,201].includes(res.getResponseCode()))throw new Error('GitHub HTTP '+res.getResponseCode()+': '+res.getContentText())}
function niceCertGithubGetJson_(path){const token=PropertiesService.getScriptProperties().getProperty(NICE_CERT.TOKEN_PROPERTY),url='https://api.github.com/repos/'+NICE_CERT.OWNER+'/'+NICE_CERT.REPO+'/contents/'+path,res=UrlFetchApp.fetch(url,{muteHttpExceptions:true,headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(res.getResponseCode()!==200)return null;const o=JSON.parse(res.getContentText()),txt=Utilities.newBlob(Utilities.base64Decode(String(o.content||'').replace(/\s/g,''))).getDataAsString();return JSON.parse(txt)}
function niceCertProtocolData_(id){const out={};if(!id)return out;try{const f=niceFind_(String(id).trim().toUpperCase());if(!f)return out;const sh=f.sheet,m=niceMap_(sh);out.titulo=niceAt_(sh,f.row,m.TITULO_ACAO);out.tipo=niceAt_(sh,f.row,m.TIPO_ACAO);out.unidade=niceAt_(sh,f.row,m.UNIDADE);out.responsavel=niceAt_(sh,f.row,m.RESPONSAVEL);out.dateObj=niceDate_(niceAt_(sh,f.row,m.DATA_INICIO));out.data=out.dateObj?Utilities.formatDate(out.dateObj,Session.getScriptTimeZone()||'America/Sao_Paulo','dd/MM/yyyy'):''}catch(_){}return out}
function niceCertNextEventId_(){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const sh=niceCertEventsSheet_(),v=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat():[],max=Math.max(0,...v.map(Number).filter(Number.isFinite)),p=PropertiesService.getScriptProperties(),saved=Number(p.getProperty(NICE_CERT.EVENT_SEQ_PROPERTY)||0),next=Math.max(max,saved)+1;p.setProperty(NICE_CERT.EVENT_SEQ_PROPERTY,String(next));return next}finally{lock.releaseLock()}}
function niceCertNewCode_(eventId){return'CERT-NICE-'+String(eventId).padStart(5,'0')+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase()}
function niceCertCanonical_(o){return[o.codigo,o.eventId,o.nome,o.titulo,o.data,o.carga,o.emitido].map(v=>String(v==null?'':v).trim()).join('|')}
function niceCertSign_(text){const secret=PropertiesService.getScriptProperties().getProperty(NICE_CERT.SIGNING_SECRET_PROPERTY);if(!secret)throw new Error('CERT_SIGNING_SECRET não configurado. Execute instalarSistemaCertificados().');return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text,secret)).replace(/=+$/,'')}
function niceCertIssuedCount_(id){const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues();if(v.length<2)return 0;const m=niceCertHeaderMap_(v[0]);let n=0;for(let i=1;i<v.length;i++)if(Number(v[i][m.EVENTO_ID])===Number(id)&&['ENVIADO','ATIVO'].includes(String(v[i][m.STATUS]||'').toUpperCase()))n++;return n}
function niceCertFindEvent_(id){const sh=niceCertEventsSheet_(),v=sh.getDataRange().getValues();if(v.length<2)return null;const m=niceCertHeaderMap_(v[0]);for(let i=1;i<v.length;i++)if(Number(v[i][m.EVENTO_ID])===Number(id)){const o={};v[0].forEach((h,j)=>o[String(h)]=v[i][j]);return o}return null}
function niceCertObjectFromRow_(sh,row){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],v=sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0],o={};h.forEach((x,i)=>o[String(x)]=v[i]);return o}
function niceCertEventsSheet_(){return niceCertRequireSheet_(NICE_CERT.EVENTOS)}
function niceCertIssuesSheet_(){return niceCertRequireSheet_(NICE_CERT.EMISSOES)}
function niceCertRequireSheet_(name){const sh=niceMaster_().getSheetByName(name);if(!sh)throw new Error('Execute instalarSistemaCertificados().');return sh}
function niceCertSheet_(ss,name,heads){let sh=ss.getSheetByName(name)||ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,heads.length).setValues([heads]);const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getDisplayValues()[0];heads.forEach(h=>{if(!current.includes(h)){sh.getRange(1,sh.getLastColumn()+1).setValue(h);current.push(h)}});sh.setFrozenRows(1);return sh}
function niceCertHeaderMap_(h){const m={};h.forEach((x,i)=>m[String(x).trim()]=i);return m}
function niceCertGetByMap_(sh,row,m,key){return m[key]===undefined?'':sh.getRange(row,m[key]+1).getValue()}
function niceCertSetByMap_(sh,row,m,key,val){if(m[key]===undefined)return;sh.getRange(row,m[key]+1).setValue(val)}
function niceCertAppendObject_(sh,obj){const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];sh.appendRow(h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:''))}
function niceCertLog_(action,eventId,code,detail){const sh=niceCertRequireSheet_(NICE_CERT.LOG);sh.appendRow([new Date(),action,eventId||'',code||'',String(detail||'').slice(0,2000),Session.getEffectiveUser().getEmail()||''])}
function niceCertPrompt_(ui,title,text){const r=ui.prompt(title,text,ui.ButtonSet.OK_CANCEL);return r.getSelectedButton()===ui.Button.OK?r.getResponseText():null}
function niceCertParseBrDate_(s){const m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return null;const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));return isNaN(d)?null:d}
function niceCertDate_(v){if(!v)return null;if(Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v))return v;const d=new Date(v);return isNaN(d)?null:d}
function niceCertBrDate_(v){const d=niceCertDate_(v);return d?Utilities.formatDate(d,Session.getScriptTimeZone()||'America/Sao_Paulo','dd/MM/yyyy'):'data não informada'}
function niceCertIsoDate_(v){const d=niceCertDate_(v);return d?Utilities.formatDate(d,'UTC','yyyy-MM-dd'):''}
function niceCertHtml_(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function niceCertEnsureRootFolder_(){const p=PropertiesService.getScriptProperties();let id=p.getProperty(NICE_CERT.ROOT_FOLDER_PROPERTY);if(id){try{return DriveApp.getFolderById(id)}catch(_){}}let parent=null;try{const rootId=String(niceConfig_('ROOT_FOLDER_ID','')).trim();if(rootId)parent=DriveApp.getFolderById(rootId)}catch(_){}const folder=parent?niceFolder_(parent,'05_Certificados_NICE'):DriveApp.createFolder('NICE - Certificados');p.setProperty(NICE_CERT.ROOT_FOLDER_PROPERTY,folder.getId());return folder}
function niceCertEventFolder_(id,title){const root=niceCertEnsureRootFolder_(),name='Evento '+String(id).padStart(5,'0')+' - '+String(title||'Evento').replace(/[\\/:*?"<>|]/g,' ').slice(0,120);return niceFolder_(root,name)}
function niceCertFolderFromUrl_(url){const m=String(url||'').match(/[-\w]{20,}/);if(!m)throw new Error('Pasta do evento não localizada.');return DriveApp.getFolderById(m[0])}