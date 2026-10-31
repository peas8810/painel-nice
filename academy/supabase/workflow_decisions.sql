-- Harden workflow decisions. Apply after the existing workflow schema.
-- Every decision carries the step displayed to the reviewer.
create or replace function public.academy_workflow_decide(
  p_instance uuid, p_expected_step integer, p_decision text, p_note text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid; v_order integer; v_last integer; v_state text;
  v_next text; v_template uuid; v_request_status text;
begin
  if auth.uid() is null then raise exception 'Acesso restrito'; end if;
  if p_expected_step is null or p_expected_step < 1 or p_decision is null
     or p_decision not in ('AVANCAR','DEVOLVER','CONCLUIR')
     or length(trim(coalesce(p_note,''))) not between 10 and 1500 then
    raise exception 'Decisão, etapa ou justificativa inválida';
  end if;
  select t.tenant_id,i.current_step,i.state,i.template_id,r.status
    into v_tenant,v_order,v_state,v_template,v_request_status
    from public.academy_workflow_instances i
    join public.academy_workflow_templates t on t.id=i.template_id
    join public.academy_requests r on r.id=i.request_id
    where i.id=p_instance for update of i,r;
  if v_tenant is null then raise exception 'Fluxo não encontrado'; end if;
  if not public.academy_is_super_admin() and not exists (
    select 1 from public.academy_tenant_members m
    where m.tenant_id=v_tenant and m.user_id=auth.uid()
      and m.role in ('OWNER','MANAGER','REVIEWER')
  ) then raise exception 'Acesso restrito'; end if;
  if v_state <> 'EM_ANALISE' then raise exception 'Fluxo encerrado ou devolvido'; end if;
  if v_order <> p_expected_step then
    raise exception 'A etapa mudou. Atualize as análises antes de decidir.' using errcode='40001';
  end if;
  if v_request_status in ('APROVADO','REPROVADO','CANCELADA') then
    raise exception 'O protocolo já foi encerrado';
  end if;
  select max(step_order) into v_last from public.academy_workflow_steps where template_id=v_template;
  if v_last is null or not exists (
    select 1 from public.academy_workflow_steps where template_id=v_template and step_order=v_order
  ) then raise exception 'Etapas do fluxo inconsistentes'; end if;
  if p_decision='AVANCAR' and (v_order >= v_last or not exists (
    select 1 from public.academy_workflow_steps where template_id=v_template and step_order=v_order+1
  )) then raise exception 'Não há próxima etapa. Na última etapa use CONCLUIR'; end if;
  if p_decision='CONCLUIR' and v_order <> v_last then raise exception 'Ainda existem etapas pendentes'; end if;
  v_next := case p_decision when 'AVANCAR' then 'EM_ANALISE' when 'DEVOLVER' then 'DEVOLVIDO' else 'CONCLUIDO' end;
  insert into public.academy_workflow_history(instance_id,step_order,decision,note,actor_id)
    values(p_instance,v_order,p_decision,trim(p_note),auth.uid());
  update public.academy_workflow_instances
    set current_step=case when p_decision='AVANCAR' then v_order+1 else v_order end,
        state=v_next,updated_at=now() where id=p_instance;
  return v_next;
end $$;
revoke all on function public.academy_workflow_decide(uuid,integer,text,text) from public,anon;
grant execute on function public.academy_workflow_decide(uuid,integer,text,text) to authenticated;

-- Cached clients must refresh instead of calling the old, unversioned decision API.
create or replace function public.academy_workflow_advance(p_instance uuid,p_decision text,p_note text)
returns text language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'Atualize a página para registrar decisões com validação de etapa.';
end $$;
revoke all on function public.academy_workflow_advance(uuid,text,text) from public,anon;
grant execute on function public.academy_workflow_advance(uuid,text,text) to authenticated;
