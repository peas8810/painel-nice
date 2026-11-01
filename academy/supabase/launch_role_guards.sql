create or replace function public.academy_can_review(p_request uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.academy_workflow_instances i join public.academy_workflow_templates t on t.id=i.template_id
 join public.academy_workflow_steps s on s.template_id=t.id and s.step_order=i.current_step join public.academy_requests r on r.id=i.request_id
 where i.request_id=p_request and r.user_id<>auth.uid() and
 (public.academy_is_super_admin() or exists(select 1 from public.academy_tenant_members m where m.tenant_id=t.tenant_id and m.user_id=auth.uid()
 and (m.role='OWNER' or m.role=s.assigned_role or (m.role='MANAGER' and s.assigned_role='REVIEWER')) and (s.assigned_user is null or s.assigned_user=auth.uid()))));
$$;
create or replace function public.academy_workflow_start(p_template uuid,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant uuid; owner_id uuid; result uuid;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 select user_id into owner_id from public.academy_requests where id=p_request and status not in ('APROVADO','REPROVADO','CANCELADA') for update;
 if owner_id is null then raise exception 'Protocolo inexistente ou encerrado'; end if;
 select t.tenant_id into tenant from public.academy_workflow_templates t join public.academy_tenants n on n.id=t.tenant_id where t.id=p_template and t.active and n.active for share of t;
 if tenant is null then raise exception 'Fluxo ou instituição não está ativo'; end if;
 if not exists(select 1 from public.academy_request_institutions b where b.request_id=p_request and b.tenant_id=tenant) then raise exception 'Vincule explicitamente o protocolo à instituição do modelo'; end if;
 if not exists(select 1 from public.academy_tenant_members where tenant_id=tenant and user_id=owner_id and role='STUDENT') then raise exception 'Estudante não vinculado à instituição'; end if;
 insert into public.academy_workflow_instances(request_id,template_id) values(p_request,p_template) returning id into result;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(p_request,'WORKFLOW_INICIADO',auth.uid(),jsonb_build_object('instance_id',result,'tenant_id',tenant));
 return result;
end $$;
