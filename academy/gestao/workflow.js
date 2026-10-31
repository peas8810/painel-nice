(()=>{const $=id=>document.getElementById(id);const cfg=window.ACADEMY_AUTH_CONFIG;if(!cfg||!window.supabase)return;const db=window.supabase.createClient(cfg.url,cfg.publishableKey);const form=$('workflow-form');if(!form)return;async function load(){const {data:tenants,error:e1}=await db.rpc('academy_superadmin_tenant_list');if(e1)return;const select=$('workflow-tenant');select.replaceChildren();for(const t of tenants||[]){const o=document.createElement('option');o.value=t.id;o.textContent=t.name;select.append(o)}const {data:flows,error}=await db.rpc('academy_workflow_list');const list=$('workflow-list');list.replaceChildren();if(error){list.textContent='Fluxos indisponíveis: '+error.message;return}if(!flows?.length){list.textContent='Nenhum fluxo cadastrado.';return}for(const flow of flows){const row=document.createElement('div');row.className='stat';const title=document.createElement('strong');title.textContent=flow.workflow_name;const info=document.createElement('p');info.textContent=flow.tenant_name+' · '+flow.category+' · '+flow.steps+' etapa(s) · '+(flow.active?'Ativo':'Desativado');row.append(title,info);const toggle=document.createElement('button');toggle.type='button';toggle.textContent=flow.active?'Desativar modelo':'Ativar modelo';toggle.onclick=async()=>{if(!confirm((flow.active?'Desativar':'Ativar')+' este fluxo para análises futuras?'))return;toggle.disabled=true;const {data,error}=await db.rpc('academy_workflow_activate',{p_template:flow.id,p_active:!flow.active});$('workflow-status').textContent=error?'Falha: '+error.message:data?'Modelo atualizado.':'Modelo não localizado.';await load();window.dispatchEvent(new Event('academy-workflow-updated'))};row.append(toggle);list.append(row)}}form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;const status=$('workflow-status');const steps=$('workflow-steps').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(steps.length<1||steps.length>12){status.textContent='Informe de 1 a 12 etapas.';button.disabled=false;return}try{const {data,error}=await db.rpc('academy_workflow_setup',{p_tenant:$('workflow-tenant').value,p_name:$('workflow-name').value.trim(),p_category:$('workflow-category').value.trim(),p_steps:steps});if(error)throw error;status.textContent='Modelo criado desativado. Identificador: '+data;form.reset();await load()}catch(err){status.textContent='Não foi possível cadastrar: '+err.message}finally{button.disabled=false}});db.auth.onAuthStateChange((event,session)=>{if(session?.user&&event!=='TOKEN_REFRESHED')setTimeout(load,100)});setTimeout(load,650)})();
/* Every mutation uses the step loaded by this page; the database rejects stale decisions. */
(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.ACADEMY_AUTH_CONFIG;
  if (!window.supabase || !cfg || !$('workflow-start-form')) return;
  const db = window.supabase.createClient(cfg.url, cfg.publishableKey);
  let generation = 0;
  let pending = false;
  const decisionButton = $('workflow-decision-form').querySelector('button');
  decisionButton.disabled = true;
  async function refresh() {
    const current = ++generation;
    decisionButton.disabled = true;
    try {
      const [models, instances] = await Promise.all([
        db.rpc('academy_workflow_list'), db.rpc('academy_workflow_inbox')
      ]);
      if (current !== generation) return;
      const select = $('workflow-active'), list = $('workflow-inbox'), inst = $('workflow-instance');
      select.replaceChildren(); list.replaceChildren(); inst.replaceChildren();
      if (models.error) throw models.error;
      for (const model of models.data || []) {
        if (!model.active) continue;
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.tenant_name + ' · ' + model.workflow_name;
        select.append(option);
      }
      if (instances.error) throw instances.error;
      if (!instances.data?.length) list.textContent = 'Nenhum fluxo cadastrado.';
      for (const item of instances.data || []) {
        const row = document.createElement('p');
        row.className = 'row';
        row.textContent = item.workflow_name + ' · ' + item.step_label + ' · ' + item.state + ' · protocolo ' + item.request_id;
        list.append(row);
        if (item.state !== 'EM_ANALISE') continue;
        const option = document.createElement('option');
        option.value = item.instance_id;
        option.dataset.step = String(item.step_order);
        option.textContent = item.workflow_name + ' · Etapa ' + item.step_order + ' · ' + item.request_id;
        inst.append(option);
      }
      decisionButton.disabled = pending || !inst.options.length;
    } catch (error) {
      if (current !== generation) return;
      $('workflow-instance').replaceChildren();
      $('workflow-inbox').textContent = 'Análises indisponíveis: ' + error.message;
    }
  }
  $('workflow-start-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const { error, data } = await db.rpc('academy_workflow_start', {
        p_template: $('workflow-active').value, p_request: $('workflow-request-id').value.trim()
      });
      if (error) throw error;
      $('workflow-start-status').textContent = 'Fluxo iniciado: ' + data;
      await refresh();
    } catch (error) {
      $('workflow-start-status').textContent = 'Não foi possível confirmar o início: ' + error.message + '. Atualize as análises antes de tentar novamente.';
    } finally { button.disabled = false; }
  });
  $('workflow-decision-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || decisionButton.disabled) return;
    const option = $('workflow-instance').selectedOptions[0];
    const step = Number(option?.dataset.step);
    if (!option || !Number.isInteger(step) || step < 1) return;
    // Capture the displayed instance and step before the asynchronous operation.
    const args = {
      p_instance: option.value, p_expected_step: step,
      p_decision: $('workflow-decision').value, p_note: $('workflow-note').value.trim()
    };
    if (!confirm('Registrar esta decisão interna no histórico do fluxo?')) return;
    pending = true; decisionButton.disabled = true;
    try {
      const { error, data } = await db.rpc('academy_workflow_decide', args);
      if (error) throw error;
      $('workflow-decision-status').textContent = 'Etapa atualizada: ' + data;
      $('workflow-note').value = '';
    } catch (error) {
      $('workflow-decision-status').textContent = 'Não foi possível confirmar a decisão: ' + error.message + '. Confira a etapa atual antes de tentar novamente.';
    } finally {
      pending = false;
      await refresh();
    }
  });
  $('workflow-refresh').onclick = refresh;
  window.addEventListener('academy-workflow-updated', refresh);
  db.auth.onAuthStateChange((event, session) => {
    if (session?.user && event !== 'TOKEN_REFRESHED') setTimeout(refresh, 100);
    if (!session) {
      generation++;
      $('workflow-instance').replaceChildren();
      $('workflow-inbox').replaceChildren();
      $('workflow-active').replaceChildren();
      decisionButton.disabled = true;
    }
  });
  setTimeout(refresh, 800);
})();
