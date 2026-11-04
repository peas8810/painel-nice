(()=>{
  const API='https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec';
  const code=document.getElementById('code');
  const btn=document.getElementById('verify');
  const result=document.getElementById('result');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  let seq=0;

  function jsonp(params,timeout=30000){
    return new Promise((resolve,reject)=>{
      const cb='__nice_verify_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
      const s=document.createElement('script');
      const u=new URL(API);
      Object.entries({...params,callback:cb,_:Date.now()}).forEach(([k,v])=>u.searchParams.set(k,v));
      let done=false;
      const finish=(err,payload)=>{
        if(done)return;
        done=true;
        clearTimeout(timer);
        try{delete window[cb]}catch(_){}
        s.remove();
        err?reject(err):resolve(payload);
      };
      window[cb]=payload=>finish(null,payload);
      s.onerror=()=>finish(new Error('Não foi possível consultar o certificado.'));
      const timer=setTimeout(()=>finish(new Error('Tempo esgotado ao consultar o certificado.')),timeout);
      s.src=u.toString();
      document.head.appendChild(s);
    });
  }

  function render(p){
    if(!p||!p.ok||!p.valid){
      result.innerHTML=`<div class="card invalid"><h2>Certificado não validado</h2><p class="desc">${esc((p&&p.error)||'Código não encontrado ou documento inválido.')}</p></div>`;
      return;
    }
    const revoked=p.revoked===true;
    result.innerHTML=`<div class="card ${revoked?'invalid':'valid'}"><div class="event-head"><div><div class="event-id">${revoked?'CERTIFICADO REVOGADO':'CERTIFICADO VÁLIDO'}</div><h2>${esc(p.nome)}</h2><p class="desc">${esc(p.evento&&p.evento.titulo||'Evento institucional')}</p></div><span class="status">${esc(p.status||'ATIVO')}</span></div>
      <div class="meta-grid"><div class="meta"><span>Código</span><strong class="verification-code">${esc(p.codigo)}</strong></div><div class="meta"><span>Evento / emissão</span><strong>${esc(p.evento&&p.evento.id||'—')}</strong></div><div class="meta"><span>Data do evento</span><strong>${esc(p.evento&&p.evento.data_evento||'—')}</strong></div><div class="meta"><span>Carga horária</span><strong>${esc(p.carga_horaria||'—')}</strong></div><div class="meta"><span>Emitido em</span><strong>${fmt(p.emitido_em)}</strong></div><div class="meta"><span>Instituição emissora</span><strong>${esc(p.instituicao_emissora||'—')}</strong></div><div class="meta"><span>${p.tipo_certificado==='CUSTOMIZADO'?'Função no evento':'Protocolo NICE'}</span><strong>${esc(p.tipo_certificado==='CUSTOMIZADO'?(p.funcao_evento||'—'):(p.evento&&p.evento.protocolo_nice||'—'))}</strong></div><div class="meta"><span>Livro Digital de Certificações</span><strong>${esc(p.livro_digital||p.livro_ata||'—')}</strong></div><div class="meta"><span>Registro</span><strong>${esc(p.registro_digital||p.registro_certificado||'—')}</strong></div><div class="meta"><span>Via</span><strong>${esc(p.via_emitida||'1ª Via Emitida')}</strong></div>${p.hash_pdf?'<div class="meta"><span>Hash SHA-256 do PDF</span><strong class="verification-code">'+esc(p.hash_pdf)+'</strong></div>':''}</div>
      <p class="seal"><strong>Selo digital:</strong> ${esc(p.selo||'—')}</p>${revoked?`<p class="desc"><strong>Motivo da revogação:</strong> ${esc(p.motivo_revogacao||'Não informado')}</p>`:''}</div>`;
  }

  async function queryCertificate(c){
    const url=new URL(API);
    url.searchParams.set('action','cert_verify');
    url.searchParams.set('code',c);
    url.searchParams.set('_',Date.now());
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'omit'});
      if(response.ok){
        const payload=await response.json();
        if(payload?.ok===true&&typeof payload.valid==='boolean')return payload;
      }
    }catch(_){}finally{clearTimeout(timer);}
    const payload=await jsonp({action:'cert_verify',code:c},25000);
    if(payload?.ok!==true||typeof payload.valid!=='boolean')throw new Error('Resposta indisponível.');
    return payload;
  }

  async function verify(){
    const c=code.value.trim().toUpperCase();
    if(!c){code.focus();return;}
    result.innerHTML='<div class="card loading">Consultando assinatura digital…</div>';
    btn.disabled=true;
    try{
      render(await queryCertificate(c));
    }catch(err){
      result.innerHTML='<div class="card"><h2>Consulta indisponível</h2><p class="desc">Não foi possível obter uma resposta do serviço de validação. Tente novamente em instantes.</p></div>';
    }finally{
      btn.disabled=false;
    }
  }

  btn.addEventListener('click',verify);
  code.addEventListener('keydown',e=>{if(e.key==='Enter')verify()});
  const initial=new URLSearchParams(location.search).get('codigo');
  if(initial){code.value=initial;verify();}
})();