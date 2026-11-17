/* Portal Academy: entrada por autenticação antes da área de solicitações.
 * Controles visuais não substituem as políticas RLS do Supabase. */
(async()=>{
const $=id=>document.getElementById(id), cfg=window.ACADEMY_AUTH_CONFIG||{};
const message=(id,s)=>{$(id).textContent=s};
const display=(id,on)=>{$(id).hidden=!on};
function authTab(tab){display('login-panel',tab==='login');display('register-panel',tab==='register');$('show-login').classList.toggle('active',tab==='login');$('show-register').classList.toggle('active',tab==='register')}
$('show-login').onclick=()=>authTab('login');$('show-register').onclick=()=>authTab('register');
if(!cfg.url||!cfg.publishableKey||!window.supabase?.createClient){display('loading-view',false);display('visitor-view',true);message('login-status','Serviço de login indisponível. Tente novamente mais tarde.');return}
const db=window.supabase.createClient(cfg.url,cfg.publishableKey);window.academyDb=db;
let currentUser=null, currentRevision=0, editingRequestId=null;
const academyIssuanceAttempted=new Set();
$('google-login').addEventListener('click',async()=>{
 const button=$('google-login');
 button.disabled=true;
 message('google-login-status','Redirecionando para o Google…');
 const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/academy/portal/'}});
 if(error){message('google-login-status','Não foi possível entrar com Google: '+error.message);button.disabled=false}
});
async function loadActivityTypes(){
 const input=$('activity-type');
 const fallback=['Grupo de estudos','Projeto colaborativo','Ação comunitária','Oficina independente','Capacitação interna','Outra'];
 const {data,error}=await db.from('academy_activity_types').select('name').eq('active',true).order('name');
 const types=!error&&data?.length?data.map(x=>x.name):fallback;
 const selection=input.value;input.replaceChildren();
 for(const name of types){const opt=document.createElement('option');opt.value=name;opt.textContent=name;input.appendChild(opt)}
 if(types.includes(selection))input.value=selection;
}

async function listRequests(){
 const revision=++currentRevision;
 if(!currentUser)return;
 const tracking=$('tracking');tracking.replaceChildren(document.createTextNode('Buscando seus pedidos…'));
 const {data,error}=await db.from('academy_requests').select('id,activity,activity_type,start_date,end_date,description,status,hours_declared,hours_verified,participants_count,teaching_activity,created_at').eq('user_id',currentUser.id).neq('status','CANCELADA').order('created_at',{ascending:false}).limit(50);
 if(revision!==currentRevision||!currentUser)return;
 tracking.replaceChildren();
 if(error){tracking.textContent='Não conseguimos abrir seus pedidos. Tente novamente. Detalhe: '+error.message;return}
 const {data:payments}=await db.from('academy_payment_releases').select('request_id,payment_status,checkout_url,amount_cents').in('request_id',(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']);
 const {data:certs}=await db.from('academy_certificates').select('request_id,status,certificate_code,pdf_path,issued_at').in('request_id',(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']);
 const payById=new Map((payments||[]).map(x=>[x.request_id,x])),certById=new Map((certs||[]).map(x=>[x.request_id,x]));
 const nextCard=$('academy-next-step');
 if(nextCard){
   const latest=(data||[]).find(x=>['PENDENTE_DOCUMENTOS','INCONCLUSIVO','APROVADO','EM_ANALISE','ENVIADA'].includes(x.status))||(data||[])[0];
   nextCard.hidden=!latest;
   if(latest){
     const payment=payById.get(latest.id),cert=certById.get(latest.id);
     let title='Acompanhe seu pedido',description='Confira o andamento da análise.',link='Ver pedido →';
     if(latest.status==='PENDENTE_DOCUMENTOS'||latest.status==='INCONCLUSIVO'){title='Você precisa enviar documentos';description=latest.activity+' — confira o que falta para continuar.';link='Ver documentos →'}
     else if(cert?.status==='EMITIDO'&&cert.pdf_path){title='Certificado disponível para baixar';description=latest.activity+' — abra ou baixe seu PDF certificado.';link='Ver certificado →'}
     else if(payment?.payment_status==='PAGO_CONFIRMADO'){title='Pagamento confirmado — preparando certificado';description=latest.activity+' — o PDF será gerado automaticamente. Você não precisa pagar novamente.';link='Acompanhar emissão →'}
     else if(payment?.payment_status==='AGUARDANDO_PAGAMENTO'){title='Pagamento disponível';description=latest.activity+' — abra seu pedido e escolha o pagamento.';link='Ver pagamento →'}
     else if(latest.status==='APROVADO'){title='Pedido aprovado';description=latest.activity+' — acompanhe a próxima etapa.'}
     else if(latest.status==='EM_ANALISE'){title='Sua solicitação está em análise';description=latest.activity+' — avisaremos quando houver novidades.'}
     $('academy-next-step-title').textContent=title;
     $('academy-next-step-description').textContent=description;
     $('academy-next-step-link').textContent=link;
     $('academy-next-step-link').href=cert?.status==='EMITIDO'?'#certificate-wallet':'#my-requests';
   }
 }
 const select=$('evidence-request');select.replaceChildren();(data||[]).filter(x=>!['REPROVADO','APROVADO'].includes(x.status)).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.activity+' · '+x.id.slice(0,8);select.append(o)});
 await listEvidence();
 if(!data?.length){tracking.textContent='Você ainda não fez um pedido. Clique em “Pedir certificado” para começar.';window.dispatchEvent(new Event('academy-requests-loaded'));return}
 const descriptions={ENVIADA:'Recebemos seu pedido',EM_ANALISE:'Estamos conferindo seus documentos',PENDENTE_DOCUMENTOS:'Você precisa enviar documentos',APROVADO:'Seu pedido foi aprovado',REPROVADO:'Seu pedido não foi aprovado',INCONCLUSIVO:'Precisamos de mais informações'};
 for(const item of data){const card=document.createElement('article');card.className='request-item';const heading=document.createElement('strong');heading.textContent=item.activity;const state=document.createElement('span');state.className='request-status';state.textContent=descriptions[item.status]||item.status;const detail=document.createElement('small');detail.textContent=String(item.hours_declared)+' horas informadas'+(item.hours_verified!==null&&item.hours_verified!==undefined?' · '+String(item.hours_verified)+' horas verificadas':'')+' · Pedido '+item.id.slice(0,8);const pay=payById.get(item.id),cert=certById.get(item.id);state.textContent=cert?.status==='EMITIDO'&&!!cert.pdf_path?'Certificado disponível':pay?.payment_status==='PAGO_CONFIRMADO'?'Pagamento confirmado':descriptions[item.status]||item.status;card.append(heading,state,detail);if(pay){const p=document.createElement('small');p.textContent='Pagamento do certificado: '+(Number.isInteger(pay.amount_cents)?(pay.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+' · ':'')+({PAGO_CONFIRMADO:'confirmado',AGUARDANDO_PAGAMENTO:'aguardando pagamento',ESTORNADO:'devolvido',REJEITADO:'não aprovado'}[pay.payment_status]||'aguardando liberação');card.append(p);
 const timeline=document.createElement('div');timeline.className='academy-payment-timeline';
 const phases=[{label:'Pedido aprovado',done:item.status==='APROVADO'},{label:'Pagamento confirmado',done:pay.payment_status==='PAGO_CONFIRMADO'},{label:'Emissão do PDF',done:cert?.status==='EMITIDO'&&!!cert.pdf_path,active:pay.payment_status==='PAGO_CONFIRMADO'&&cert?.status==='PENDENTE_EMISSAO'},{label:'Pronto para baixar',done:cert?.status==='EMITIDO'&&!!cert.pdf_path}];
 for(const phase of phases){const step=document.createElement('div');step.className='academy-payment-step'+(phase.done?' completed':phase.active?' active':'');const indicator=document.createElement('span');indicator.textContent=phase.done?'✓':'○';indicator.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=phase.label;step.append(indicator,text);timeline.append(step)}
 card.append(timeline);
 if(pay.payment_status==='PAGO_CONFIRMADO'&&cert?.status==='PENDENTE_EMISSAO'){const notice=document.createElement('div');notice.className='academy-cert-pending';const h=document.createElement('strong');h.textContent='Pagamento confirmado. Certificado aguardando emissão.';const sub=document.createElement('p');sub.textContent='Tudo certo com o pagamento. Estamos gerando seu certificado de '+String(item.hours_verified||item.hours_declared)+' horas verificadas. Você não precisa pagar novamente.';const button=document.createElement('button');button.type='button';button.className='primary';button.textContent='Gerar e visualizar meu certificado';button.onclick=async()=>{
   button.disabled=true;button.textContent='Gerando certificado…';
   const viewer=window.open('','_blank');
   if(viewer){viewer.document.title='Certificado Academy';viewer.document.body.textContent='Preparando certificado…'}
   try{const {data,error}=await db.functions.invoke('academy-issue-certificate',{body:{request_id:item.id}});
    if(error||data?.error||!data?.issued){if(viewer)viewer.close();let detail=data?.error||error?.message||'Não foi possível emitir';if(error?.context){try{const e=await error.context.json();detail=e.error||detail}catch{}}sub.textContent='Emissão ainda indisponível: '+detail+'. A equipe poderá concluir pelo painel administrativo.';return}
    const {data:ready}=await db.from('academy_certificates').select('pdf_path,status').eq('request_id',item.id).maybeSingle();
    if(ready?.status==='EMITIDO'&&ready.pdf_path){
      const {data:link,error:linkError}=await db.storage.from('academy-certificados').createSignedUrl(ready.pdf_path,120);
      if(!linkError&&link?.signedUrl){if(viewer)viewer.location.href=link.signedUrl;sub.textContent=viewer?'Certificado aberto. Você também poderá baixá-lo nesta página.':'Certificado emitido. Use o botão Visualizar e baixar certificado PDF abaixo.'}
      else{if(viewer)viewer.close();sub.textContent='Certificado emitido, mas a visualização ainda não carregou. Atualize a página.'}
    }else{if(viewer)viewer.close();sub.textContent='Emissão solicitada. Atualize a situação para verificar o arquivo.'}
    await listRequests();
   }catch(e){if(viewer)viewer.close();sub.textContent='Não conseguimos concluir a emissão agora. Consulte a equipe.'}
   finally{button.disabled=false;button.textContent='Gerar e visualizar meu certificado'}
  };
  const refresh=document.createElement('button');refresh.type='button';refresh.className='plain-action';refresh.textContent='Atualizar situação';refresh.onclick=()=>listRequests();
  notice.append(h,sub,button,refresh);card.append(notice);
  // Attempt once in this browser session, after showing the authenticated student's paid state.
  // Backend enforces verified payment, authorized owner, claim and idempotency.
  const key=item.id;
  if(!academyIssuanceAttempted.has(key)){
   academyIssuanceAttempted.add(key);
   sub.textContent='Pagamento confirmado. Gerando automaticamente o PDF do certificado…';
   setTimeout(async()=>{
     try{
       const {data:issued,error}=await db.functions.invoke('academy-issue-certificate',{body:{request_id:key}});
       if(error||issued?.error||!issued?.issued){
         let reason=issued?.error||error?.message||'Serviço de emissão indisponível';
         if(error?.context){try{const e=await error.context.json();reason=e.error||e.detail||reason}catch{}}
         sub.textContent='Seu pagamento está confirmado. A emissão automática não foi concluída: '+reason+'. Use o botão acima para tentar novamente.';
         return;
       }
       sub.textContent='Certificado gerado! Atualizando os botões para visualizar e baixar…';
       await listRequests();
     }catch{ sub.textContent='Seu pagamento está confirmado. Não foi possível gerar o PDF agora. Use o botão acima para tentar novamente.'}
   },300);
  }
 }
 if(pay.checkout_url&&pay.payment_status==='AGUARDANDO_PAGAMENTO'){const link=document.createElement('a');link.href=pay.checkout_url;link.rel='noopener noreferrer';link.target='_blank';link.textContent='Gerar link para pagar · Mercado Pago (teste)';link.className='academy-pay-main';card.append(link)}else if(item.status==='APROVADO'&&pay.payment_status==='AGUARDANDO_CHECKOUT'){p.textContent='Pagamento aprovado pela equipe. Cobrança ainda não criada.';const start=document.createElement('button');start.type='button';start.className='primary academy-pay-main';start.textContent='Gerar link para pagar · Mercado Pago (teste)';start.onclick=async()=>{start.disabled=true;const label=start.textContent;start.textContent='Preparando pagamento…';try{const {data:result,error}=await db.functions.invoke('academy-checkout',{body:{request_id:item.id}});if(error||result?.error||!result?.checkout_url){let detail=result?.error||'';if(error?.context){try{const payload=await error.context.json();detail=payload?.error||detail;if(payload?.provider_status)detail+=' (Mercado Pago HTTP '+String(payload.provider_status)+', '+String(payload.reason_code||'SEM_CODIGO')+(payload.provider_error_code?', '+String(payload.provider_error_code):'')+')'}catch{}}const msg=detail||error?.message||'Cobrança temporariamente indisponível';p.textContent='Não foi possível gerar o pagamento: '+msg;return}const u=new URL(result.checkout_url);if(u.protocol!=='https:'||!(u.hostname==='mercadopago.com.br'||u.hostname.endsWith('.mercadopago.com.br')||u.hostname==='mercadopago.com'||u.hostname.endsWith('.mercadopago.com'))){p.textContent='Link de pagamento não reconhecido. Contate o suporte.';return}await listRequests();}catch(e){p.textContent='Falha ao preparar o pagamento. Tente novamente ou fale com a equipe.'}finally{start.disabled=false;start.textContent=label}};card.append(start)}}if(item.status==='APROVADO'&&pay&&['AGUARDANDO_CHECKOUT','AGUARDANDO_PAGAMENTO'].includes(pay.payment_status)&&!cert){attachManualPix(card,item,pay)}if(cert){const c=document.createElement('small');c.textContent='Certificado: '+({EMITIDO:'disponível para visualizar e baixar',PENDENTE_EMISSAO:'em emissão',REVOGADO:'revogado, sem validade'}[cert.status]||'em preparação')+(cert.status==='EMITIDO'?' · Código '+cert.certificate_code+(cert.issued_at?' · Emitido em '+new Date(cert.issued_at).toLocaleDateString('pt-BR'):''):'');card.append(c);if(cert.status==='EMITIDO'&&cert.pdf_path){const button=document.createElement('button');button.type='button';button.className='plain-action';button.textContent='Visualizar e baixar certificado PDF';button.className='academy-certificate-main';button.onclick=async()=>{
   button.disabled=true;button.textContent='Preparando visualização segura…';
   try{
    const {data:url,error}=await db.storage.from('academy-certificados').createSignedUrl(cert.pdf_path,300);
    if(error||!url?.signedUrl){message('evidence-status','Não foi possível abrir o PDF: '+(error?.message||'Arquivo indisponível'));return}
    let preview=card.querySelector('.academy-certificate-preview');
    if(!preview){preview=document.createElement('section');preview.className='academy-certificate-preview';card.insertBefore(preview,button.nextSibling)}
    preview.replaceChildren();
    const headline=document.createElement('strong');headline.textContent='Prévia do seu certificado';preview.append(headline);
    const links=document.createElement('div');links.className='academy-certificate-preview-links';
    const a=document.createElement('a');a.href=url.signedUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir PDF em nova aba / salvar';links.append(a);
    const verify=document.createElement('a');verify.href='../validar/?codigo='+encodeURIComponent(cert.certificate_code);verify.target='_blank';verify.rel='noopener noreferrer';verify.textContent='Verificar autenticidade';links.append(verify);
    preview.append(links);
    const frame=document.createElement('iframe');frame.title='Prévia do certificado '+cert.certificate_code;frame.src=url.signedUrl;frame.loading='lazy';preview.append(frame);
    preview.scrollIntoView({behavior:'smooth',block:'nearest'});
   }catch{message('evidence-status','Não foi possível carregar a visualização. Tente novamente.')}
   finally{button.disabled=false;button.textContent='Visualizar e baixar certificado PDF'}
  };card.append(button);const link=document.createElement('a');link.href='../validar/?codigo='+encodeURIComponent(cert.certificate_code);link.textContent='Validar autenticidade';link.target='_blank';link.rel='noopener noreferrer';card.append(link)}}const actions=document.createElement('div');actions.className='actions';if(['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(item.status)&&!pay&&!cert){const edit=document.createElement('button');edit.type='button';edit.className='plain-action';edit.textContent='Corrigir dados';edit.onclick=()=>editRequest(item);const del=document.createElement('button');del.type='button';del.className='plain-action';del.textContent='Cancelar pedido';del.onclick=()=>deleteRequest(item);actions.append(edit,del)}const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='plain-action';duplicate.textContent='Usar como modelo de outro pedido';duplicate.onclick=()=>{resetEdit();$('activity').value=item.activity;$('start').value=item.start_date;$('end').value=item.end_date;$('hours').value=String(item.hours_declared);$('description').value=item.description;const type=$('activity-type');if(![...type.options].some(o=>o.value===item.activity_type)){const op=document.createElement('option');op.value=item.activity_type;op.textContent=item.activity_type;type.append(op)}type.value=item.activity_type;window.academyOpenSection?.('new-request');window.academyWizardSetStep?.(1);$('request').scrollIntoView({behavior:'smooth'});message('request-status','Preenchemos os campos com o pedido anterior. Confira os dados e envie os documentos da nova atividade.')};actions.append(duplicate);const chat=document.createElement('button');chat.type='button';chat.className='plain-action';chat.textContent='Falar com a equipe';chat.onclick=()=>window.academyOpenConversation?.(item.id,item.activity);actions.append(chat);
if(['APROVADO','REPROVADO'].includes(item.status)){
 const feedback=document.createElement('button');feedback.type='button';feedback.className='plain-action';feedback.textContent='Avaliar experiência';
 feedback.onclick=async()=>{const reply=prompt('Como foi sua experiência no Academy? Dê uma nota de 1 a 5.');if(reply===null)return;const score=Number(reply);if(!Number.isInteger(score)||score<1||score>5){message('evidence-status','Informe uma nota entre 1 e 5.');return}
 const comment=prompt('Deseja deixar uma sugestão? (opcional, até 1500 caracteres)')||'';
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {error}=await db.from('academy_feedback').insert({request_id:item.id,user_id:user.id,score,comment:comment.slice(0,1500)});
 message('evidence-status',error?'Não conseguimos enviar seu pedido: '+error.message:'Obrigado! Sua avaliação foi registrada.');
 };actions.append(feedback)
}
const more=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Outras opções deste pedido';more.append(summary,actions);if(['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(item.status)){const send=document.createElement('button');send.type='button';send.className='primary';send.textContent='Enviar fotos e documentos';send.onclick=()=>{$('evidence-request').value=item.id;window.academyOpenSection?.('upload-section');};card.append(send);}card.append(more);tracking.appendChild(card)}window.dispatchEvent(new Event('academy-requests-loaded'))
}
function attachManualPix(card,item,pay){
 const panel=document.createElement('details');panel.className='academy-pix-panel academy-pix-manual';
 const summary=document.createElement('summary');summary.textContent='Ou pagar por Pix direto à Editora UJN';panel.append(summary);
 const body=document.createElement('div');body.className='academy-pix-inner';
 const status=document.createElement('p');status.textContent='Escaneie o QR Code ou copie a chave CNPJ. Confira o beneficiário no aplicativo do seu banco antes de pagar.';body.append(status);
 const info=document.createElement('div');info.className='academy-pix-payment-info';body.append(info);
 const qrBox=document.createElement('div');qrBox.className='academy-pix-qr';qrBox.setAttribute('aria-label','QR Code Pix da editora');body.append(qrBox);
 const actions=document.createElement('div');actions.className='academy-pix-copy-actions';
 const copyKey=document.createElement('button');copyKey.type='button';copyKey.textContent='Copiar chave Pix';actions.append(copyKey);
 const copyCode=document.createElement('button');copyCode.type='button';copyCode.textContent='Copiar Pix Copia e Cola';actions.append(copyCode);
 body.append(actions);
 const copyStatus=document.createElement('small');copyStatus.setAttribute('role','status');body.append(copyStatus);
 const box=document.createElement('div');box.className='academy-pix-receipt';
 const heading=document.createElement('strong');heading.textContent='Já pagou pelo Pix?';box.append(heading);
 const description=document.createElement('p');description.textContent='Envie o comprovante em PDF, JPG ou PNG (até 5 MB). A equipe confirma depois de conferir o crédito no extrato da Editora.';box.append(description);
 const upload=document.createElement('input');upload.type='file';upload.accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';upload.setAttribute('aria-label','Comprovante de pagamento Pix');box.append(upload);
 const submit=document.createElement('button');submit.type='button';submit.className='plain-action';submit.textContent='Enviar comprovante';box.append(submit);
 const feedback=document.createElement('p');feedback.className='academy-pix-upload-status';feedback.setAttribute('role','status');box.append(feedback);
 body.append(box);panel.append(body);card.append(panel);
 let config=null,loading=false;
 async function invoke(body){
  const {data,error}=await db.functions.invoke('academy-manual-pix',{body:{request_id:item.id,...body}});
  if(error||data?.error){let msg=data?.message||data?.error||error?.message||'Não foi possível processar';if(error?.context){try{const payload=await error.context.json();msg=payload.message||payload.error||msg}catch{}}throw Error(msg)}
  return data;
 }
 const copy=async text=>{try{await navigator.clipboard.writeText(text);copyStatus.textContent='Copiado! Abra o aplicativo do banco e confira o beneficiário.'}catch{copyStatus.textContent='Selecione e copie a chave Pix abaixo.'}};
 copyKey.onclick=()=>copy('53275018000162');
 copyCode.onclick=()=>{if(config?.brcode)copy(config.brcode)};
 async function load(){
  if(loading)return;loading=true;status.textContent='Preparando QR Code Pix…';
  try{
   config=await invoke({action:'info'});
   info.replaceChildren();
   const amount=document.createElement('strong');amount.textContent=(config.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});info.append(amount);
   const key=document.createElement('p');key.textContent='Chave Pix CNPJ: '+config.pix_key_display;info.append(key);
   const beneficiary=document.createElement('small');beneficiary.textContent='Identificação informada: '+config.beneficiary_label+' · '+config.city+'. Confira o titular real no banco antes de confirmar.';info.append(beneficiary);
   qrBox.replaceChildren();
   if(config.brcode&&window.QRCode){new window.QRCode(qrBox,{text:config.brcode,width:220,height:220,correctLevel:window.QRCode.CorrectLevel.M})}
   else if(config.brcode){const fallback=document.createElement('textarea');fallback.readOnly=true;fallback.value=config.brcode;fallback.rows=4;fallback.setAttribute('aria-label','Código Pix para copiar');qrBox.append(fallback)}
   else{qrBox.textContent='O pagamento já foi concluído ou não está disponível.'}
   status.textContent='Pix direto, sem intermediário. A confirmação do pagamento é manual após conferência bancária.';
   const pending=(config.receipts||[]).find(x=>x.status==='PENDENTE');
   const confirmed=(config.receipts||[]).find(x=>x.status==='CONFIRMADO');
   if(pending){upload.disabled=true;submit.disabled=true;feedback.textContent='Comprovante recebido em '+new Date(pending.created_at).toLocaleString('pt-BR')+'. Aguardando conferência pela equipe.'}
   if(confirmed){upload.disabled=true;submit.disabled=true;feedback.textContent='Pagamento confirmado pela equipe.'}
  }catch(e){status.textContent='Não foi possível carregar o Pix: '+e.message}
  finally{loading=false}
 }
 panel.addEventListener('toggle',()=>{if(panel.open&&!config)load()});
 submit.onclick=async()=>{
  if(!config?.eligible){feedback.textContent='Pagamento não habilitado para este pedido.';return}
  const file=upload.files?.[0];if(!file){feedback.textContent='Selecione o comprovante antes de enviar.';return}
  const types=['application/pdf','image/jpeg','image/png'];
  if(!types.includes(file.type)||file.size===0||file.size>5*1024*1024){feedback.textContent='Use PDF, JPG ou PNG com até 5 MB.';return}
  submit.disabled=true;feedback.textContent='Enviando comprovante…';
  let path='';
  try{
   const ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
   path=currentUser.id+'/'+item.id+'/'+crypto.randomUUID()+'.'+ext;
   const {error}=await db.storage.from('academy-pix-comprovantes').upload(path,file,{contentType:file.type,upsert:false});
   if(error)throw Error('Não foi possível anexar o arquivo: '+error.message);
   const result=await invoke({action:'submit',file_path:path,file_name:file.name});
   feedback.textContent=result.message||'Comprovante recebido para conferência.';
   upload.disabled=true;config=null;
  }catch(e){feedback.textContent=e.message;submit.disabled=false}
 };
}

function resetEdit(){
 editingRequestId=null;
 $('request').reset();
 $('request-title').textContent='Pedir um certificado';
 $('request-submit').textContent='Enviar meu pedido';
 display('cancel-edit',false);display('edit-notice',false);
}
$('cancel-edit').onclick=()=>{resetEdit();message('request-status','Edição cancelada. Nenhuma alteração foi salva.')};
async function editRequest(item){
 const {data,error}=await db.from('academy_requests').select('id,user_id,activity,activity_type,start_date,end_date,hours_declared,description,participants_count,teaching_activity,status').eq('id',item.id).eq('user_id',currentUser.id).maybeSingle();
 if(error||!data){message('evidence-status','Não conseguimos abrir este pedido para corrigir. Tente novamente.');return}
 if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(data.status)){message('evidence-status','Este pedido já está em uma etapa que exige ajuda da equipe. Abra “Ajuda” para pedir uma correção.');return}
 editingRequestId=data.id;
 $('activity').value=data.activity||'';
 const type=$('activity-type');if(![...type.options].some(o=>o.value===data.activity_type)){const opt=document.createElement('option');opt.value=data.activity_type;opt.textContent=data.activity_type;type.appendChild(opt)}type.value=data.activity_type;
 $('start').value=data.start_date||'';
 $('end').value=data.end_date||'';
 $('hours').value=String(data.hours_declared??'');$('participants').value=data.participants_count??'';$('teaching').value=data.teaching_activity?'true':'';
 $('description').value=data.description||'';
 $('request-title').textContent='Corrigir dados existente';
 $('request-submit').textContent='Salvar alterações';
 display('cancel-edit',true);display('edit-notice',true);
 message('request-status','Corrigindo o pedido '+data.id.slice(0,8)+'. Revise os campos e clique em Salvar alterações.');
 window.academyOpenSection?.('new-request');window.academyWizardSetStep?.(1);$('request').scrollIntoView({behavior:'smooth',block:'start'});
}
async function deleteRequest(item){
 if(!confirm('Cancelar o pedido "'+item.activity+'"? Ele será cancelado e sairá do seu painel. O registro do cancelamento será mantido.'))return;
 const {error}=await db.rpc('academy_student_change_request',{p_id:item.id,p_action:'EXCLUIR'});
 message('evidence-status',error?'Não foi possível cancelar: '+error.message:'Pedido cancelado.');
 if(!error)await listRequests()
}
async function loadNotificationPreferences(){
 if(!currentUser)return;
 const {data,error}=await db.from('academy_notification_preferences').select('email_enabled,whatsapp_phone,whatsapp_opt_in').eq('user_id',currentUser.id).maybeSingle();
 if(error){message('notify-preferences-status','Preferências indisponíveis: '+error.message);return}
 $('notify-email').checked=data?.email_enabled??true;
 $('notify-whatsapp-phone').value=data?.whatsapp_phone||'';
 $('notify-whatsapp-consent').checked=!!data?.whatsapp_opt_in;
}
$('notification-preferences').addEventListener('submit',async e=>{
 e.preventDefault();const {data:{user}}=await db.auth.getUser();if(!user)return;
 const consent=$('notify-whatsapp-consent').checked,phone=$('notify-whatsapp-phone').value.trim();
 if(consent&&!/^\+[1-9][0-9]{7,14}$/.test(phone)){message('notify-preferences-status','Informe o número com DDI, por exemplo +5531999999999.');return}
 const payload={user_id:user.id,email_enabled:$('notify-email').checked,whatsapp_phone:phone||null,whatsapp_opt_in:consent,whatsapp_opt_in_at:consent?new Date().toISOString():null,updated_at:new Date().toISOString()};
 const {error}=await db.from('academy_notification_preferences').upsert(payload,{onConflict:'user_id'});
 message('notify-preferences-status',error?'Não foi possível salvar: '+error.message:'Preferências salvas. O WhatsApp depende de ativação da API oficial.');
});
let refreshTicket=0,lastLoadedUserId=null,authRecoveryRetry=0;
const authTimeout=(promise,ms=11000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('AUTH_TIMEOUT')),ms))]);
function showAuthRecovery(reason){
 display('loading-view',false);
 display('student-view',false);
 display('visitor-view',true);
 authTab('login');
 message('login-status',reason||'Não foi possível recuperar sua sessão. Entre novamente ou tente reconectar.');
 let button=$('academy-auth-retry');
 if(!button){button=document.createElement('button');button.type='button';button.id='academy-auth-retry';button.className='plain-action';button.textContent='Tentar reconectar';$('login-status').insertAdjacentElement('afterend',button);}
 button.hidden=false;button.disabled=false;
 button.onclick=async()=>{button.disabled=true;message('login-status','Verificando conexão…');await refresh();button.disabled=false};
}
async function refresh({explicitSignOut=false}={}){
 const ticket=++refreshTicket;
 if(explicitSignOut){
  currentUser=null;lastLoadedUserId=null;currentRevision++;
  display('loading-view',false);display('visitor-view',true);display('student-view',false);
  resetEdit();$('tracking').replaceChildren();$('student-email').textContent='';
  return;
 }
 let user=null,authError=null;
 try{
  const {data,error}=await authTimeout(db.auth.getUser());
  if(error)authError=error;else user=data?.user||null;
 }catch(e){authError=e}
 if(ticket!==refreshTicket)return;
 if(authError){
  // A remote session validation failure must not strand the application on a spinner.
  // Reuse an already validated user only for rendering; all data remains protected by RLS.
  if(currentUser){
   display('loading-view',false);display('visitor-view',false);display('student-view',true);
   message('request-status','A conexão está instável. Seus dados permanecem protegidos. Tente atualizar seus pedidos.');
   return;
  }
  // If the browser still holds a session, try once to restore it; backend RLS remains authoritative.
  let saved=null;
  try{const {data}=await authTimeout(db.auth.getSession(),4500);saved=data?.session?.user||null}catch{}
  if(ticket!==refreshTicket)return;
  if(saved?.id){
   currentUser=saved;
   display('loading-view',false);display('visitor-view',false);display('student-view',true);
   $('student-email').textContent='Conectado como '+(saved.email||'aluno');
   message('request-status','Verificando conexão com o Academy…');
   await Promise.allSettled([listRequests(),loadActivityTypes(),loadNotificationPreferences()]);
   if(ticket===refreshTicket&&!authRecoveryRetry){authRecoveryRetry=1;setTimeout(()=>refresh(),2200);}
   return;
  }
  showAuthRecovery('Não foi possível confirmar sua conexão com o Academy. Clique em “Tentar reconectar” ou entre novamente.');
  return;
 }
 authRecoveryRetry=0;
 if(!user){
  currentUser=null;lastLoadedUserId=null;currentRevision++;
  display('loading-view',false);display('visitor-view',true);display('student-view',false);
  resetEdit();$('tracking').replaceChildren();$('student-email').textContent='';
  return;
 }
 const userChanged=currentUser?.id!==user.id;
 currentUser=user;
 display('loading-view',false);display('visitor-view',false);display('student-view',true);
 $('student-email').textContent='Conectado como '+user.email;
 const retry=$('academy-auth-retry');if(retry)retry.hidden=true;
 if(!userChanged&&lastLoadedUserId===user.id)return;
 lastLoadedUserId=user.id;
 await Promise.allSettled([listRequests(),loadActivityTypes(),loadNotificationPreferences()]);
}
$('register').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;const full_name=$('name').value.trim(),email=$('email').value.trim(),password=$('password').value;
 if(full_name.length<3||password.length<12){message('registration-status','Informe nome e senha de pelo menos 12 caracteres.');return}
 message('registration-status','Criando conta…');
 const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/academy/portal/',data:{full_name}}});
 $('password').value='';
 message('registration-status',error?'Não foi possível concluir o cadastro: '+error.message:'Confira seu e-mail, confirme a conta e depois entre no portal.');
});
$('academy-login').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 message('login-status','Autenticando…');
 const {error}=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});
 $('login-password').value='';
 message('login-status',error?'Não foi possível entrar: '+error.message:'');
 if(!error)await refresh();
});
$('academy-reset').onclick=async()=>{const email=$('login-email').value.trim();if(!email){message('login-status','Digite seu e-mail para recuperar a senha.');return}
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/academy/portal/'});
 message('login-status',error?'Erro na recuperação: '+error.message:'Se o endereço estiver cadastrado, você receberá um e-mail de recuperação.');
};
$('academy-new-password').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 const {error}=await db.auth.updateUser({password:$('academy-new-pass').value});$('academy-new-pass').value='';
 message('login-status',error?'Erro: '+error.message:'Senha alterada. Entre com seus dados.');if(!error)display('academy-new-password',false);
});
$('academy-logout').onclick=async()=>{await db.auth.signOut();await refresh()};
async function listEvidence(){if(!currentUser)return;const el=$('evidence-list');el.replaceChildren();const {data,error}=await db.from('academy_evidence').select('file_name,review_status,request_id,created_at').order('created_at',{ascending:false}).limit(100);if(error){el.textContent='Não foi possível carregar comprovantes: '+error.message;return}(data||[]).forEach(x=>{const p=document.createElement('p');p.className='notice';p.textContent=x.file_name+' — '+x.review_status+' — '+x.request_id.slice(0,8);el.append(p)})}
async function uploadEvidenceFile(file,requestId){
 const {data:{user}}=await db.auth.getUser();
 if(!user){message('evidence-status','Faça login novamente.');return false}
 if(!file||!requestId){message('evidence-status','Selecione um protocolo e um arquivo.');return false}
 const ownership=await db.from('academy_requests').select('id,status').eq('id',requestId).eq('user_id',user.id).maybeSingle();
 if(ownership.error||!ownership.data){message('evidence-status','Protocolo não encontrado nesta conta.');await listRequests();return false}
 if(!['ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO'].includes(ownership.data.status)){message('evidence-status','Não é possível enviar novos documentos para este pedido. Fale com a equipe em “Ajuda”.');return false}
 if(!$('evidence-category').value){message('evidence-status','Escolha o tipo de documento que você vai enviar.');return false}
 const allowed={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
 if(file.size>10485760||file.size===0||!allowed[file.type]){message('evidence-status','Não conseguimos usar este arquivo. Envie um PDF ou uma foto JPG ou PNG, com até 10 MB.');return false}
 const path=user.id+'/'+requestId+'/'+crypto.randomUUID()+'.'+allowed[file.type];
 const submit=$('evidence-upload').querySelector('button[type=submit]'),drive=$('drive-picker-button');
 if(submit)submit.disabled=true;if(drive)drive.disabled=true;
 try{
  message('evidence-status','Enviando seu arquivo. Aguarde até terminar…');
  const {error:up}=await db.storage.from('academy-evidencias').upload(path,file,{contentType:file.type,upsert:false});
  if(up){message('evidence-status','Falha no upload: '+up.message);return false}
  const {data:evidenceRow,error:insert}=await db.from('academy_evidence').insert({request_id:requestId,file_path:path,file_name:file.name.slice(0,240),category:$('evidence-category').value}).select('id').single();
  if(insert){
   await db.storage.from('academy-evidencias').remove([path]);
   message('evidence-status','Falha ao associar o arquivo ao protocolo: '+insert.message);return false
  }
  if(evidenceRow?.id) await db.functions.invoke('academy-modules',{body:{action:'document_seal',id:evidenceRow.id}}).catch(()=>null);
  $('evidence-file').value='';
  message('evidence-status','Arquivo enviado. Confira se você já enviou os quatro tipos de documento.');
  await listEvidence();
  return true
 }catch(e){message('evidence-status','Erro no envio: '+String(e.message||e));return false}
 finally{if(submit)submit.disabled=false;if(drive)drive.disabled=false}
}
window.academyUploadEvidence=uploadEvidenceFile;
window.academyRefreshRequests=async()=>{await listRequests();await listEvidence();};
$('evidence-upload').addEventListener('submit',async e=>{
 e.preventDefault();if(!e.target.reportValidity())return;
 await uploadEvidenceFile($('evidence-file').files[0],$('evidence-request').value);
});
$('request').addEventListener('submit',async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;
 const {data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user){message('request-status','Sessão encerrada. Entre novamente.');await refresh();return}
 const item={activity:$('activity').value.trim(),activity_type:$('activity-type').value,start_date:$('start').value,end_date:$('end').value,hours_declared:Number($('hours').value),description:$('description').value.trim(),participants_count:Number($('participants').value),teaching_activity:$('teaching').value==='true'};
 if(item.end_date<item.start_date||item.description.length<15){message('request-status','Verifique as datas e a descrição (mínimo de 15 caracteres).');return}
 const isEditing=!!editingRequestId;
 message('request-status',isEditing?'Salvando alterações…':'Enviando seu pedido…');
 const submit=$('request-submit');submit.disabled=true;
 const {error}=isEditing
  ? await db.rpc('academy_student_policy_edit',{p_id:editingRequestId,p_activity:item.activity,p_activity_type:item.activity_type,p_start_date:item.start_date,p_end_date:item.end_date,p_hours:item.hours_declared,p_description:item.description,p_participants:item.participants_count,p_teaching:item.teaching_activity})
  : await db.from('academy_requests').insert(item);
 submit.disabled=false;
 const outcome=error?(isEditing?'Não foi possível salvar: ':'Não conseguimos enviar seu pedido: ')+error.message:(isEditing?'Dados corrigidos. A equipe vai conferir seu pedido novamente.':'Pedido recebido. Agora envie as fotos e os documentos para a equipe conferir.');
 if(!error){resetEdit();await listRequests();window.dispatchEvent(new Event('academy-request-saved'))}message('request-status',outcome);
});
db.auth.onAuthStateChange(event=>{
 if(event==='PASSWORD_RECOVERY'){display('student-view',false);display('visitor-view',true);authTab('login');display('academy-new-password',true);message('login-status','Defina sua nova senha abaixo.');return}
 if(event==='SIGNED_OUT'){setTimeout(()=>refresh({explicitSignOut:true}),0);return}
 if(event==='SIGNED_IN'){setTimeout(()=>refresh(),0)}
 // TOKEN_REFRESHED and INITIAL_SESSION must not reset the visible page or refetch every form.
});
await refresh();
})();