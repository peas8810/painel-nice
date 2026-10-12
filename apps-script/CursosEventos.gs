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
  out.layout=['institucional','moderno','classico'].includes(c.layout)?c.layout:'institucional';
  out.cor=/^#[0-9a-f]{6}$/i.test(c.cor||'')?c.cor:'#17365D';
  out.logo=niceCoursesImage_(c.logo);out.assinatura=niceCoursesImage_(c.assinatura);out.assinatura2=niceCoursesImage_(c.assinatura2);
  out.conteudo=niceCoursesText_(c.conteudo||'',6000);
  if(out.documento.replace(/\D/g,'').length===11)throw new Error('Não informe CPF no campo público. Use nome ou CNPJ.');
  const people=Array.isArray(c.pessoas)?c.pessoas:[];
  if(!people.length||people.length>500)throw new Error('Cadastre de 1 a 500 pessoas autorizadas por evento.');
  const seen={};out.pessoas=people.map(p=>{const nome=niceCoursesText_(p.nome,180),email=String(p.email||'').trim().toLowerCase(),funcao=String(p.funcao||''),carga=Number(String(p.carga||'').replace(',','.')),tema=niceCoursesText_(p.tema||'',180);
    if(nome.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!NICE_COURSES_ROLES.includes(funcao)||!isFinite(carga)||carga<=0||carga>10000)throw new Error('Pessoa inválida: '+nome+'. Confira e-mail, função e horas.');
    const key=email+'|'+funcao;if(seen[key])throw new Error('E-mail e função duplicados: '+email);seen[key]=true;
    if(funcao==='Concluinte'&&p.aprovado!==true)throw new Error('Confirme os critérios de conclusão para '+nome);
    return{nome,email,funcao,carga:String(carga)+' horas',tema,aprovado:p.aprovado===true};});return out;
}
function niceCoursesAdmin_(op,p){
  if(op==='courses_list'){const links=niceCertCustomAdminList_().links;return{ok:true,courses:niceCoursesAll_().map(c=>Object.assign({},c,{link:links.find(l=>l.id===c.link_id)}))};}
  if(op==='courses_create'){
    const c=niceCoursesValidate_(JSON.parse(p.dados||'{}'));
    const lock=LockService.getScriptLock();lock.waitLock(30000);
    try{const result=niceCertCustomCreateLink_({rotulo:c.titulo,instituicao_emissora:c.emissor,emissao_inicio:p.emissao_inicio,emissao_fim:p.emissao_fim});if(!result.ok)return result;
      c.id='CUR-'+Utilities.getUuid().slice(0,8).toUpperCase();c.link_id=result.link.id;c.url=result.link.url_publica.replace('/customizado/','/cursos/');
      const dataFile=niceCertFolderFromUrl_(niceCertCustomGetLinkById_(c.link_id).pasta_drive).createFile(Utilities.newBlob(JSON.stringify(c),'application/json',c.id+'.json'));
      niceCertAppendObject_(niceCoursesSheet_(),{ID:c.id,LINK_ID:c.link_id,CLIENTE_ID:c.cliente_id,DADOS_ARQUIVO_ID:dataFile.getId(),CRIADO_EM:new Date()});
      niceCertLog_('CURSO_EVENTO_CRIADO',c.id,'',c.cliente+' · '+c.titulo);return{ok:true,course:c};
    }finally{lock.releaseLock();}
  }
  if(op==='courses_issue'){const c=niceCoursesAll_().find(x=>x.id===p.id);if(!c)throw new Error('Evento não encontrado.');const link=niceCertCustomGetLinkById_(c.link_id);return niceCertCustomIssue_({chave:link.token,email:p.email,funcao:p.funcao});}
  return{ok:false,error:'Operação de cursos não reconhecida.'};
}
function niceCoursesPublic_(token){const link=niceCertCustomGetLinkByToken_(token);if(!link)throw new Error('Link inválido.');const c=niceCoursesByLink_(link.id);if(!c)throw new Error('Curso não encontrado.');return{ok:true,course:{titulo:c.titulo,cliente:c.cliente,logo:c.logo,data:c.data,modalidade:c.modalidade,local:c.local,criterios:c.criterios,funcoes:[...new Set(c.pessoas.map(p=>p.funcao))]},link:niceCertCustomPublicLink_(token).link};}
function niceCoursesAuthorize_(link,p){const c=niceCoursesByLink_(link.id);if(!c)return p;const email=String(p.email||'').trim().toLowerCase();const person=c.pessoas.find(x=>x.email===email&&x.funcao===p.funcao);if(!person)throw new Error('Não há autorização para este e-mail e função. Consulte o responsável.');return Object.assign({},p,{nome:person.nome,email,funcao:person.funcao,carga:person.carga,evento:c.titulo});}
function niceCoursesBlob_(data){const parts=data.split(',');return Utilities.newBlob(Utilities.base64Decode(parts[1]),data.includes('image/png')?'image/png':'image/jpeg','imagem');}
function niceCoursesPdf_(link,cert,c){
  const pres=SlidesApp.create('TMP '+cert.codigo),slide=pres.getSlides()[0];slide.getPageElements().forEach(x=>x.remove());
  const color=c.cor,font=c.layout==='classico'?'Georgia':'Arial';
  function text(t,x,y,w,h,size,bold,align){const box=niceCertText_(slide,t,x,y,w,h,size,color,bold,align||'CENTER');box.getText().getTextStyle().setFontFamily(font);return box;}
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
  niceCertClassicValidation_(slide,cert.codigo,cert.signature,cert.emitido,c.emissor);
  if(c.conteudo){const lines=c.conteudo.split('\n');let chunks=[],current='';for(const line of lines){if((current+line).length>1800){chunks.push(current);current='';}current+=line+'\n';}if(current)chunks.push(current);chunks.forEach((chunk,i)=>{const back=pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);niceCertText_(back,'CONTEÚDO PROGRAMÁTICO · '+(i+1),45,30,630,30,17,color,true,'CENTER');niceCertText_(back,chunk,45,85,630,260,10,'#333333',false,'START');niceCertText_(back,cert.codigo+' · '+cert.livro_digital+' · Registro '+cert.registro_digital,45,365,630,18,8,color,false,'CENTER');});}
  pres.saveAndClose();Utilities.sleep(2000);const source=DriveApp.getFileById(pres.getId());const blob=source.getBlob().getAs(MimeType.PDF).setName(cert.codigo+'.pdf');const file=niceCertFolderFromUrl_(link.pasta_drive).createFile(blob);source.setTrashed(true);return{blob,url:file.getUrl(),id:file.getId()};
}
function niceCoursesMail_(c,email,nome,evento,funcao,blob,codigo){const url=NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(codigo),plain='Olá, '+nome+'.\n\nSeu certificado de '+evento+' está anexo.\nFunção: '+funcao+'\nCódigo: '+codigo+'\nValidação: '+url+'\n\n'+c.cliente+' · Protocolo.me';const opts={attachments:[blob],name:c.cliente+' · Certificados'};Object.assign(opts,niceCertSenderOptions_());GmailApp.sendEmail(email,'Certificado · '+evento,plain,opts);}
