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
  ['cliente','cliente_id','documento','emissor','titulo','data','modalidade','local','criterios','signatario','cargo','signatario2','cargo2','email_signatario','email_signatario2'].forEach(k=>out[k]=niceCoursesText_(c[k]||'',k==='criterios'?700:180));
  if(!out.cliente||!out.emissor||!out.titulo||!out.data||!out.signatario)throw new Error('Preencha cliente, emissor, título, data e signatário.');
  out.cliente_id=out.cliente_id||Utilities.getUuid();
  out.signatarios_por_funcao={};NICE_COURSES_ROLES.forEach(role=>{const choice=c['assinantes_'+role]||(c.signatarios_por_funcao||{})[role]||(['Palestrante','Organizador','Coordenador'].includes(role)&&out.signatario2?'segundo':'ambos');out.signatarios_por_funcao[role]=['ambos','principal','segundo'].includes(choice)?choice:'ambos';});
  out.posicao_assinatura=['esquerda','centro','direita'].includes(c.posicao_assinatura)?c.posicao_assinatura:(out.signatario2?'esquerda':'centro');
  out.posicao_assinatura2=['esquerda','centro','direita'].includes(c.posicao_assinatura2)?c.posicao_assinatura2:'direita';
  if(out.signatario2&&out.posicao_assinatura===out.posicao_assinatura2)throw new Error('Escolha posições diferentes para os dois signatários.');
  out.limite_total=niceCoursesLimit_(c.limite_total,100);out.limite_pessoa=niceCoursesLimit_(c.limite_pessoa,3);out.gestao_cliente=true;
  out.layout=['institucional','moderno','classico'].includes(c.layout)?c.layout:'institucional';
  out.cor=/^#[0-9a-f]{6}$/i.test(c.cor||'')?c.cor:'#17365D';
  out.logo=niceCoursesImage_(c.logo);out.assinatura=niceCoursesImage_(c.assinatura);out.assinatura2=niceCoursesImage_(c.assinatura2);
  out.conteudo=String(c.conteudo||'').replace(/[<>]/g,'').replace(/\r\n?/g,'\n').replace(/[\t ]+/g,' ').trim().slice(0,6000);
  out.conteudo_fonte=Number(c.conteudo_fonte||11);if(!Number.isFinite(out.conteudo_fonte)||out.conteudo_fonte<8||out.conteudo_fonte>18)throw new Error('Fonte do conteúdo deve estar entre 8 e 18 pontos.');
  out.conteudo_formato=['justificado','topicos'].includes(c.conteudo_formato)?c.conteudo_formato:'justificado';
  out.conteudo_rico=niceCoursesRichValidate_(c.conteudo_rico,out.conteudo);
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
  if(op.indexOf('courses_billing_')===0){if(typeof niceCourseBillingAdmin_!=='function')throw new Error('Adicione CursosCobrancas.gs e publique uma nova versão da implantação existente.');return niceCourseBillingAdmin_(op,p);}
  if(op==='courses_batch')return niceBatchDispatch_(p,true);
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
  const currentSignatories={};['signatario','cargo','assinatura','signatario2','cargo2','assinatura2','posicao_assinatura','posicao_assinatura2','email_signatario','email_signatario2','signatarios_por_funcao'].forEach(k=>currentSignatories[k]=c[k]||'');
  const presentationFormat=c.conteudo_formato,presentationRich=c.conteudo_rico,presentationText=c.conteudo,presentationFont=c.conteudo_fonte,presentationPosition=c.posicao_assinatura,presentationPosition2=c.posicao_assinatura2;
  c=Object.assign({},niceCoursesSnapshot_(link,cert.codigo,c),currentSignatories);
  if(presentationFormat)c.conteudo_formato=presentationFormat;
  if(presentationFont)c.conteudo_fonte=presentationFont;
  if(presentationPosition)c.posicao_assinatura=presentationPosition;
  if(presentationPosition2)c.posicao_assinatura2=presentationPosition2;
  if(String(presentationText||'').replace(/\s+/g,' ').trim()===String(c.conteudo||'').replace(/\s+/g,' ').trim())c.conteudo_rico=presentationRich;
  const folder=niceCertFolderFromUrl_(link.pasta_drive);
  const file=folder.createFile(Utilities.newBlob('%PDF-1.4\n%Documento em geração','application/pdf',cert.codigo+'.pdf'));
  try{
  const pres=SlidesApp.create('TMP '+cert.codigo),slide=pres.getSlides()[0];slide.getPageElements().forEach(x=>x.remove());
  const color=c.cor,font=c.layout==='classico'?'Georgia':'Arial';
  function text(t,x,y,w,h,size,bold,align){if(!String(t||'').trim())return null;const box=niceCertText_(slide,t,x,y,w,h,size,color,bold,align||'CENTER');box.getText().getTextStyle().setFontFamily(font);return box;}
  niceCoursesFrame_(slide,color,c.layout);
  if(c.logo)slide.insertImage(niceCoursesBlob_(c.logo),45,30,65,45);
  text(c.cliente,120,32,480,25,15,true);text(c.documento?'CNPJ / identificação: '+c.documento:'',120,58,480,15,8,false);
  text(cert.funcao==='Concluinte'?'CERTIFICADO DE CONCLUSÃO':'CERTIFICADO',60,88,600,30,22,true);
  text(cert.nome,50,129,620,36,23,true);
  const person=c.pessoas.find(p=>p.email===cert.email&&p.funcao===cert.funcao)||{};
  const verbs={Participante:'participou de',Concluinte:'concluiu',Palestrante:'atuou como palestrante em',Organizador:'atuou na organização de',Coordenador:'atuou na coordenação de',Monitor:'atuou como monitor em'};
  text('Certificamos que '+(verbs[cert.funcao]||'participou de')+' “'+cert.evento+'”, realizado em '+c.data+', na modalidade '+c.modalidade+(c.local?' — '+c.local:'')+', com carga horária de '+cert.carga+'.'+(person.tema?' Tema: '+person.tema+'.':''),65,174,590,65,11,false);
  niceCoursesSignatories_(c,cert).forEach(person=>{if(person.assinatura)slide.insertImage(niceCoursesBlob_(person.assinatura),person.x+45,240,120,25);text(person.nome+'\n'+person.cargo,person.x,267,210,38,8,false);});

  niceCoursesValidationPanel_(slide,cert,c.emissor,file.getUrl(),color);
  if(c.conteudo)niceCoursesRenderRich_(pres,c,cert,color,file.getUrl());
  pres.saveAndClose();Utilities.sleep(2000);const source=DriveApp.getFileById(pres.getId());const blob=source.getBlob().getAs(MimeType.PDF).setName(cert.codigo+'.pdf');
  niceCoursesUploadPdf_(file.getId(),blob);file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);source.setTrashed(true);return{blob,url:file.getUrl(),id:file.getId(),modelo_versao:'CURSOS_PDF_V8'};
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
  const card=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,36,309,648,72);card.getFill().setSolidFill('#F5F7FA');card.getBorder().getLineFill().setSolidFill('#D9E1E8');card.getBorder().setWeight(0.8);
  const qr=(url,x,label)=>{const blob=UrlFetchApp.fetch('https://quickchart.io/qr?size=360&margin=2&ecLevel=M&text='+encodeURIComponent(url)).getBlob();slide.insertImage(blob,x,317,44,44);niceCertText_(slide,label,x-3,365,50,9,6,color,true,'CENTER');};
  qr(NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(cert.codigo),48,'VALIDAR');qr(pdfUrl,108,'ABRIR PDF');
  niceCertText_(slide,'Código: '+cert.codigo,170,317,272,12,8,color,true,'START');
  const access=niceCertText_(slide,'Abrir certificado digital no Drive',170,335,272,13,9,color,true,'START');access.getText().getTextStyle().setLinkUrl(pdfUrl);
  niceCertText_(slide,'HMAC-SHA256: '+String(cert.signature||'').slice(0,22)+'…',170,354,272,10,7,color,false,'START');
  niceCertText_(slide,cert.livro_digital+' · Registro '+cert.registro_digital+' · '+String(cert.via_emitida||'1ª Via'),170,368,272,9,6,color,false,'START');
  niceCertText_(slide,'INSTITUIÇÃO EMISSORA',454,317,162,12,7,color,true,'CENTER');niceCertText_(slide,issuer,454,333,162,28,9,color,false,'CENTER');
  niceCoursesPoweredBy_(slide);
}

function niceCoursesContentPages_(content,format){
  let lines=String(content||'').replace(/\r\n?/g,'\n').split('\n').map(x=>x.trim()).filter(Boolean);
  if(format==='topicos'&&lines.length===1)lines=lines[0].split(/\s+[-–]\s+/).filter(Boolean);
  if(format==='topicos')lines=lines.map(x=>'• '+x.replace(/^[•*-]\s*/,''));
  const pages=[];let page=[],height=0;
  lines.forEach(line=>{const words=line.split(/\s+/);let part='';const pieces=[];for(const word of words){if(part.length+word.length+1>1500){pieces.push(part);part='';}part+=(part?' ':'')+word;}if(part)pieces.push(part);pieces.forEach(piece=>{const used=Math.ceil(piece.length/100)+(format==='topicos'?1:0);if(height+used>18&&page.length){pages.push(page.join('\n'));page=[];height=0;}page.push(piece);height+=used;});});
  if(page.length)pages.push(page.join('\n'));return pages;
}

function niceCoursesRichValidate_(input,plain){
  if(!Array.isArray(input)||!input.length)return[];if(input.length>300)throw new Error('Conteúdo excede 300 parágrafos.');
  let total=0;const clean=s=>String(s||'').replace(/[<>]/g,'').replace(/\r/g,'');
  const out=input.map(p=>{const text=clean(p.texto),runs=Array.isArray(p.runs)?p.runs.slice(0,500).map(r=>({texto:clean(r.texto),negrito:r.negrito===true,italico:r.italico===true,sublinhado:r.sublinhado===true})):[];total+=text.length;return{texto:text,alinhamento:['justificado','esquerda','centro','direita'].includes(p.alinhamento)?p.alinhamento:'',runs:runs.map(r=>r.texto).join('')===text?runs:[{texto:text}]};});
  if(total>6000)throw new Error('Conteúdo excede 6000 caracteres.');
  if(out.map(p=>p.texto).join('\n').replace(/\s+/g,' ').trim()!==String(plain||'').replace(/\s+/g,' ').trim())throw new Error('O conteúdo formatado não corresponde ao texto. Revise o editor.');return out;
}
function niceCoursesRichBlocks_(c){
  const font=Number(c.conteudo_fonte)||11,characters=Math.floor(1050/font),lineHeight=font*1.4,maxChunk=characters*Math.floor(210/lineHeight);
  let paragraphs=c.conteudo_rico&&c.conteudo_rico.length?c.conteudo_rico:String(c.conteudo||'').split('\n').filter(x=>x.trim()).map(texto=>({texto,runs:[{texto}]}));
  if(c.conteudo_formato==='topicos'&&paragraphs.length===1&&!c.conteudo_rico?.length)paragraphs=paragraphs[0].texto.split(/\s+[-–]\s+/).map(texto=>({texto,runs:[{texto}]}));
  const blocks=[];paragraphs.forEach(p=>{let text=p.texto,runs=p.runs?.length?p.runs:[{texto:text}];if(c.conteudo_formato==='topicos'&&!/^\s*(?:[•*-]|\d+\.)\s/.test(text)){text='• '+text;runs=[{texto:'• '},...runs];}
    let start=0;while(start<text.length){let end=Math.min(start+maxChunk,text.length);if(end<text.length){const space=text.lastIndexOf(' ',end);if(space>start)end=space;}const sub=text.slice(start,end);let offset=0;const sliced=[];runs.forEach(r=>{const lo=Math.max(start,offset),hi=Math.min(end,offset+r.texto.length);if(hi>lo)sliced.push(Object.assign({},r,{texto:r.texto.slice(lo-offset,hi-offset)}));offset+=r.texto.length;});blocks.push({texto:sub,runs:sliced,alinhamento:p.alinhamento|| (c.conteudo_formato==='topicos'?'esquerda':'justificado'),height:Math.ceil(sub.length/characters)*lineHeight+8});start=end;while(text[start]===' ')start++;}
  });return blocks;
}
function niceCoursesRenderRich_(pres,c,cert,color,pdfUrl){let slide,y;const font=Number(c.conteudo_fonte)||11;
  function page(){slide=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);niceCoursesFrame_(slide,color,c.layout);niceCertText_(slide,'CONTEÚDO PROGRAMÁTICO',45,30,630,30,17,color,true,'CENTER');niceCoursesValidationPanel_(slide,cert,cert.instituicao_emissora||c.emissor,pdfUrl,color);y=80;}
  niceCoursesRichBlocks_(c).forEach(p=>{if(!slide||y+p.height>297)page();const box=niceCertText_(slide,p.texto,45,y,630,p.height,font,'#333333',false,'START'),range=box.getText();const align={justificado:SlidesApp.ParagraphAlignment.JUSTIFIED,esquerda:SlidesApp.ParagraphAlignment.START,centro:SlidesApp.ParagraphAlignment.CENTER,direita:SlidesApp.ParagraphAlignment.END};range.getParagraphStyle().setParagraphAlignment(align[p.alinhamento]);let offset=0;p.runs.forEach(r=>{if(r.texto.length)range.getRange(offset,offset+r.texto.length).getTextStyle().setBold(!!r.negrito).setItalic(!!r.italico).setUnderline(!!r.sublinhado);offset+=r.texto.length;});y+=p.height;});
}

function niceCoursesPersonIdentity_(name){return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(dr|dra|prof|profa|professor|professora|phd)\b\.?/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function niceCoursesSignatories_(c,cert){
 const positions={esquerda:35,centro:255,direita:475};let people=[{slot:'principal',nome:c.signatario,cargo:c.cargo,assinatura:c.assinatura,email:c.email_signatario,posicao:c.posicao_assinatura||(c.signatario2?'esquerda':'centro')}];
 if(c.signatario2)people.push({slot:'segundo',nome:c.signatario2,cargo:c.cargo2,assinatura:c.assinatura2,email:c.email_signatario2,posicao:c.posicao_assinatura2||'direita'});
 if(cert){const choice=(c.signatarios_por_funcao||{})[cert.funcao]||(['Palestrante','Organizador','Coordenador'].includes(cert.funcao)&&c.signatario2?'segundo':'ambos');const before=people.length;people=people.filter(p=>(choice==='ambos'||p.slot===choice)&&niceCoursesPersonIdentity_(p.nome)!==niceCoursesPersonIdentity_(cert.nome)&&!(p.email&&cert.email&&String(p.email).trim().toLowerCase()===String(cert.email).trim().toLowerCase()));
 if(!people.length)throw new Error('Nenhum signatário disponível: o titular não pode assinar o próprio certificado. Configure outro responsável para esta função.');if(people.length===1&&before===2)people[0].posicao='centro';}
 return people.map(p=>Object.assign({},p,{x:positions[p.posicao]}));
}

function niceCoursesPoweredBy_(slide){
  const url='https://protocolo.me/negocios/';
  const brand=niceCertText_(slide,'Powered By: PEAS - Technology®',454,369,216,9,6,'#526B7C',true,'CENTER');brand.getText().getTextStyle().setLinkUrl(url);
  const qr=UrlFetchApp.fetch('https://quickchart.io/qr?size=240&margin=2&ecLevel=M&text='+encodeURIComponent(url)).getBlob();slide.insertImage(qr,632,321,36,36);
}
function niceCoursesFrame_(slide,color,layout){const border=slide.insertShape(SlidesApp.ShapeType.RECTANGLE,18,18,684,369);border.getFill().setTransparent();border.getBorder().getLineFill().setSolidFill(color);border.getBorder().setWeight(layout==='moderno'?3:1.5);}
