/**
 * Busca de certificados por titular.
 * - Administração: pesquisa parcial por nome, protegida pela chave do dashboard.
 * - Público: primeiro confirma existência pelo nome; detalhes exigem nome + e-mail.
 *   Isso evita exposição pública de certificados de terceiros apenas pelo nome.
 */
function niceCertAdminSearchByName_(query){
  const q=niceApiNorm_(query);
  if(q.length<2)return{ok:false,error:'Informe ao menos 2 caracteres do nome.'};
  const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return{ok:true,total:0,results:[]};
  const m=niceCertHeaderMap_(v[0]),out=[];
  for(let i=v.length-1;i>=1;i--){
    const nome=String(v[i][m.NOME]||'').trim();
    if(!nome||!niceApiNorm_(nome).includes(q))continue;
    const code=String(v[i][m.CODIGO]||'').trim().toUpperCase();
    const tipo=String(v[i][m.TIPO_CERTIFICADO]||'').trim().toUpperCase();
    const eventId=Number(v[i][m.EVENTO_ID]||0);
    let titulo='';
    if(tipo==='CUSTOMIZADO')titulo=String(v[i][m.TITULO_EVENTO_CUSTOM]||'').trim();
    else if(eventId){
      const ev=niceCertFindEvent_(eventId);
      titulo=ev?String(ev.TITULO_EVENTO||'').trim():'';
    }
    out.push({
      nome,
      email:String(v[i][m.EMAIL]||'').trim(),
      codigo:code,
      tipo_certificado:tipo||'PADRAO',
      evento_id:tipo==='CUSTOMIZADO'?(String(v[i][m.CUSTOM_LINK_ID]||'CUSTOM')):String(eventId||'').padStart(4,'0'),
      titulo_evento:titulo,
      status:String(v[i][m.STATUS]||'').trim().toUpperCase(),
      emitido_em:niceApiIso_(v[i][m.EMITIDO_EM]),
      instituicao_emissora:String(v[i][m.INSTITUICAO_EMISSORA]||'').trim(),
      livro_digital:String(v[i][m.LIVRO_DIGITAL]||v[i][m.LIVRO_ATA]||'').trim(),
      registro_digital:String(v[i][m.REGISTRO_DIGITAL]||v[i][m.REGISTRO_CERTIFICADO]||'').trim(),
      validacao:NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(code)
    });
    if(out.length>=250)break;
  }
  return{ok:true,total:out.length,results:out};
}

function niceCertPublicSearchPerson_(name,email){
  const nome=String(name||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim();
  const mail=String(email||'').trim().toLowerCase();
  if(nome.length<5)return{ok:false,error:'Informe seu nome completo.'};

  const wanted=niceApiNorm_(nome);
  const sh=niceCertIssuesSheet_(),v=sh.getDataRange().getValues();
  if(v.length<2)return{ok:true,found:false,total:0,requires_email:false,certificates:[]};
  const m=niceCertHeaderMap_(v[0]),matches=[];
  for(let i=v.length-1;i>=1;i--){
    const rowName=String(v[i][m.NOME]||'').trim();
    if(!rowName||niceApiNorm_(rowName)!==wanted)continue;
    const status=String(v[i][m.STATUS]||'').trim().toUpperCase();
    if(!['ENVIADO','ATIVO','REVOGADO'].includes(status))continue;
    matches.push(i);
  }
  if(!matches.length)return{ok:true,found:false,total:0,requires_email:false,certificates:[]};

  // Nome sozinho confirma somente que há registros. Detalhes exigem confirmação do e-mail.
  if(!mail){
    return{ok:true,found:true,total:matches.length,requires_email:true,
      message:'Encontramos certificado(s) com esse nome. Confirme o e-mail usado na emissão para visualizar os documentos.'};
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))return{ok:false,error:'Informe um e-mail válido.'};

  const out=[];
  for(const i of matches){
    const rowMail=String(v[i][m.EMAIL]||'').trim().toLowerCase();
    if(rowMail!==mail)continue;
    const code=String(v[i][m.CODIGO]||'').trim().toUpperCase();
    const tipo=String(v[i][m.TIPO_CERTIFICADO]||'').trim().toUpperCase();
    const eventId=Number(v[i][m.EVENTO_ID]||0);
    let titulo='';
    if(tipo==='CUSTOMIZADO')titulo=String(v[i][m.TITULO_EVENTO_CUSTOM]||'').trim();
    else if(eventId){
      const ev=niceCertFindEvent_(eventId);
      titulo=ev?String(ev.TITULO_EVENTO||'').trim():'';
    }
    out.push({
      codigo:code,
      titulo_evento:titulo||'Evento institucional',
      status:String(v[i][m.STATUS]||'').trim().toUpperCase(),
      emitido_em:niceApiIso_(v[i][m.EMITIDO_EM]),
      carga_horaria:String(v[i][m.CARGA_HORARIA]||'').trim(),
      instituicao_emissora:String(v[i][m.INSTITUICAO_EMISSORA]||'').trim(),
      livro_digital:String(v[i][m.LIVRO_DIGITAL]||v[i][m.LIVRO_ATA]||'').trim(),
      registro_digital:String(v[i][m.REGISTRO_DIGITAL]||v[i][m.REGISTRO_CERTIFICADO]||'').trim(),
      revogado:status==='REVOGADO',
      validacao:NICE_CERT.PUBLIC_BASE+'/validar/?codigo='+encodeURIComponent(code)
    });
  }
  if(!out.length)return{ok:true,found:true,total:matches.length,verified:false,requires_email:true,error:'O e-mail informado não corresponde aos certificados encontrados.'};
  return{ok:true,found:true,verified:true,total:out.length,nome,certificates:out};
}
