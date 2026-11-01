-- Conditional routing and role ownership. Published models are immutable after first use.
alter table public.academy_workflow_steps add column if not exists assigned_role text not null default 'REVIEWER' check(assigned_role in ('REVIEWER','MANAGER','OWNER'));
alter table public.academy_workflow_steps add column if not exists assigned_user uuid references auth.users(id);
alter table public.academy_workflow_steps add column if not exists min_hours numeric;
alter table public.academy_workflow_steps add column if not exists max_hours numeric;
alter table public.academy_workflow_steps add column if not exists activity_type text;
create or replace function public.academy_navigation_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('admin',auth.uid() is not null and public.academy_is_super_admin(),'reviewer',auth.uid() is not null and exists(select 1 from public.academy_tenant_members where user_id=auth.uid() and role in ('OWNER','MANAGER','REVIEWER')));
$$;
create or replace function public.academy_can_review(p_request uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.academy_workflow_instances i join public.academy_workflow_templates t on t.id=i.template_id
 join public.academy_workflow_steps s on s.template_id=t.id and s.step_order=i.current_step join public.academy_requests r on r.id=i.request_id
 where i.request_id=p_request and r.user_id<>auth.uid() and
 (public.academy_is_super_admin() or exists(select 1 from public.academy_tenant_members m where m.tenant_id=t.tenant_id and m.user_id=auth.uid()
 and (m.role='OWNER' or m.role=s.assigned_role or (m.role='MANAGER' and s.assigned_role='REVIEWER')) and (s.assigned_user is null or s.assigned_user=auth.uid()))));
$$;
create or replace function public.academy_workflow_step_config(p_step uuid,p_role text,p_user uuid default null,p_min numeric default null,p_max numeric default null,p_category text default null)
returns void language plpgsql security definer set search_path='' as $$
declare t uuid; tenant uuid;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 select s.template_id,w.tenant_id into t,tenant from public.academy_workflow_steps s join public.academy_workflow_templates w on w.id=s.template_id where s.id=p_step for update of w;
 if t is null then raise exception 'Etapa inexistente'; end if;
 if exists(select 1 from public.academy_workflow_instances where template_id=t) then raise exception 'Crie uma nova versão do modelo já utilizado'; end if;
 if p_role not in ('REVIEWER','MANAGER','OWNER') or p_role is null or (p_min is not null and (p_min<0 or p_min::text in ('NaN','Infinity','-Infinity'))) or (p_max is not null and (p_max<0 or p_max::text in ('NaN','Infinity','-Infinity'))) or p_min>p_max then raise exception 'Condições inválidas'; end if;
 if p_user is not null and not exists(select 1 from public.academy_tenant_members where tenant_id=tenant and user_id=p_user and role in ('REVIEWER','MANAGER','OWNER')) then raise exception 'Responsável não pertence à equipe'; end if;
 update public.academy_workflow_steps set assigned_role=p_role,assigned_user=p_user,min_hours=p_min,max_hours=p_max,activity_type=nullif(trim(p_category),'') where id=p_step;
end $$;
create or replace function public.academy_workflow_step_list(p_template uuid) returns setof public.academy_workflow_steps language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 return query select * from public.academy_workflow_steps where template_id=p_template order by step_order;
end $$;
-- The first and final steps always require human review. Conditional routing only skips intermediate steps.
create or replace function public.academy_workflow_next(p_template uuid,p_current int,p_request uuid) returns int language sql stable set search_path='' as $$
 select min(s.step_order) from public.academy_workflow_steps s cross join public.academy_requests r where s.template_id=p_template and r.id=p_request and s.step_order>p_current and
 (s.step_order=(select max(step_order) from public.academy_workflow_steps where template_id=p_template) or
 ((s.min_hours is null or r.hours_declared>=s.min_hours) and (s.max_hours is null or r.hours_declared<=s.max_hours) and (s.activity_type is null or s.activity_type=r.activity_type)));
$$;
create or replace function public.academy_reviewer_detail(p_instance uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i public.academy_workflow_instances; result jsonb;
begin
 select * into i from public.academy_workflow_instances where id=p_instance;
 if i.id is null or not public.academy_can_review(i.request_id) then raise exception 'Acesso restrito'; end if;
 select jsonb_build_object('instance',to_jsonb(i),'request',to_jsonb(r),'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.file_name,'path',e.file_path,'status',e.review_status)) from public.academy_evidence e where e.request_id=r.id),'[]'::jsonb),'history',coalesce((select jsonb_agg(jsonb_build_object('step',h.step_order,'decision',h.decision,'note',h.note,'at',h.created_at) order by h.id) from public.academy_workflow_history h where h.instance_id=i.id),'[]'::jsonb)) into result from public.academy_requests r where r.id=i.request_id;
 return result;
end $$;
create or replace function public.academy_reviewer_evidence(p_instance uuid,p_revision int,p_evidence uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare i public.academy_workflow_instances;
begin
 select * into i from public.academy_workflow_instances where id=p_instance for update;
 if i.id is null or not public.academy_can_review(i.request_id) then raise exception 'Acesso restrito'; end if;
 if i.revision<>p_revision then raise exception 'Análise mudou; atualize' using errcode='40001'; end if;
 if i.state<>'EM_ANALISE' or p_status not in ('VALIDADO','REPROVADO') or p_status is null or length(trim(coalesce(p_note,''))) not between 15 and 1500 then raise exception 'Revisão inválida'; end if;
 if exists(select 1 from public.academy_requests where id=i.request_id and status in ('APROVADO','REPROVADO','CANCELADA')) then raise exception 'Protocolo encerrado'; end if;
 update public.academy_evidence set review_status=p_status,reviewed_by=auth.uid(),reviewed_at=now() where id=p_evidence and request_id=i.request_id;
 if not found then raise exception 'Documento não pertence ao protocolo'; end if;
 update public.academy_workflow_instances set revision=revision+1 where id=i.id;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(i.request_id,'DOCUMENTO_REVISADO',auth.uid(),jsonb_build_object('evidence_id',p_evidence,'status',p_status,'note',trim(p_note)));
end $$;
create policy academy_reviewer_document_read on storage.objects for select to authenticated using(bucket_id='academy-evidencias' and exists(select 1 from public.academy_evidence e where e.file_path=name and public.academy_can_review(e.request_id)));
-- Query is constrained by existing evidence RLS; permit only documents of a currently assigned review.
create policy academy_evidence_assigned_review on public.academy_evidence for select to authenticated using(public.academy_can_review(request_id));
insert into public.academy_tenants(name,slug,active) values('Editora Unified Journals Network — UJN','editora-ujn',true) on conflict(slug) do nothing;
-- No numeric recognition cap is fabricated; these are existing UJN service principles, pending institutional approval.
-- Explicit grants: internal routing helper is not a client endpoint.
revoke all on function public.academy_workflow_next(uuid,int,uuid) from public,anon,authenticated;
do $$ declare fn record; begin for fn in select oid::regprocedure as sig from pg_proc where pronamespace='public'::regnamespace and proname in ('academy_navigation_access','academy_can_review','academy_workflow_step_config','academy_workflow_step_list','academy_reviewer_detail','academy_reviewer_evidence') loop execute format('revoke all on function %s from public,anon',fn.sig);execute format('grant execute on function %s to authenticated',fn.sig);end loop;end $$;
create or replace function public.academy_workflow_transition(p_instance uuid,p_revision integer,p_decision text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare item public.academy_workflow_instances%rowtype; tenant uuid; last_step integer; request_status text; next_state text; next_step int;
begin
 if auth.uid() is null then raise exception 'Acesso restrito'; end if;
 if p_revision is null or p_decision is null or p_decision not in ('AVANCAR','DEVOLVER','CONCLUIR','RETOMAR') or length(trim(coalesce(p_note,''))) not between 15 and 1500 then raise exception 'Decisão ou justificativa inválida'; end if;
 select * into item from public.academy_workflow_instances where id=p_instance for update;
 if not found then raise exception 'Fluxo não encontrado'; end if;
 select tenant_id into tenant from public.academy_workflow_templates where id=item.template_id;
 if not public.academy_can_review(item.request_id) then raise exception 'Acesso restrito'; end if;
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
  next_step:=public.academy_workflow_next(item.template_id,item.current_step,item.request_id);
  if p_decision='AVANCAR' and next_step is null then raise exception 'Última etapa: use CONCLUIR'; end if;
  if p_decision='CONCLUIR' and item.current_step<>last_step then raise exception 'Ainda existem etapas pendentes'; end if;
  next_state:=case p_decision when 'DEVOLVER' then 'DEVOLVIDO' when 'CONCLUIR' then 'CONCLUIDO' else 'EM_ANALISE' end;
 end if;
 insert into public.academy_workflow_history(instance_id,step_order,decision,note,actor_id) values(item.id,item.current_step,p_decision,trim(p_note),auth.uid());
 update public.academy_workflow_instances set state=next_state,current_step=case when p_decision='AVANCAR' then next_step else current_step end,revision=revision+1,updated_at=clock_timestamp() where id=item.id;
 if p_decision in ('DEVOLVER','RETOMAR') then
  update public.academy_requests set status=case when p_decision='DEVOLVER' then 'PENDENTE_DOCUMENTOS' else 'EM_ANALISE' end,updated_at=now() where id=item.request_id;
 end if;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(item.request_id,'WORKFLOW_'||p_decision,auth.uid(),jsonb_build_object('instance_id',item.id,'step',item.current_step,'note',trim(p_note)));
 return next_state;
end $$;
-- Key lifecycle: keep public keys available for old signatures, remove retired private material.
alter table public.academy_credential_keys add column if not exists revoked_at timestamptz;
alter table public.academy_credential_keys alter column private_jwk drop not null;
create or replace function public.academy_rotate_credential_key(p_private jsonb,p_public jsonb) returns uuid language plpgsql set search_path='' as $$
declare k uuid;
begin
 perform pg_advisory_xact_lock(hashtext('academy-credential-key-rotation'));
 if p_private->>'kty'<>'EC' or p_private->>'crv'<>'P-256' or p_private->>'d' is null or p_public ? 'd' then raise exception 'Chave inválida'; end if;
 update public.academy_credential_keys set active=false,private_jwk=null where active;
 insert into public.academy_credential_keys(private_jwk,public_jwk,active) values(p_private,p_public,true) returning kid into k;
 return k;
end $$;
revoke all on function public.academy_rotate_credential_key(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.academy_rotate_credential_key(jsonb,jsonb) to service_role;
create table public.academy_launch_checks (
 code text primary key check(code in ('rules','identity','whatsapp','payment','email','devices','credentials','privacy','restore','journey')),
 evidence text not null check(length(evidence) between 20 and 3000), passed boolean not null,
 checked_by uuid not null references auth.users(id), checked_at timestamptz not null default now()
);
alter table public.academy_launch_checks enable row level security;
revoke all on public.academy_launch_checks from public,anon,authenticated;
create or replace function public.academy_launch_check_record(p_code text,p_evidence text,p_passed boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 insert into public.academy_launch_checks values(p_code,p_evidence,p_passed,auth.uid(),now()) on conflict(code) do update set evidence=excluded.evidence,passed=excluded.passed,checked_by=excluded.checked_by,checked_at=excluded.checked_at;
end $$;
create or replace function public.academy_launch_check_list() returns setof public.academy_launch_checks language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 return query select * from public.academy_launch_checks order by code;
end $$;
revoke all on function public.academy_launch_check_record(text,text,boolean),public.academy_launch_check_list() from public,anon;
grant execute on function public.academy_launch_check_record(text,text,boolean),public.academy_launch_check_list() to authenticated;
-- Triggers run internally; they are not public RPCs.
revoke execute on function public.academy_log_message(),public.academy_notify_evidence_insert(),public.academy_notify_request_changes(),public.academy_queue_conversation_notification(),public.academy_queue_event_notifications() from public,anon,authenticated;
grant select on public.academy_launch_checks to service_role;
alter table public.academy_payment_releases add column if not exists checkout_environment text check(checkout_environment in ('sandbox','production'));
create or replace function public.academy_commercial_ready() returns boolean language sql stable set search_path='' as $$
 select count(*)=10 and bool_and(passed) from public.academy_launch_checks;
$$;
revoke all on function public.academy_commercial_ready() from public,anon,authenticated;
grant execute on function public.academy_commercial_ready() to service_role;
do $$ declare t uuid; w uuid; begin
 select id into t from public.academy_tenants where slug='editora-ujn';
 insert into public.academy_workflow_templates(tenant_id,name,category,active) values(t,'UJN — análise documental v1','Geral',false) returning id into w;
 insert into public.academy_workflow_steps(template_id,step_order,label,assigned_role) values(w,1,'Conferência documental','REVIEWER'),(w,2,'Revisão complementar','REVIEWER'),(w,3,'Parecer final institucional','MANAGER');
end $$;
