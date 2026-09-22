/**
 * NICE Certificados Customizados
 * Links administrativos compartilháveis para certificados de função/participação customizada.
 * O participante informa função, carga horária, nome, evento e e-mail.
 */
const NICE_CERT_CUSTOM = Object.freeze({
  LINKS_SHEET:'CERT_CUSTOM_LINKS',
  LINK_HEADERS:['LINK_ID','TOKEN','ROTULO','INSTITUICAO_EMISSORA','LIVRO_ATA','REGISTRO','VIA_EMITIDA','EMISSAO_INICIO','EMISSAO_FIM','STATUS','URL_PUBLICA','PASTA_DRIVE','CRIADO_EM','ATUALIZADO_EM'],
  OPEN_STATUS:'ABERTO',
  CLOSED_STATUS:'FECHADO',
  PUBLIC_URL:'https://www.protocolo.me/certificados/customizado/'
});

function instalarCertificadosCustomizados(){
  const ss=niceMaster_();
  niceCertSheet_(ss,NICE_CERT_CUSTOM.LINKS_SHEET,NICE_CERT_CUSTOM.LINK_HEADERS);
  niceCertCustomEnsureIssueHeaders_();
  SpreadsheetApp.getUi().alert('Certificados customizados instalados.\n\nUse o Dashboard de Certificados para criar links compartilháveis.');
}

function niceCertCustomEnsureIssueHeaders_(){
  const sh=niceCertIssuesSheet_();
  ['TIPO_CERTIFICADO','FUNCAO_EVENTO','TITULO_EVENTO_CUSTOM','CUSTOM_LINK_ID','LIVRO_ATA','REGISTRO_CERTIFICADO','VIA_EMITIDA','INSTITUICAO_EMISSORA'].forEach(h=>{
    const heads=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
    if(!heads.includes(h)) sh.getRange(1,sh.getLastColumn()+1).setValue(h);
  });
}

function niceCertCustomLinksSheet_(){
  const ss=niceMaster_();
  return niceCertSheet_(ss,NICE_CERT_CUSTOM.LINKS_SHEET,NICE_CERT_CUSTOM.LINK_HEADERS);
}

function niceCertCustomCreateLink_(p){
  niceCertCustomEnsureIssueHeaders_();
  const sh=niceCertCustomLinksSheet_(),v=sh.getDataRange().getValues();
  const h=v.length?niceCertHeaderMap_(v[0]):{};
  let max=0;
  for(let i=1;i<v.length;i++) max=Math.max(max,Number(v[i][h.LINK_ID])||0);
  const id=max+1, code='C'+String(id).padStart(4,'0');
  const token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'').slice(0,40);
  const rotulo=niceCertDashboardClean_(p.rotulo||'Emissão customizada '+code,160);
  const instituicao=niceCertDashboardClean_(p.instituicao_emissora||p.instituicao||'',160);
  const livroAta=niceCertDashboardClean_(p.livro_ata||p.livro||'',80);
  const registro=niceCertDashboardClean_(p.registro||'',80);
  const viaEmitida=niceCertDashboardClean_(p.via_emitida||'1ª Via Emitida',40)||'1ª Via Emitida';
  const inicio=niceCertParseLocalDateTime_(p.emissao_inicio),fim=niceCertParseLocalDateTime_(p.emissao_fim);
  if(String(p.emissao_inicio||'').trim()&&!inicio)return{ok:false,error:'Data/hora inicial inválida.'};
  if(String(p.emissao_fim||'').trim()&&!fim)return{ok:false,error:'Data/hora final inválida.'};
  if(inicio&&fim&&fim<=inicio)return{ok:false,error:'O fim da emissão deve ser posterior ao início.'};
  if(!instituicao)return{ok:false,error:'Informe a instituição emissora.'};
  if(!livroAta)return{ok:false,error:'Informe o Livro Ata.'};
  if(!registro)return{ok:false,error:'Informe o registro do certificado.'};
  const root=niceCertEnsureRootFolder_();
  const folder=niceFolder_(root,'Customizado '+code+' - '+rotulo.replace(/[\\/:*?"<>|]/g,' ').slice(0,80));
  const url=NICE_CERT_CUSTOM.PUBLIC_URL+'?chave='+encodeURIComponent(token);
  const now=new Date();
  niceCertAppendObject_(sh,{LINK_ID:id,TOKEN:token,ROTULO:rotulo,INSTITUICAO_EMISSORA:instituicao,LIVRO_ATA:livroAta,REGISTRO:registro,VIA_EMITIDA:viaEmitida,EMISSAO_INICIO:inicio||'',EMISSAO_FIM:fim||'',STATUS:NICE_CERT_CUSTOM.OPEN_STATUS,URL_PUBLICA:url,PASTA_DRIVE:folder.getUrl(),CRIADO_EM:now,ATUALIZADO_EM:now});
  niceCertLog_('LINK_CUSTOMIZADO_CRIADO',code,'','Link customizado '+rotulo+' · Livro Ata '+livroAta+' · Registro '+registro);
  return {ok:true,link:{id:code,rotulo,instituicao_emissora:instituicao,livro_ata:livroAta,registro,via_emitida:viaEmitida,emissao_inicio:niceCertIsoDateTime_(inicio),emissao_fim:niceCertIsoDateTime_(fim),status:NICE_CERT_CUSTOM.OPEN_STATUS,url_publica:url,emitidos:0}};
}

function niceCertCustomAdminList_(){
  const sh=niceCertCustomLinksSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return{ok:true,links:[]};
  const h=niceCertHeaderMap_(v[0]),issues=niceCertIssuesSheet_().getDataRange().getValues(),ih=issues.length?niceCertHeaderMap_(issues[0]):{},counts={};
  for(let i=1;i<issues.length;i++){
    const lid=String(issues[i][ih.CUSTOM_LINK_ID]||'').trim();
    const st=String(issues[i][ih.STATUS]||'').toUpperCase();
    if(lid&&['ENVIADO','ATIVO','REVOGADO'].includes(st)) counts[lid]=(counts[lid]||0)+1;
  }
  const links=[];
  for(let i=v.length-1;i>=1;i--){
    const id=Number(v[i][h.LINK_ID])||0;if(!id)continue;
    const code='C'+String(id).padStart(4,'0');
    links.push({id:code,rotulo:String(v[i][h.ROTULO]||''),instituicao_emissora:String(v[i][h.INSTITUICAO_EMISSORA]||''),livro_ata:String(v[i][h.LIVRO_ATA]||''),registro:String(v[i][h.REGISTRO]||''),via_emitida:String(v[i][h.VIA_EMITIDA]||'1ª Via Emitida'),emissao_inicio:niceApiIso_(v[i][h.EMISSAO_INICIO]),emissao_fim:niceApiIso_(v[i][h.EMISSAO_FIM]),status:String(v[i][h.STATUS]||''),url_publica:String(v[i][h.URL_PUBLICA]||''),emitidos:counts[code]||0,criado_em:niceApiIso_(v[i][h.CRIADO_EM])});
  }
  return{ok:true,links};
}

function niceCertCustomSetStatus_(p){
  const wanted=String(p.status||'').trim().toUpperCase();
  if(![NICE_CERT_CUSTOM.OPEN_STATUS,NICE_CERT_CUSTOM.CLOSED_STATUS].includes(wanted))return{ok:false,error:'Status inválido.'};
  const id=Number(String(p.link_id||'').replace(/\D/g,''));
  if(!id)return{ok:false,error:'Link inválido.'};
  const sh=niceCertCustomLinksSheet_(),v=sh.getDataRange().getValues(),h=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(Number(v[i][h.LINK_ID])!==id)continue;
    niceCertSetByMap_(sh,i+1,h,'STATUS',wanted);niceCertSetByMap_(sh,i+1,h,'ATUALIZADO_EM',new Date());
    niceCertLog_('LINK_CUSTOMIZADO_'+wanted,'C'+String(id).padStart(4,'0'),'','Alterado pelo dashboard.');
    return{ok:true,id:'C'+String(id).padStart(4,'0'),status:wanted};
  }
  return{ok:false,error:'Link customizado não encontrado.'};
}

function niceCertCustomGetLinkByToken_(token){
  const wanted=String(token||'').trim();if(!wanted)return null;
  const sh=niceCertCustomLinksSheet_(),v=sh.getDataRange().getValues();if(v.length<2)return null;
  const h=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++)if(String(v[i][h.TOKEN]||'')===wanted){
    const id=Number(v[i][h.LINK_ID])||0;
    return{id:'C'+String(id).padStart(4,'0'),id_num:id,token:wanted,rotulo:String(v[i][h.ROTULO]||''),instituicao_emissora:String(v[i][h.INSTITUICAO_EMISSORA]||''),livro_ata:String(v[i][h.LIVRO_ATA]||''),registro:String(v[i][h.REGISTRO]||''),via_emitida:String(v[i][h.VIA_EMITIDA]||'1ª Via Emitida'),emissao_inicio:niceApiIso_(v[i][h.EMISSAO_INICIO]),emissao_fim:niceApiIso_(v[i][h.EMISSAO_FIM]),status:String(v[i][h.STATUS]||''),url_publica:String(v[i][h.URL_PUBLICA]||''),pasta_drive:String(v[i][h.PASTA_DRIVE]||'')};
  }
  return null;
}

function niceCertCustomGetLinkById_(linkId){
  const id=Number(String(linkId||'').replace(/\D/g,''));
  if(!id)return null;
  const sh=niceCertCustomLinksSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return null;
  const h=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(Number(v[i][h.LINK_ID])!==id)continue;
    return{
      id:'C'+String(id).padStart(4,'0'),id_num:id,
      token:String(v[i][h.TOKEN]||''),
      rotulo:String(v[i][h.ROTULO]||''),
      instituicao_emissora:String(v[i][h.INSTITUICAO_EMISSORA]||''),
      livro_ata:String(v[i][h.LIVRO_ATA]||''),
      registro:String(v[i][h.REGISTRO]||''),
      via_emitida:String(v[i][h.VIA_EMITIDA]||'1ª Via Emitida'),
      emissao_inicio:niceApiIso_(v[i][h.EMISSAO_INICIO]),
      emissao_fim:niceApiIso_(v[i][h.EMISSAO_FIM]),
      status:String(v[i][h.STATUS]||''),
      url_publica:String(v[i][h.URL_PUBLICA]||''),
      pasta_drive:String(v[i][h.PASTA_DRIVE]||'')
    };
  }
  return null;
}

function niceCertCustomPublicLink_(token){
  const link=niceCertCustomGetLinkByToken_(token);
  if(!link)return{ok:false,error:'Link de emissão customizada inválido ou inexistente.'};
  return{ok:true,link:{id:link.id,rotulo:link.rotulo,status:link.status,aberto:String(link.status).toUpperCase()===NICE_CERT_CUSTOM.OPEN_STATUS}};
}

function niceCertCustomIssue_(p){
  niceCertCustomEnsureIssueHeaders_();
  const link=niceCertCustomGetLinkByToken_(p.chave||p.token);
  if(!link)return{ok:false,error:'Link de emissão customizada inválido.'};
  const janela=niceCertEmissionWindow_({STATUS:link.status,EMISSAO_INICIO:link.emissao_inicio,EMISSAO_FIM:link.emissao_fim});if(!janela.open)return{ok:false,error:janela.message};

  const nome=niceCertDashboardClean_(p.nome||p.name,180);
  const email=String(p.email||'').trim().toLowerCase();
  const funcao=niceCertDashboardClean_(p.funcao||p.papel,120);
  const carga=niceCertDashboardClean_(p.carga,60);
  const evento=niceCertDashboardClean_(p.evento||p.titulo_evento,220);
  if(nome.length<3)return{ok:false,error:'Informe o nome completo.'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return{ok:false,error:'Informe um e-mail válido.'};
  if(funcao.length<2)return{ok:false,error:'Informe a função no evento.'};
  if(carga.length<1)return{ok:false,error:'Informe a carga horária.'};
  if(evento.length<3)return{ok:false,error:'Informe o nome do evento.'};

  const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(String(v[i][m.CUSTOM_LINK_ID]||'')!==link.id)continue;
    if(String(v[i][m.EMAIL]||'').trim().toLowerCase()!==email)continue;
    if(String(v[i][m.TITULO_EVENTO_CUSTOM]||'')!==evento)continue;
    if(String(v[i][m.FUNCAO_EVENTO]||'')!==funcao)continue;
    const code=String(v[i][m.CODIGO]||'').trim(),status=String(v[i][m.STATUS]||'').toUpperCase();
    if(code&&status==='ENVIADO'){
      const url=String(v[i][m.PDF_URL]||''),fileId=(String(url).match(/[-\w]{20,}/)||[])[0];
      if(fileId){
        const blob=DriveApp.getFileById(fileId).getBlob().setName(code+'.pdf');
        niceCertCustomSendMail_(email,nome,evento,funcao,blob,code);
        niceCertSetByMap_(sh,i+1,m,'ENVIADO_EM',new Date());
        niceCertSetByMap_(sh,i+1,m,'TENTATIVAS_EMAIL',Number(v[i][m.TENTATIVAS_EMAIL]||0)+1);
        return{ok:true,sent:true,reused:true,code,message:'Este certificado já existia e foi reenviado.'};
      }
    }
  }

  const code='CERT-NICE-CUS-'+Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase();
  const emittedAt=new Date();
  const instituicao=String(link.instituicao_emissora||'').trim(),livroAta=String(link.livro_ata||'').trim(),registro=String(link.registro||'').trim(),viaEmitida=String(link.via_emitida||'1ª Via Emitida').trim();
  const canonical=niceCertCustomCanonicalV3_({codigo:code,linkId:link.id,nome,funcao,evento,carga,instituicao,livroAta,registro,viaEmitida,emitido:emittedAt.toISOString()});
  const signature=niceCertSign_(canonical);
  const pdf=niceCertCustomGeneratePdf_(link,{nome,email,funcao,carga,evento,codigo:code,signature,emitido:emittedAt,livro_ata:livroAta,registro,via_emitida:viaEmitida,instituicao_emissora:instituicao});
  niceCertCustomSendMail_(email,nome,evento,funcao,pdf.blob,code);
  niceCertAppendObject_(sh,{EVENTO_ID:'',NOME:nome,EMAIL:email,CARGA_HORARIA:carga,CODIGO:code,ASSINATURA_HMAC:signature,STATUS:'ENVIADO',EMITIDO_EM:emittedAt,ENVIADO_EM:new Date(),PDF_URL:pdf.url,TENTATIVAS_EMAIL:1,ULTIMO_ERRO:'',TIPO_CERTIFICADO:'CUSTOMIZADO',FUNCAO_EVENTO:funcao,TITULO_EVENTO_CUSTOM:evento,CUSTOM_LINK_ID:link.id,LIVRO_ATA:livroAta,REGISTRO_CERTIFICADO:registro,VIA_EMITIDA:viaEmitida,INSTITUICAO_EMISSORA:instituicao});
  niceCertLog_('CERTIFICADO_CUSTOMIZADO_EMITIDO',link.id,code,funcao+' · '+evento+' · '+email);
  return{ok:true,sent:true,reused:false,code,message:'Certificado customizado gerado e enviado.'};
}

function niceCertCustomCanonical_(o){return[o.codigo,'CUSTOM',o.linkId,o.nome,o.funcao,o.evento,o.carga,o.emitido].map(v=>String(v==null?'':v).trim()).join('|')}
function niceCertCustomCanonicalV2_(o){return[o.codigo,'CUSTOM_V2',o.linkId,o.nome,o.funcao,o.evento,o.carga,o.livroAta,o.registro,o.viaEmitida,o.emitido].map(v=>String(v==null?'':v).trim()).join('|')}
function niceCertCustomCanonicalV3_(o){return[o.codigo,'CUSTOM_V3',o.linkId,o.nome,o.funcao,o.evento,o.carga,o.instituicao,o.livroAta,o.registro,o.viaEmitida,o.emitido].map(v=>String(v==null?'':v).trim()).join('|')}

function niceCertCustomGeneratePdf_(link,cert){
  const folder=niceCertFolderFromUrl_(link.pasta_drive);
  const pres=SlidesApp.create('TMP '+cert.codigo);
  const slide=pres.getSlides()[0];
  slide.getPageElements().forEach(x=>x.remove());

  const C=niceCertClassicFrame_(slide);
  niceCertClassicHeader_(slide,'CERTIFICADO');

  niceCertTextSerif_(slide,'Certificamos que',90,128,540,18,11,C.gray,false,'CENTER');
  niceCertTextSerif_(slide,cert.nome,58,153,604,34,21,C.navy,true,'CENTER');
  niceCertClassicDivider_(slide,180,195,540);

  const body='participou do evento “'+cert.evento+'”, na função de “'+cert.funcao+'”, com carga horária de '+cert.carga+'.';
  niceCertTextSerif_(slide,body,82,210,556,40,11,C.text,false,'CENTER');

  // Selo e texto ficam entre Y=247 e Y=311.
  niceCertClassicBookSeal_(slide,128,247,54);
  niceCertTextSerif_(slide,'CERTIFICADO REGISTRADO',202,249,180,12,8,C.gold,true,'START');
  niceCertTextSerif_(slide,'EM LIVRO ATA INSTITUCIONAL',202,268,180,12,8,C.navy,true,'START');

  niceCertClassicRegistryInfo_(slide,{
    line1:'Livro Ata: '+String(cert.livro_ata||'—'),
    line2:'Registro: '+String(cert.registro||'—'),
    line3:String(cert.via_emitida||'1ª Via Emitida')
  });

  // Painel de validação começa somente abaixo do registro.
  niceCertClassicValidation_(
    slide,
    cert.codigo,
    cert.signature,
    cert.emitido,
    String(cert.instituicao_emissora||link.instituicao_emissora||'').trim()
  );

  pres.saveAndClose();
  Utilities.sleep(2000);

  const source=DriveApp.getFileById(pres.getId());
  const blob=source.getBlob().getAs(MimeType.PDF).setName(cert.codigo+'.pdf');
  const file=folder.createFile(blob);

  file.setDescription('Certificado NICE customizado · '+link.id+' · '+cert.codigo);
  source.setTrashed(true);

  return{blob,url:file.getUrl(),id:file.getId()};
}


function niceCertCustomRegistryBlock_(slide,cert){
  return niceCertClassicRegistryInfo_(slide,{
    line1:'Livro Ata: '+String(cert.livro_ata||'—'),
    line2:'Registro: '+String(cert.registro||'—'),
    line3:String(cert.via_emitida||'1ª Via Emitida')
  });
}


function niceCertCustomSendMail_(email,nome,evento,funcao,blob,codigo){
  const validate=NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(codigo),subject='[NICE] Certificado · '+evento;
  const plain='Olá, '+nome+'.\n\nSeu certificado referente ao evento '+evento+' está anexo.\nFunção: '+funcao+'\nCódigo: '+codigo+'\nValidação: '+validate+'\n\nNICE · AlfaUnipac';
  const html='<p>Olá, <strong>'+niceCertHtml_(nome)+'</strong>.</p><p>Seu certificado referente ao evento <strong>'+niceCertHtml_(evento)+'</strong> está anexo.</p><p><strong>Função:</strong> '+niceCertHtml_(funcao)+'<br><strong>Código:</strong> '+niceCertHtml_(codigo)+'<br><strong>Validação:</strong> <a href="'+niceCertHtml_(validate)+'">'+niceCertHtml_(validate)+'</a></p><p>NICE · AlfaUnipac</p>';
  const opts={htmlBody:html,attachments:[blob],name:'NICE - Certificados'},sender=niceCertSenderOptions_();Object.keys(sender).forEach(k=>opts[k]=sender[k]);GmailApp.sendEmail(email,subject,plain,opts);
}

function niceCertCustomVerify_(code){
  const wanted=String(code||'').trim().toUpperCase();if(!/^CERT-NICE-CUS-[A-Z0-9]{10}$/.test(wanted))return{ok:true,valid:false,error:'Formato de código inválido.'};
  niceCertCustomEnsureIssueHeaders_();
  const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues(),m=niceCertHeaderMap_(v[0]);
  for(let i=1;i<v.length;i++){
    if(String(v[i][m.CODIGO]||'').trim().toUpperCase()!==wanted)continue;
    const emitted=niceCertDate_(v[i][m.EMITIDO_EM]),linkId=String(v[i][m.CUSTOM_LINK_ID]||''),nome=String(v[i][m.NOME]||''),funcao=String(v[i][m.FUNCAO_EVENTO]||''),evento=String(v[i][m.TITULO_EVENTO_CUSTOM]||''),carga=String(v[i][m.CARGA_HORARIA]||'');
    const instituicao=String(v[i][m.INSTITUICAO_EMISSORA]||''),livroAta=String(v[i][m.LIVRO_ATA]||''),registro=String(v[i][m.REGISTRO_CERTIFICADO]||''),viaEmitida=String(v[i][m.VIA_EMITIDA]||'');
    const emittedIso=emitted?emitted.toISOString():'';
    const canonical=instituicao?niceCertCustomCanonicalV3_({codigo:wanted,linkId,nome,funcao,evento,carga,instituicao,livroAta,registro,viaEmitida:viaEmitida||'1ª Via Emitida',emitido:emittedIso}):(livroAta||registro)?niceCertCustomCanonicalV2_({codigo:wanted,linkId,nome,funcao,evento,carga,livroAta,registro,viaEmitida:viaEmitida||'1ª Via Emitida',emitido:emittedIso}):niceCertCustomCanonical_({codigo:wanted,linkId,nome,funcao,evento,carga,emitido:emittedIso});
    const expected=niceCertSign_(canonical),stored=String(v[i][m.ASSINATURA_HMAC]||''),status=String(v[i][m.STATUS]||'').toUpperCase();
    return{ok:true,valid:!!stored&&stored===expected,revoked:status==='REVOGADO',status,nome,codigo:wanted,carga_horaria:carga,emitido_em:emittedIso,selo:stored,funcao_evento:funcao,tipo_certificado:'CUSTOMIZADO',instituicao_emissora:instituicao,livro_ata:livroAta,registro_certificado:registro,via_emitida:viaEmitida||'1ª Via Emitida',evento:{id:linkId,titulo:evento,data_evento:'—',campus_unidade:'—',local:'—',protocolo_nice:'—'},motivo_revogacao:String(v[i][m.MOTIVO_REVOGACAO]||'')};
  }
  return{ok:true,valid:false,error:'Certificado não encontrado.'};
}
