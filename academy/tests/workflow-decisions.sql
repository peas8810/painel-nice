-- Historical regression for the step-only API, retired by workflow_launch.sql.
-- Run workflow-launch.sql in this directory for the current revision-based API.
-- Integration regression tests. Run in one transaction and always roll back.
begin;
do $$
declare
  reviewer uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
  student uuid:=gen_random_uuid(); tenant uuid:=gen_random_uuid();
  other_tenant uuid:=gen_random_uuid(); model uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid(); instance uuid:=gen_random_uuid();
  result text; history_count integer;
begin
  insert into auth.users(id) values(reviewer),(outsider),(student);
  insert into public.academy_tenants(id,name,slug,active) values
    (tenant,'Workflow regression','test-'||tenant,true),
    (other_tenant,'Other regression','test-'||other_tenant,true);
  insert into public.academy_tenant_members(tenant_id,user_id,role) values
    (tenant,reviewer,'REVIEWER'),(other_tenant,outsider,'REVIEWER'),(tenant,student,'STUDENT');
  insert into public.academy_workflow_templates(id,tenant_id,name,category,active)
    values(model,tenant,'Test workflow','Test category',true);
  insert into public.academy_workflow_steps(template_id,step_order,label)
    values(model,1,'First step'),(model,2,'Second step'),(model,3,'Final step');
  insert into public.academy_requests(id,user_id,activity,activity_type,start_date,end_date,hours_declared,description)
    values(request,student,'Test activity','Test category',current_date,current_date,10,'Workflow regression fixture');
  insert into public.academy_workflow_instances(id,request_id,template_id) values(instance,request,model);
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.academy_workflow_decide(instance,1,'AVANCAR','Cross tenant attempt');
    raise exception 'TEST FAILED: cross tenant allowed';
  exception when others then if sqlerrm <> 'Acesso restrito' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',student::text,true);
  begin
    perform public.academy_workflow_decide(instance,1,'AVANCAR','Student attempt denied');
    raise exception 'TEST FAILED: student allowed';
  exception when others then if sqlerrm <> 'Acesso restrito' then raise; end if; end;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  begin
    perform public.academy_workflow_decide(instance,1,null,'Invalid null decision');
    raise exception 'TEST FAILED: null decision allowed';
  exception when others then if sqlerrm <> 'Decisão, etapa ou justificativa inválida' then raise; end if; end;
  begin
    perform public.academy_workflow_decide(instance,1,'CONCLUIR','Premature completion');
    raise exception 'TEST FAILED: skipped steps';
  exception when others then if sqlerrm <> 'Ainda existem etapas pendentes' then raise; end if; end;
  result:=public.academy_workflow_decide(instance,1,'AVANCAR','First step verified');
  if result <> 'EM_ANALISE' then raise exception 'TEST FAILED: first advance'; end if;
  begin
    perform public.academy_workflow_decide(instance,1,'AVANCAR','Repeated stale decision');
    raise exception 'TEST FAILED: stale step accepted';
  exception when serialization_failure then null; end;
  select count(*) into history_count from public.academy_workflow_history where instance_id=instance;
  if history_count <> 1 then raise exception 'TEST FAILED: rejected decision wrote history'; end if;
  update public.academy_requests set status='CANCELADA' where id=request;
  begin
    perform public.academy_workflow_decide(instance,2,'AVANCAR','Cancelled request attempt');
    raise exception 'TEST FAILED: cancelled protocol allowed';
  exception when others then if sqlerrm <> 'O protocolo já foi encerrado' then raise; end if; end;
  update public.academy_requests set status='ENVIADA' where id=request;
  perform public.academy_workflow_decide(instance,2,'AVANCAR','Second step verified');
  result:=public.academy_workflow_decide(instance,3,'CONCLUIR','Final internal decision');
  if result <> 'CONCLUIDO' then raise exception 'TEST FAILED: completion'; end if;
  if (select status from public.academy_requests where id=request) <> 'ENVIADA' then
    raise exception 'TEST FAILED: internal workflow changed academic status'; end if;
  begin
    perform public.academy_workflow_decide(instance,3,'CONCLUIR','Repeat final decision');
    raise exception 'TEST FAILED: closed workflow changed';
  exception when others then if sqlerrm <> 'Fluxo encerrado ou devolvido' then raise; end if; end;
  begin
    perform public.academy_workflow_advance(instance,'AVANCAR','Old cached client');
    raise exception 'TEST FAILED: legacy endpoint accepted';
  exception when others then
    if sqlerrm <> 'Atualize a página para registrar decisões com validação de etapa.' then raise; end if;
  end;
  if has_function_privilege('anon','public.academy_workflow_decide(uuid,integer,text,text)','EXECUTE') then
    raise exception 'TEST FAILED: anonymous execute granted'; end if;
end $$;
rollback;
select 'workflow regression tests passed; fixtures rolled back' as result;
