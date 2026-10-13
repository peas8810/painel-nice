/** Cursos e Eventos: armazenamento próprio, emissão e validação compartilhadas. */
const NICE_COURSES_ROLES=['Participante','Concluinte','Palestrante','Organizador','Coordenador','Monitor'];
function instalarCursosEventos(){niceCoursesSheet_();}
function niceCoursesSheet_(){return niceCertSheet_(niceMaster_(),'CERT_CURSOS_EVENTOS',['ID','LINK_ID','CLIENTE_ID','DADOS_ARQUIVO_ID','CRIADO_EM']);}
function niceCoursesAll_(){const v=niceCoursesSheet_().getDataRange().getValues();return v.slice(1).filter(r=>r[3]).map(r=>JSON.parse(DriveApp.getFileById(String(r[3])).getBlob().getDataAsString()));}
function niceCoursesByLink_(id){return niceCoursesAll_().find(c=>c.link_id===id)||null;}
function niceCoursesText_(s,n){return niceCertDashboardClean_(s,n);}
function niceCoursesImage_(s){s=String(s||'');if(!s)return '';if(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s)||s.length>120000)throw new Error('Use imagem PNG/JPEG de até 85 KB.');return s;}
function niceCoursesValidate_(c){
  c=c||{};const out={};
  ['cliente','cliente_id','documento','emissor','titulo','data','modalidade','local','criterios','signatario','cargo','signatario2','cargo2'].forEach(k=>out[k]=niceCoursesText_(c[k]||'',k==='criterios'?700:180));
  if(!out.cliente||!out.emissor||!out.titulo||!out.data||!out.signatario)throw new Error('Preencha cliente, emissor, título, data e signatário.');
  out.cliente_id=out.cliente_id||Utilities.getUuid();
  out.limite_total=niceCoursesLimit_(c.limite_total,100);out.limite_pessoa=niceCoursesLimit_(c.limite_pessoa,3);out.gestao_cliente=true;
  out.layout=['institucional','moderno','classico'].includes(c.layout)?c.layout:'institucional';
  out.cor=/^#[0-9a-f]{6}$/i.test(c.cor||'')?c.cor:'#17365D';
  out.logo=niceCoursesImage_(c.logo);out.assinatura=niceCoursesImage_(c.assinatura);out.assinatura2=niceCoursesImage_(c.assinatura2);
  out.conteudo=String(c.conteudo||'').replace(/[<>]/g,'').replace(/\r\n?/g,'\n').replace(/[\t ]+/g,' ').trim().slice(0,6000);
  out.conteudo_formato=['justificado','topicos'].includes(c.conteudo_formato)?c.conteudo_formato:'justificado';
  if(out.documento.replace(/\D/g,'').length===11)throw new Error('Não informe CPF no campo público. Use nome ou CNPJ.');
  const people=Array.isArray(c.pessoas)?c.pessoas:[];
  if(people.length>500)throw new Error('Cadastre até 500 pessoas autorizadas por evento.');
  const seen={};out.pessoas=people.map(p=>{const nome=niceCoursesText_(p.nome,180),email=String(p.email||'').trim().toLowerCase(),funcao=String(p.funcao||''),carga=Number(String(p.carga||'').replace(',','.')),tema=niceCoursesText_(p.tema||'',180);
    if(nome.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!NICE_COURSES_ROLES.includes(funcao)||!isFinite(carga)||carga<=0||carga>10000)throw new Error('Pessoa inválida: '+nome+'. Confira e-mail, função e horas.');
    const key=email+'|'+funcao;if(seen[key])throw new Error('E-mail e função duplicados: '+email);seen[key]=true;
    if(funcao==='Concluinte'&&p.aprovado!==true)throw new Error('Confirme os critérios de conclusão para '+nome);
    return{nome,email,funcao,carga:String(carga)+' horas',tema,aprovado:p.aprovado===true};});return out;
}
function niceCoursesAdmin_(op,p){
  if(op==='courses_list'){const links=niceCertCustomAdminList_().links;return{ok:true,courses:niceCoursesAll_().map(c=>Object.assign({},c,{link:links.find(l=>l.id===c.link_id)}))};}
  if(op==='courses_update')return niceCoursesUpdate_(p);
  if(op==='courses_create'){
    const c=niceCoursesValidate_(JSON.parse(p.dados||'{}'));
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try{const result=niceCertCustomCreateLink_({rotulo:c.titulo,instituicao_emissora:c.emissor,emissao_inicio:p.emissao_inicio,emissao_fim:p.emissao_fim});if(!result.ok)return result;
      c.revisao=1;c.id='CUR-'+Utilities.getUuid().slice(0,8).toUpperCase();c.link_id=result.link.id;c.url=result.link.url_publica.replace('/customizado/','/cursos/');
      const dataFile=niceCertFolderFromUrl_(niceCertCustomGetLinkById_(c.link_id).pasta_drive).createFile(Utilities.newBlob(JSON.stringify(c),'application/json',c.id+'.json'));
      niceCertAppendObject_(niceCoursesSheet_(),{ID:c.id,LINK_ID:c.link_id,CLIENTE_ID:c.cliente_id,DADOS_ARQUIVO_ID:dataFile.getId(),CRIADO_EM:new Date()});
      niceCertLog_('CURSO_EVENTO_CRIADO',c.id,'',c.cliente+' · '+c.titulo);return{ok:true,course:c};
    }finally{lock.releaseLock();}
  }
  if(op==='courses_limits')return niceCoursesSetLimits_(p);
  if(op==='courses_issue'){const c=niceCoursesAll_().find(x=>x.id===p.id);if(!c)throw new Error('Evento não encontrado.');const link=niceCertCustomGetLinkById_(c.link_id);return niceCertCustomIssue_({chave:link.token,email:p.email,funcao:p.funcao});}
  return{ok:false,error:'Operação de cursos não reconhecida.'};
}
function niceCoursesPublic_(token){const link=niceCertCustomGetLinkByToken_(token);if(!link)throw new Error('Link inválido.');const c=niceCoursesByLink_(link.id);if(!c)throw new Error('Curso não encontrado.');return{ok:true,course:{titulo:c.titulo,cliente:c.cliente,logo:c.logo,data:c.data,modalidade:c.modalidade,local:c.local,criterios:c.criterios,funcoes:NICE_COURSES_ROLES,limite_total:c.limite_total==null?100:c.limite_total,limite_pessoa:c.limite_pessoa==null?3:c.limite_pessoa},link:niceCertCustomPublicLink_(token).link};}
function niceCoursesAuthorize_(link,p){const c=niceCoursesByLink_(link.id);if(!c)return p;const email=String(p.email||'').trim().toLowerCase();const person=c.pessoas.find(x=>x.email===email&&x.funcao===p.funcao);if(!person)throw new Error('Não há autorização para este e-mail e função. Consulte o responsável.');return Object.assign({},p,{nome:person.nome,email,funcao:person.funcao,carga:person.carga,evento:c.titulo});}
function niceCoursesBlob_(data){const parts=data.split(',');return Utilities.newBlob(Utilities.base64Decode(parts[1]),data.includes('image/png')?'image/png':'image/jpeg','imagem');}
function niceCoursesPdf_(link,cert,c){
  const presentationFormat=c.conteudo_formato;
  c=Object.assign({},niceCoursesSnapshot_(link,cert.codigo,c));
  if(presentationFormat)c.conteudo_formato=presentationFormat;
  const folder=niceCertFolderFromUrl_(link.pasta_drive);
  const file=folder.createFile(Utilities.newBlob('%PDF-1.4\n%Documento em geração','application/pdf',cert.codigo+'.pdf'));
  try{
  const pres=SlidesApp.create('TMP '+cert.codigo),slide=pres.getSlides()[0];slide.getPageElements().forEach(x=>x.remove());
  const color=c.cor,font=c.layout==='classico'?'Georgia':'Arial';
  function text(t,x,y,w,h,size,bold,align){if(!String(t||'').trim())return null;const box=niceCertText_(slide,t,x,y,w,h,size,color,bold,align||'CENTER');box.getText().getTextStyle().setFontFamily(font);return box;}
  const border=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,18,18,684,369);border.getFill().setTransparent();border.getBorder().getLineFill().setSolidFill(color);border.getBorder().setWeight(c.layout==='moderno'?5:1.5);
  if(c.logo)slide.insertImage(niceCoursesBlob_(c.logo),45,30,65,45);
  text(c.cliente,120,32,480,25,15,true);text(c.documento?'CNPJ / identificação: '+c.documento:'',120,58,480,15,8,false);
  text(cert.funcao==='Concluinte'?'CERTIFICADO DE CONCLUSÃO':'CERTIFICADO',60,88,600,30,22,true);
  text(cert.nome,50,129,620,36,23,true);
  const person=c.pessoas.find(p=>p.email===cert.email&&p.funcao===cert.funcao)||{};
  const verbs={Participante:'participou de',Concluinte:'concluiu',Palestrante:'atuou como palestrante em',Organizador:'atuou na organização de',Coordenador:'atuou na coordenação de',Monitor:'atuou como monitor em'};
  text('Certificamos que '+(verbs[cert.funcao]||'participou de')+' “'+cert.evento+'”, realizado em '+c.data+', na modalidade '+c.modalidade+(c.local?' — '+c.local:'')+', com carga horária de '+cert.carga+'.'+(person.tema?' Tema: '+person.tema+'.':''),65,174,590,65,11,false);
  if(c.assinatura)slide.insertImage(niceCoursesBlob_(c.assinatura),170,243,120,28);
  text(c.signatario+'\n'+c.cargo,110,273,250,28,9,false);
  if(c.signatario2){if(c.assinatura2)slide.insertImage(niceCoursesBlob_(c.assinatura2),445,243,120,28);text(c.signatario2+'\n'+c.cargo2,385,273,250,28,9,false);}
  text(cert.livro_digital+' · Registro '+cert.registro_digital+' · '+cert.via_emitida,60,305,600,12,8,false);
  niceCoursesValidationPanel_(slide,cert,c.emissor,file.getUrl(),color);
  if(c.conteudo){niceCoursesContentPages_(c.conteudo,c.conteudo_formato).forEach((chunk,i)=>{const back=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);niceCertText_(back,'CONTEÚDO PROGRAMÁTICO · '+(i+1),45,30,630,30,17,color,true,'CENTER');const box=niceCertText_(back,chunk,45,85,630,260,11,'#333333',false,'START');box.getText().getParagraphStyle().setParagraphAlignment(c.conteudo_formato==='topicos'?SlidesApp.ParagraphAlignment.START:SlidesApp.ParagraphAlignment.JUSTIFIED);niceCertText_(back,cert.codigo+' · '+cert.livro_digital+' · Registro '+cert.registro_digital,45,365,630,18,8,color,false,'CENTER');});}
  pres.saveAndClose();Utilities.sleep(2000);const source=DriveApp.getFileById(pres.getId());const blob=source.getBlob().getAs(MimeType.PDF).setName(cert.codigo+'.pdf');
  niceCoursesUploadPdf_(file.getId(),blob);file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);source.setTrashed(true);return{blob,url:file.getUrl(),id:file.getId()};
  }catch(err){file.setTrashed(true);throw err;}

}
function niceCoursesMail_(c,email,nome,evento,funcao,blob,codigo){const url=NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(codigo),plain='Olá, '+nome+'.\n\nSeu certificado de '+evento+' está anexo.\nFunção: '+funcao+'\nCódigo: '+codigo+'\nValidação: '+url+'\n\n'+c.cliente+' · Protocolo.me';const opts={attachments:[blob],name:c.cliente+' · Certificados'};Object.assign(opts,niceCertSenderOptions_());GmailApp.sendEmail(email,'Certificado · '+evento,plain,opts);}

/** Conserva a identidade usada por cada documento registrado. */
function niceCoursesSnapshot_(link,code,course){
  const folder=niceCertFolderFromUrl_(link.pasta_drive),name=code+'-identidade.json',files=folder.getFilesByName(name);
  if(files.hasNext())return JSON.parse(files.next().getBlob().getDataAsString());
  folder.createFile(Utilities.newBlob(JSON.stringify(course),'application/json',name));return course;
}
function niceCoursesUpdate_(p){
  const c=niceCoursesValidate_(JSON.parse(p.dados||'{}'));
  const inicio=niceCertParseLocalDateTime_(p.emissao_inicio),fim=niceCertParseLocalDateTime_(p.emissao_fim);
  if(p.emissao_inicio&&!inicio||p.emissao_fim&&!fim||inicio&&fim&&fim<=inicio)throw new Error('Período de emissão inválido.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=niceCoursesSheet_(),v=sh.getDataRange().getValues(),index=v.findIndex((row,i)=>i>0&&String(row[0])===String(p.id));
    if(index<1)throw new Error('Evento não encontrado.');
    const file=DriveApp.getFileById(String(v[index][3])),old=JSON.parse(file.getBlob().getDataAsString());
    if(Number(p.revisao)!==Number(old.revisao||1))throw new Error('Este evento foi alterado em outra sessão. Atualize a lista e abra a edição novamente.');
    const link=niceCertCustomGetLinkById_(old.link_id);if(!link)throw new Error('Link do evento não encontrado.');
    // Congela os modelos já emitidos antes de trocar a identidade do evento.
    const issues=niceCertIssuesSheet_().getDataRange().getValues(),h=niceCertHeaderMap_(issues[0]);
    issues.slice(1).filter(row=>String(row[h.CUSTOM_LINK_ID])===old.link_id&&row[h.CODIGO]).forEach(row=>niceCoursesSnapshot_(link,String(row[h.CODIGO]),old));
    const folder=niceCertFolderFromUrl_(link.pasta_drive);
    folder.createFile(Utilities.newBlob(JSON.stringify(old),'application/json',old.id+'-revisao-'+Number(old.revisao||1)+'-'+Utilities.getUuid()+'.json'));
    Object.assign(c,{id:old.id,link_id:old.link_id,url:old.url,cliente_id:old.cliente_id,revisao:Number(old.revisao||1)+1,atualizado_em:new Date().toISOString()});
    const links=niceCertCustomLinksSheet_(),lv=links.getDataRange().getValues(),lh=niceCertHeaderMap_(lv[0]),li=lv.findIndex((row,i)=>i>0&&Number(row[lh.LINK_ID])===link.id_num);
    if(li<1)throw new Error('Registro de link não encontrado.');
    file.setContent(JSON.stringify(c));
    const fields={ROTULO:c.titulo,INSTITUICAO_EMISSORA:c.emissor,EMISSAO_INICIO:inicio||'',EMISSAO_FIM:fim||'',ATUALIZADO_EM:new Date()};
    Object.keys(fields).forEach(k=>niceCertSetByMap_(links,li+1,lh,k,fields[k]));
    niceCertLog_('CURSO_EVENTO_EDITADO',c.id,'','Revisão '+c.revisao+' · '+c.titulo);
    return{ok:true,course:c,message:'Alterações salvas. Os PDFs já emitidos permanecem preservados; as próximas emissões usam os novos dados.'};
  }finally{lock.releaseLock();}
}

/** Limites comerciais: somente o administrador altera. */
function niceCoursesLimit_(v,fallback){if(v==null||v==='')return fallback;const n=Number(v);if(!Number.isInteger(n)||n<0||n>100000)throw new Error('Informe um limite inteiro de 0 a 100000.');return n;}
function niceCoursesQuotaSheet_(){return niceCertSheet_(niceMaster_(),'CERT_CURSOS_COTAS',['SOLICITACAO_ID','CURSO_ID','EMAIL','STATUS','CODIGO','CRIADO_EM','ATUALIZADO_EM','ERRO','PESO']);}
function niceCoursesQuota_(c,email){const v=niceCoursesQuotaSheet_().getDataRange().getValues(),h=niceCertHeaderMap_(v[0]),rows=v.slice(1).filter(r=>r[h.CURSO_ID]===c.id&&['RESERVADO','CONCLUIDO'].includes(r[h.STATUS]));const done=rows.filter(r=>r[h.STATUS]==='CONCLUIDO'),weight=r=>Number(r[h.PESO])||1,used=done.reduce((n,r)=>n+weight(r),0),held=rows.filter(r=>r[h.STATUS]==='RESERVADO').reduce((n,r)=>n+weight(r),0);return{limite_total:c.limite_total==null?100:c.limite_total,limite_pessoa:c.limite_pessoa==null?3:c.limite_pessoa,usados:used,reservados:held,disponiveis:Math.max(0,(c.limite_total==null?100:c.limite_total)-used-held),pessoa_usados:email?rows.filter(r=>r[h.EMAIL]===email).reduce((n,r)=>n+weight(r),0):0};}
function niceCoursesLoadClient_(token){const link=niceCertCustomGetLinkByToken_(token);if(!link)throw new Error('Link de cliente inválido.');const c=niceCoursesByLink_(link.id);if(!c)throw new Error('Evento não encontrado.');return{c,link};}
function niceCoursesStore_(c){const v=niceCoursesSheet_().getDataRange().getValues(),row=v.find(r=>r[0]===c.id);if(!row)throw new Error('Evento não encontrado.');c.revisao=Number(c.revisao||1)+1;DriveApp.getFileById(String(row[3])).setContent(JSON.stringify(c));}
function niceCoursesSetLimits_(p){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const c=niceCoursesAll_().find(c=>c.id===p.id);if(!c)throw new Error('Evento não encontrado.');c.limite_total=niceCoursesLimit_(p.limite_total,100);c.limite_pessoa=niceCoursesLimit_(p.limite_pessoa,3);niceCoursesStore_(c);niceCertLog_('LIMITE_CURSO_ALTERADO',c.id,'','Total '+c.limite_total+' · Por pessoa '+c.limite_pessoa);return{ok:true,quota:niceCoursesQuota_(c)};}finally{lock.releaseLock();}}
function niceCoursesClientData_(token){const {c,link}=niceCoursesLoadClient_(token);const lock=LockService.getScriptLock();lock.waitLock(30000);try{niceCoursesBaselineLocked_(c)}finally{lock.releaseLock();}const issues=niceCertIssuesSheet_().getDataRange().getValues(),h=niceCertHeaderMap_(issues[0]);return{ok:true,course:niceCoursesPublic_(token).course,link:niceCertCustomPublicLink_(token).link,quota:niceCoursesQuota_(c),pessoas:c.pessoas,certificados:issues.slice(1).filter(r=>r[h.CUSTOM_LINK_ID]===link.id).map(r=>({nome:r[h.NOME],email:r[h.EMAIL],funcao:r[h.FUNCAO_EVENTO],codigo:r[h.CODIGO],status:r[h.STATUS],emitido_em:niceApiIso_(r[h.EMITIDO_EM])}))};}
function niceCoursesPerson_(p,c){const person={nome:p.nome,email:p.email,funcao:p.funcao,carga:String(p.carga||'').replace(/\s*horas?\s*$/i,''),tema:p.tema,aprovado:p.aprovado===true||p.aprovado==='true'};return niceCoursesValidate_(Object.assign({},c,{pessoas:[person]})).pessoas[0];}
function niceCoursesEnrollLocked_(c,p){const person=niceCoursesPerson_(p,c),i=c.pessoas.findIndex(x=>x.email===person.email&&x.funcao===person.funcao);if(i>=0){const old=c.pessoas[i];if(old.nome!==person.nome||old.carga!==person.carga||old.tema!==person.tema){const issues=niceCertIssuesSheet_().getDataRange().getValues(),h=niceCertHeaderMap_(issues[0]);if(issues.slice(1).some(r=>r[h.CUSTOM_LINK_ID]===c.link_id&&String(r[h.EMAIL]).toLowerCase()===person.email&&r[h.FUNCAO_EVENTO]===person.funcao&&r[h.CODIGO]))throw new Error('Essa pessoa e função já têm certificado registrado. Para corrigir os dados, contate o administrador.');}c.pessoas[i]=person;}else{if(c.pessoas.length>=500)throw new Error('Limite de 500 cadastros por evento.');c.pessoas.push(person);}niceCoursesStore_(c);return person;}
function niceCoursesClientSave_(p){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const {c,link}=niceCoursesLoadClient_(p.chave);if(!niceCertEmissionWindow_({STATUS:link.status,EMISSAO_INICIO:link.emissao_inicio,EMISSAO_FIM:link.emissao_fim}).open)throw new Error('Este link está fechado para alterações.');const person=niceCoursesEnrollLocked_(c,p);return{ok:true,person,message:'Pessoa cadastrada. O cadastro não consome a franquia.'};}finally{lock.releaseLock();}}
function niceCoursesClientIssue_(p){
  const request=String(p.solicitacao_id||Utilities.getUuid());if(!/^[A-Za-z0-9_-]{8,100}$/.test(request))throw new Error('Solicitação inválida.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);let row,person,link,c;
  try{
    ({c,link}=niceCoursesLoadClient_(p.chave||p.token));
    const window=niceCertEmissionWindow_({STATUS:link.status,EMISSAO_INICIO:link.emissao_inicio,EMISSAO_FIM:link.emissao_fim});if(!window.open)throw new Error(window.message);
    const sh=niceCoursesQuotaSheet_(),v=sh.getDataRange().getValues(),h=niceCertHeaderMap_(v[0]),index=v.findIndex((r,i)=>i>0&&r[h.SOLICITACAO_ID]===request);
    if(index>0){if(v[index][h.CURSO_ID]!==c.id)throw new Error('Solicitação inválida.');if(v[index][h.STATUS]==='CONCLUIDO')return{ok:true,code:v[index][h.CODIGO],message:'Esta solicitação já foi concluída.',reused:true};throw new Error(v[index][h.STATUS]==='RESERVADO'?'Emissão em andamento. Aguarde e atualize a lista.':'A tentativa anterior falhou. Confira o histórico e faça uma nova solicitação.');}
    const existing=c.pessoas.find(x=>x.email===String(p.email||'').trim().toLowerCase()&&x.funcao===p.funcao);
    person=niceCoursesPerson_(p.nome?p:existing||p,c);
    niceCoursesBaselineLocked_(c);const quota=niceCoursesQuota_(c,person.email);if(quota.disponiveis<=0)throw new Error('O limite deste link foi atingido. Solicite mais emissões ao administrador.');if(quota.pessoa_usados>=quota.limite_pessoa)throw new Error('O limite de envios para esta pessoa foi atingido. Solicite ajuste ao administrador.');
    person=niceCoursesEnrollLocked_(c,person);
    niceCertAppendObject_(sh,{SOLICITACAO_ID:request,CURSO_ID:c.id,EMAIL:person.email,STATUS:'RESERVADO',CRIADO_EM:new Date(),ATUALIZADO_EM:new Date()});row=sh.getLastRow();
  }finally{lock.releaseLock();}
  try{const out=niceCertCustomIssue_({chave:link.token,email:person.email,funcao:person.funcao},true);if(!out.ok)throw new Error(out.error||'Falha na emissão.');niceCoursesFinishQuota_(row,'CONCLUIDO',out.code,'');return Object.assign({},out,{quota:niceCoursesQuota_(c),message:out.message+' Um envio utilizado da franquia.'});}
  catch(err){niceCoursesFinishQuota_(row,'FALHOU','',String(err.message||err));throw err;}
}
function niceCoursesFinishQuota_(row,status,code,error){const lock=LockService.getScriptLock();lock.waitLock(30000);try{const sh=niceCoursesQuotaSheet_(),h=niceCertHeaderMap_(sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0]);niceCertSetByMap_(sh,row,h,'STATUS',status);niceCertSetByMap_(sh,row,h,'CODIGO',code);niceCertSetByMap_(sh,row,h,'ERRO',error);niceCertSetByMap_(sh,row,h,'ATUALIZADO_EM',new Date());}finally{lock.releaseLock();}}
/** Importa o uso anterior uma única vez, sem reiniciar saldo na atualização. */
function niceCoursesBaselineLocked_(c){
  const sh=niceCoursesQuotaSheet_(),v=sh.getDataRange().getValues(),h=niceCertHeaderMap_(v[0]),seen=new Set(v.slice(1).map(r=>String(r[h.SOLICITACAO_ID])));
  const issues=niceCertIssuesSheet_().getDataRange().getValues(),ih=niceCertHeaderMap_(issues[0]);
  issues.slice(1).filter(r=>r[ih.CUSTOM_LINK_ID]===c.link_id&&r[ih.CODIGO]&&['ENVIADO','ATIVO','REVOGADO'].includes(r[ih.STATUS])).forEach(r=>{
    const code=String(r[ih.CODIGO]),id='ANTERIOR_'+code;
    if(seen.has(id)||v.slice(1).some(q=>q[h.CURSO_ID]===c.id&&q[h.CODIGO]===code))return;
    niceCertAppendObject_(sh,{SOLICITACAO_ID:id,CURSO_ID:c.id,EMAIL:String(r[ih.EMAIL]||'').toLowerCase(),STATUS:'CONCLUIDO',CODIGO:code,CRIADO_EM:new Date(),ATUALIZADO_EM:new Date(),PESO:Math.max(1,Number(r[ih.TENTATIVAS_EMAIL])||1)});seen.add(id);
  });
}

/** Reserva o ID antes de gerar, para o QR apontar ao próprio PDF. */
function niceCoursesUploadPdf_(id,blob){
  const response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(id)+'?uploadType=media',{method:'patch',contentType:'application/pdf',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:blob.getBytes(),muteHttpExceptions:true});
  if(response.getResponseCode()<200||response.getResponseCode()>=300)throw new Error('Não foi possível salvar o PDF digital no Drive (HTTP '+response.getResponseCode()+').');
}
function niceCoursesValidationPanel_(slide,cert,issuer,pdfUrl,color){
  const qr=(url,x,label)=>{const blob=UrlFetchApp.fetch('https://quickchart.io/qr?size=360&margin=1&ecLevel=M&text='+encodeURIComponent(url)).getBlob();slide.insertImage(blob,x,323,52,52);niceCertText_(slide,label,x-7,377,66,10,6,color,true,'CENTER');};
  qr(NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(cert.codigo),45,'VALIDAR');qr(pdfUrl,119,'ABRIR PDF');
  niceCertText_(slide,'Código: '+cert.codigo,187,324,282,14,8,color,true,'START');
  const access=niceCertText_(slide,'Abrir certificado digital no Drive',187,343,282,14,9,color,true,'START');access.getText().getTextStyle().setLinkUrl(pdfUrl);
  niceCertText_(slide,'HMAC-SHA256: '+String(cert.signature||'').slice(0,22)+'…',187,363,282,12,7,color,false,'START');
  niceCertText_(slide,'INSTITUIÇÃO EMISSORA',480,325,192,13,8,color,true,'CENTER');niceCertText_(slide,issuer,480,342,192,28,9,color,false,'CENTER');
}
function niceCoursesContentPages_(content,format){
  let lines=String(content||'').replace(/\r\n?/g,'\n').split('\n').map(x=>x.trim()).filter(Boolean);
  if(format==='topicos'&&lines.length===1)lines=lines[0].split(/\s+[-–]\s+/).filter(Boolean);
  if(format==='topicos')lines=lines.map(x=>'• '+x.replace(/^[•*-]\s*/,''));
  const pages=[];let page=[],height=0;
  lines.forEach(line=>{const words=line.split(/\s+/);let part='';const pieces=[];for(const word of words){if(part.length+word.length+1>1500){pieces.push(part);part='';}part+=(part?' ':'')+word;}if(part)pieces.push(part);pieces.forEach(piece=>{const used=Math.ceil(piece.length/100)+(format==='topicos'?1:0);if(height+used>18&&page.length){pages.push(page.join('\n'));page=[];height=0;}page.push(piece);height+=used;});});
  if(page.length)pages.push(page.join('\n'));return pages;
}
