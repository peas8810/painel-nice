/* Formulário administrativo independente dos fluxos de certificados. */
(()=>{'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function open(course,target,request){
 if(target.dataset.billingReady){target.hidden=!target.hidden;return}
 target.dataset.billingReady='true';target.hidden=false;
 target.innerHTML=`<section class="billing-panel"><h3>Enviar e-mail de cobrança</h3><p>Evento: <strong>${escape(course.titulo)}</strong><br>Remetente: <strong>nice@unipacto.com.br</strong><br>Respostas: <strong>peas8810@gmail.com</strong></p>
 <form data-billing-form><div class="grid">
 <label>E-mail do destinatário<input name="destinatario" type="email" maxlength="254" required placeholder="cliente@empresa.com" autocomplete="email"></label>
 <label>Nome do destinatário / empresa<input name="nome" maxlength="180" value="${escape(course.cliente)}"></label>
 <label>Valor da cobrança (R$)<input name="valor" inputmode="decimal" maxlength="24" required placeholder="150,00"></label>
 <label>Vencimento (opcional)<input name="vencimento" type="date"></label>
 <label>Forma de pagamento<select name="forma_pagamento"><option>Pix</option><option>Transferência bancária</option><option>Link de pagamento</option><option>Boleto</option><option>Outro</option></select></label>
 <label>Link de pagamento (HTTPS, se houver)<input name="link_pagamento" type="url" maxlength="1500" placeholder="https://"></label>
 </div><label>Descrição da cobrança<textarea name="descricao" maxlength="700" required>Emissão de certificados — ${escape(course.titulo)}</textarea></label>
 <label>Dados e instruções para pagamento<textarea name="dados_pagamento" maxlength="2500" required placeholder="Informe a chave Pix e o favorecido, os dados bancários ou as instruções para pagamento."></textarea></label>
 <label>Mensagem complementar (opcional)<textarea name="mensagem" maxlength="1500"></textarea></label>
 <button type="submit" data-review>Revisar e-mail de cobrança</button></form>
 <p data-billing-status role="status" aria-live="polite"></p>
 <div data-billing-preview hidden><h4>Prévia da cobrança</h4><p data-billing-address></p><pre class="billing-message" data-billing-body></pre><button type="button" data-send>Enviar e-mail de cobrança</button></div>
 <h4>Últimas cobranças deste evento</h4><button type="button" data-billing-reload>Atualizar histórico de cobranças</button><div class="scroll" data-billing-history></div></section>`;
 const find=s=>target.querySelector(s),form=find('[data-billing-form]'),status=find('[data-billing-status]'),preview=find('[data-billing-preview]'),send=find('[data-send]'),history=find('[data-billing-history]'),reload=find('[data-billing-reload]');
 let selected=null,prepared=null,busy=false;
 const report=value=>status.textContent=value?.message||String(value);
 const invoke=(op,data={})=>request(op,{curso_id:course.id,...data});
 function setBusy(value){busy=value;form.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=value);reload.disabled=value;send.disabled=value||selected?.status!=='RASCUNHO';}
 function show(bill){selected=bill;preview.hidden=false;find('[data-billing-address]').textContent='Cobrança: '+bill.id+'\nDe: '+bill.remetente+'\nResponder para: '+(bill.responder_para||'peas8810@gmail.com')+'\nPara: '+bill.destinatario+'\nAssunto: '+bill.assunto+'\nSituação: '+bill.status+(bill.enviado_em?'\nEnviado em: '+new Date(bill.enviado_em).toLocaleString():'');find('[data-billing-body]').textContent=bill.texto;send.hidden=bill.status!=='RASCUNHO';send.disabled=busy||bill.status!=='RASCUNHO';}
 async function loadHistory(){const out=await invoke('courses_billing_history');history.innerHTML=out.cobrancas.length?'<table><thead><tr><th>Data</th><th>Destinatário / valor</th><th>Envio</th><th></th></tr></thead><tbody>'+out.cobrancas.map(b=>'<tr><td>'+escape(new Date(b.criado_em).toLocaleString())+'</td><td>'+escape(b.destinatario)+'<br>'+escape(b.valor)+'</td><td>'+escape(b.status)+(b.enviado_em?'<br>'+escape(new Date(b.enviado_em).toLocaleString()):'')+(b.erro?'<br>'+escape(b.erro):'')+'</td><td><button type="button" data-bill-id="'+escape(b.id)+'">Ver cobrança</button></td></tr>').join('')+'</tbody></table>':'<p>Nenhuma cobrança registrada neste evento.</p>';history.querySelectorAll('[data-bill-id]').forEach(button=>button.onclick=async()=>{if(busy)return;setBusy(true);try{show((await invoke('courses_billing_get',{cobranca_id:button.dataset.billId})).cobranca);report('Cobrança carregada. Confira o destinatário e a mensagem abaixo.')}catch(e){report(e)}finally{setBusy(false)}});}
 form.oninput=()=>{selected=null;prepared=null;preview.hidden=true;send.disabled=true;};
 form.onsubmit=async event=>{event.preventDefault();if(busy||!form.reportValidity())return;const data=Object.fromEntries(new FormData(form)),fingerprint=JSON.stringify(data);if(!prepared||prepared.fingerprint!==fingerprint)prepared={fingerprint,id:crypto.randomUUID()};setBusy(true);report('Preparando a prévia da cobrança…');try{const out=await invoke('courses_billing_prepare',{dados:fingerprint,solicitacao_id:prepared.id});show(out.cobranca);report('Confira o e-mail do destinatário, o valor e os dados de pagamento antes de enviar.');try{await loadHistory()}catch(e){report('Prévia preparada. O histórico não carregou: '+e.message)}}catch(e){report(e)}finally{setBusy(false)}};
 send.onclick=async()=>{if(busy||!selected||selected.status!=='RASCUNHO')return;const bill=selected;if(!confirm('Enviar cobrança de '+bill.valor+' para '+bill.destinatario+', pelo e-mail '+bill.remetente+'?'))return;setBusy(true);report('Enviando e-mail de cobrança…');try{const out=await invoke('courses_billing_send',{cobranca_id:bill.id});show(out.cobranca);report(out.message);try{await loadHistory()}catch(e){report(out.message+' O histórico não carregou: '+e.message)}}catch(e){report(e);selected=null;send.hidden=true;try{await loadHistory()}catch(_){} }finally{setBusy(false)}};
 reload.onclick=async()=>{if(busy)return;setBusy(true);try{await loadHistory();report('Histórico de cobranças atualizado.')}catch(e){report(e)}finally{setBusy(false)}};
 setBusy(true);report('Carregando histórico de cobranças…');loadHistory().then(()=>report('Preencha a cobrança e clique em Revisar e-mail de cobrança.')).catch(report).finally(()=>setBusy(false));
}
window.courseBilling={open};
})();
