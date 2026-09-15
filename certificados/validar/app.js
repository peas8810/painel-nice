(()=>{
  const API='https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec';
  const code=document.getElementById('code');
  const btn=document.getElementById('verify');
  const result=document.getElementById('result');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{if(!v)return'—';const d=new Date(v);return isNaN(d)?esc(v):d.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})};
  let seq=0;

  function bridge(params){
    return new Promise((resolve,reject)=>{
      const requestId='cert_'+Date.now()+'_'+(++seq)+'_'+Math.random().toString(36).slice(2,8);
      const u=new URL(API);Object.entries({...params,transport:'bridge',request_id:requestId,_:Date.now()}).forEach(([k,v])=>u.searchParams.set(k,v));
      const frame=document.createElement('iframe');frame.hidden=true;frame.src=u.toString();
      const timer=setTimeout(()=>finish(new Error('Tempo esgotado ao consultar o validador.')),25000);
      const onMessage=e=>{const d=e.data;if(!d||d.source!=='NICE_API_BRIDGE'||d.request_id!==requestId)return;finish(null,d.payload)};
      function finish(err,payload){clearTimeout(timer);window.removeEventListener('message',onMessage);frame.remove();err?reject(err):resolve(payload)}
      window.addEventListener('message',onMessage);document.body.appendChild(frame);
    });
  }

  function render(p){
    if(!p||!p.ok||!p.valid){
      result.innerHTML=`<div class="card invalid"><h2>Certificado não validado</h2><p class="desc">${esc((p&&p.error)||'Código não encontrado ou documento inválido.')}</p></div>`;return;
    }
    const revoked=p.revoked===true;
    result.innerHTML=`<div class="card ${revoked?'invalid':'valid'}"><div class="event-head"><div><div class="event-id">${revoked?'CERTIFICADO REVOGADO':'CERTIFICADO VÁLIDO'}</div><h2>${esc(p.nome)}</h2><p class="desc">${esc(p.evento&&p.evento.titulo||'Evento institucional')}</p></div><span class="status">${esc(p.status||'ATIVO')}</span></div>
      <div class="meta-grid"><div class="meta"><span>Código</span><strong class="verification-code">${esc(p.codigo)}</strong></div><div class="meta"><span>Evento</span><strong>${esc(p.evento&&p.evento.id||'—')}</strong></div><div class="meta"><span>Data do evento</span><strong>${esc(p.evento&&p.evento.data_evento||'—')}</strong></div><div class="meta"><span>Carga horária</span><strong>${esc(p.carga_horaria||'—')}</strong></div><div class="meta"><span>Emitido em</span><strong>${fmt(p.emitido_em)}</strong></div><div class="meta"><span>Protocolo NICE</span><strong>${esc(p.evento&&p.evento.protocolo_nice||'—')}</strong></div></div>
      <p class="seal"><strong>Selo digital:</strong> ${esc(p.selo||'—')}</p>${revoked?`<p class="desc"><strong>Motivo da revogação:</strong> ${esc(p.motivo_revogacao||'Não informado')}</p>`:''}</div>`;
  }

  async function verify(){
    const c=code.value.trim().toUpperCase();if(!c){code.focus();return}
    result.innerHTML='<div class="card loading">Consultando assinatura digital…</div>';
    btn.disabled=true;
    try{render(await bridge({action:'cert_verify',code:c}))}catch(err){render({ok:false,error:err.message})}finally{btn.disabled=false}
  }
  btn.addEventListener('click',verify);code.addEventListener('keydown',e=>{if(e.key==='Enter')verify()});
  const initial=new URLSearchParams(location.search).get('codigo');if(initial){code.value=initial;verify()}
})();