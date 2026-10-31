(() => {
 const $=id=>document.getElementById(id), cfg=window.ACADEMY_AUTH_CONFIG;
 if(!cfg||!window.supabase)return;
 const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 function bind(formId,statusId,operation,render){
  const form=$(formId); if(!form)return;
  form.addEventListener('submit',async event=>{
   event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;
   button.disabled=true;$(statusId).textContent='Processando…';
   try{const {data,error}=await operation();if(error)throw error;render(data);}
   catch(error){$(statusId).textContent='Não foi possível concluir: '+error.message;}
   finally{button.disabled=false;}
  });
 }
 bind('workflow-bind-form','bind-status',()=>db.rpc('academy_workflow_bind',{p_request:$('bind-request').value.trim(),p_tenant:$('bind-tenant').value.trim()}),()=>{$('bind-status').textContent='Instituição vinculada ao protocolo.';});
 bind('workflow-history-form','history-result',()=>db.rpc('academy_workflow_timeline',{p_instance:$('history-instance').value.trim()}),rows=>{
  const list=$('history-result');list.replaceChildren();if(!rows?.length)list.textContent='Nenhuma decisão registrada.';
  for(const row of rows||[]){const p=document.createElement('p');p.textContent=new Date(row.created_at).toLocaleString('pt-BR')+' · Etapa '+row.step_order+' · '+row.decision+' — '+row.note;list.append(p);}
 });
 bind('workflow-final-form','final-status',async()=>{
  if(!confirm('Registrar a decisão acadêmica final deste protocolo?'))return {data:'cancelled'};
  return db.rpc('academy_workflow_finalize',{p_instance:$('final-instance').value.trim(),p_decision:$('final-decision').value,p_note:$('final-note').value.trim(),p_hours:$('final-hours').value?Number($('final-hours').value):null});
 },data=>{$('final-status').textContent=data==='cancelled'?'Operação cancelada.':'Decisão acadêmica registrada. Consulte o protocolo na administração.';});
})();
(() => {
 const button=document.getElementById('launch-check');if(!button)return;
 const cfg=window.ACADEMY_AUTH_CONFIG,db=window.supabase.createClient(cfg.url,cfg.publishableKey);
 button.onclick=async()=>{
  button.disabled=true;const target=document.getElementById('launch-result');target.textContent='Verificando…';
  try{
   const {data,error}=await db.functions.invoke('academy-launch-readiness',{body:{}});if(error)throw error;
   target.replaceChildren();
   for(const check of data.checks){const p=document.createElement('p');p.textContent=check.name+': '+(check.configured?'configurado; testar operação':'configurar '+check.missing.join(', '));target.append(p);}
   const note=document.createElement('p');note.textContent=data.message;target.append(note);
  }catch(error){target.textContent='Verificação indisponível: '+error.message;}finally{button.disabled=false;}
 };
})();
