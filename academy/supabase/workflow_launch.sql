-- Explicit institutional ownership; no inferred assignments of existing protocols.
create table if not exists public.academy_request_institutions (
 request_id uuid primary key references public.academy_requests(id),
 tenant_id uuid not null references public.academy_tenants(id),
 assigned_by uuid not null references auth.users(id), assigned_at timestamptz not null default now()
);
alter table public.academy_request_institutions enable row level security;
revoke all on public.academy_request_institutions from anon,authenticated;
create or replace function public.academy_workflow_bind(p_request uuid,p_tenant uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 select user_id into owner_id from public.academy_requests where id=p_request and status not in ('APROVADO','REPROVADO','CANCELADA') for update;
 if owner_id is null then raise exception 'Protocolo inexistente ou encerrado'; end if;
 if exists(select 1 from public.academy_workflow_instances where request_id=p_request) then raise exception 'Instituição não pode mudar após iniciar o fluxo'; end if;
 if not exists(select 1 from public.academy_tenant_members where tenant_id=p_tenant and user_id=owner_id and role='STUDENT') then raise exception 'Estudante não vinculado à instituição'; end if;
 insert into public.academy_request_institutions(request_id,tenant_id,assigned_by) values(p_request,p_tenant,auth.uid())
 on conflict(request_id) do update set tenant_id=excluded.tenant_id,assigned_by=excluded.assigned_by,assigned_at=now();
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(p_request,'INSTITUICAO_VINCULADA',auth.uid(),jsonb_build_object('tenant_id',p_tenant));
end $$;
create or replace function public.academy_workflow_start(p_template uuid,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant uuid; owner_id uuid; result uuid;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 select user_id into owner_id from public.academy_requests where id=p_request and status not in ('APROVADO','REPROVADO','CANCELADA') for update;
 if owner_id is null then raise exception 'Protocolo inexistente ou encerrado'; end if;
 select t.tenant_id into tenant from public.academy_workflow_templates t join public.academy_tenants n on n.id=t.tenant_id where t.id=p_template and t.active and n.active;
 if tenant is null then raise exception 'Fluxo ou instituição não está ativo'; end if;
 if not exists(select 1 from public.academy_request_institutions b where b.request_id=p_request and b.tenant_id=tenant) then raise exception 'Vincule explicitamente o protocolo à instituição do modelo'; end if;
 if not exists(select 1 from public.academy_tenant_members where tenant_id=tenant and user_id=owner_id and role='STUDENT') then raise exception 'Estudante não vinculado à instituição'; end if;
 insert into public.academy_workflow_instances(request_id,template_id) values(p_request,p_template) returning id into result;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(p_request,'WORKFLOW_INICIADO',auth.uid(),jsonb_build_object('instance_id',result,'tenant_id',tenant));
 return result;
end $$;
-- A monotonic revision is necessary because a returned workflow resumes at the same step.
alter table public.academy_workflow_instances add column if not exists revision integer not null default 0;
alter table public.academy_workflow_history drop constraint academy_workflow_history_decision_check;
alter table public.academy_workflow_history add constraint academy_workflow_history_decision_check check(decision in ('AVANCAR','DEVOLVER','CONCLUIR','RETOMAR'));
create or replace function public.academy_workflow_transition(p_instance uuid,p_revision integer,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare item public.academy_workflow_instances%rowtype; tenant uuid; last_step integer; request_status text; next_state text;
begin
 if auth.uid() is null then raise exception 'Acesso restrito'; end if;
 if p_revision is null or p_decision is null or p_decision not in ('AVANCAR','DEVOLVER','CONCLUIR','RETOMAR') or length(trim(coalesce(p_note,''))) not between 15 and 1500 then raise exception 'Decisão ou justificativa inválida'; end if;
 select * into item from public.academy_workflow_instances where id=p_instance for update;
 if not found then raise exception 'Fluxo não encontrado'; end if;
 select tenant_id into tenant from public.academy_workflow_templates where id=item.template_id;
 if not public.academy_is_super_admin() and not exists(select 1 from public.academy_tenant_members where tenant_id=tenant and user_id=auth.uid() and role in ('OWNER','MANAGER','REVIEWER')) then raise exception 'Acesso restrito'; end if;
 if item.revision<>p_revision then raise exception 'A análise mudou. Atualize a página.' using errcode='40001'; end if;
 select status into request_status from public.academy_requests where id=item.request_id for update;
 if request_status in ('APROVADO','REPROVADO','CANCELADA') then raise exception 'Protocolo encerrado'; end if;
 if not exists(select 1 from public.academy_request_institutions where request_id=item.request_id and tenant_id=tenant) then raise exception 'Vínculo institucional ausente'; end if;
 if p_decision='RETOMAR' then
  if item.state<>'DEVOLVIDO' then raise exception 'Somente fluxos devolvidos podem ser retomados'; end if;
  next_state:='EM_ANALISE';
 elsif item.state<>'EM_ANALISE' then raise exception 'Fluxo não está em análise';
 else
  select max(step_order) into last_step from public.academy_workflow_steps where template_id=item.template_id;
  if last_step is null then raise exception 'Modelo sem etapas'; end if;
  if p_decision='AVANCAR' and not exists(select 1 from public.academy_workflow_steps where template_id=item.template_id and step_order=item.current_step+1) then raise exception 'Última etapa: use CONCLUIR'; end if;
  if p_decision='CONCLUIR' and item.current_step<>last_step then raise exception 'Ainda existem etapas pendentes'; end if;
  next_state:=case p_decision when 'DEVOLVER' then 'DEVOLVIDO' when 'CONCLUIR' then 'CONCLUIDO' else 'EM_ANALISE' end;
 end if;
 insert into public.academy_workflow_history(instance_id,step_order,decision,note,actor_id) values(item.id,item.current_step,p_decision,trim(p_note),auth.uid());
 update public.academy_workflow_instances set state=next_state,current_step=current_step+case when p_decision='AVANCAR' then 1 else 0 end,revision=revision+1,updated_at=clock_timestamp() where id=item.id;
 if p_decision in ('DEVOLVER','RETOMAR') then
  update public.academy_requests set status=case when p_decision='DEVOLVER' then 'PENDENTE_DOCUMENTOS' else 'EM_ANALISE' end,updated_at=now() where id=item.request_id;
 end if;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(item.request_id,'WORKFLOW_'||p_decision,auth.uid(),jsonb_build_object('instance_id',item.id,'step',item.current_step,'note',trim(p_note)));
 return next_state;
end $$;
create or replace function public.academy_workflow_decide(p_instance uuid,p_expected_step integer,p_decision text,p_note text)
returns text language plpgsql security invoker set search_path='' as $$
begin raise exception 'Atualize a página para usar a revisão atual do workflow.'; end $$;
create or replace function public.academy_workflow_snapshot()
returns table(instance_id uuid,request_id uuid,workflow_name text,step_label text,step_order integer,state text,revision integer,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select i.id,i.request_id,t.name,s.label,i.current_step,i.state,i.revision,i.updated_at
 from public.academy_workflow_instances i join public.academy_workflow_templates t on t.id=i.template_id
 join public.academy_workflow_steps s on s.template_id=t.id and s.step_order=i.current_step
 where auth.uid() is not null and (public.academy_is_super_admin() or exists(select 1 from public.academy_tenant_members m where m.tenant_id=t.tenant_id and m.user_id=auth.uid() and m.role in ('OWNER','MANAGER','REVIEWER')))
 order by i.updated_at desc limit 100;
$$;
create or replace function public.academy_workflow_timeline(p_instance uuid)
returns table(step_order integer,decision text,note text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare tenant uuid; owner_id uuid;
begin
 select t.tenant_id,r.user_id into tenant,owner_id from public.academy_workflow_instances i join public.academy_workflow_templates t on t.id=i.template_id join public.academy_requests r on r.id=i.request_id where i.id=p_instance;
 if auth.uid() is null or tenant is null or not (public.academy_is_super_admin() or owner_id=auth.uid() or exists(select 1 from public.academy_tenant_members where tenant_id=tenant and user_id=auth.uid() and role in ('OWNER','MANAGER','REVIEWER'))) then raise exception 'Acesso restrito'; end if;
 return query select h.step_order,h.decision,h.note,h.created_at from public.academy_workflow_history h where h.instance_id=p_instance order by h.id;
end $$;
-- Final academic decision keeps the existing administrative approval checks.
create or replace function public.academy_workflow_finalize(p_instance uuid,p_decision text,p_note text,p_hours numeric default null)
returns void language plpgsql security definer set search_path='' as $$
declare item public.academy_workflow_instances%rowtype; cap numeric;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 if p_decision is null or p_decision not in ('APROVADO','REPROVADO') then raise exception 'Decisão inválida'; end if;
 select * into item from public.academy_workflow_instances where id=p_instance for update;
 if not found or item.state<>'CONCLUIDO' then raise exception 'Conclua todas as etapas antes da decisão acadêmica'; end if;
 if p_decision='APROVADO' then
  if p_hours is null or p_hours::text in ('NaN','Infinity','-Infinity') or p_hours<=0 then raise exception 'Horas verificadas inválidas'; end if;
  select r.max_hours into cap from public.academy_tenant_rules r join public.academy_workflow_templates t on t.tenant_id=r.tenant_id and t.category=r.category where t.id=item.template_id;
  if cap is not null and p_hours>cap then raise exception 'Carga horária ultrapassa o limite institucional'; end if;
  perform public.academy_admin_approve_request(item.request_id,p_note,p_hours);
 else
  perform public.academy_admin_review_request(item.request_id,p_decision,p_note);
 end if;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(item.request_id,'WORKFLOW_DECISAO_FINAL',auth.uid(),jsonb_build_object('instance_id',item.id,'decision',p_decision));
end $$;
revoke all on function public.academy_workflow_bind(uuid,uuid),public.academy_workflow_transition(uuid,integer,text,text),public.academy_workflow_snapshot(),public.academy_workflow_timeline(uuid),public.academy_workflow_finalize(uuid,text,text,numeric) from public,anon;
grant execute on function public.academy_workflow_bind(uuid,uuid),public.academy_workflow_transition(uuid,integer,text,text),public.academy_workflow_snapshot(),public.academy_workflow_timeline(uuid),public.academy_workflow_finalize(uuid,text,text,numeric) to authenticated;
