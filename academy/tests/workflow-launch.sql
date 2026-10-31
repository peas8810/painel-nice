begin;
do $$
declare
 admin uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 tenant uuid:=gen_random_uuid(); other_tenant uuid:=gen_random_uuid(); model uuid; req uuid:=gen_random_uuid(); inst uuid; answer text;
begin
 insert into auth.users(id) values(admin),(student),(outsider);
 insert into public.academy_admin_members(user_id,role) values(admin,'SUPER_ADMIN');
 insert into public.academy_tenants(id,name,slug,active) values(tenant,'Launch fixture','test-'||tenant,true),(other_tenant,'Other fixture','test-'||other_tenant,true);
 insert into public.academy_tenant_members values(tenant,student,'STUDENT'),(other_tenant,student,'STUDENT'),(other_tenant,outsider,'REVIEWER');
 insert into public.academy_requests(id,user_id,activity,activity_type,start_date,end_date,hours_declared,description) values(req,student,'Test activity','Test category',current_date,current_date,10,'Fictitious workflow launch fixture');
 perform set_config('request.jwt.claim.sub',admin::text,true);
 model:=public.academy_workflow_setup(tenant,'Test model','Test category',array['First step','Final step']);
 perform public.academy_workflow_activate(model,true);
 begin
  perform public.academy_workflow_start(model,req);
  raise exception 'TEST FAILED: implicit institution';
 exception when others then if sqlerrm<>'Vincule explicitamente o protocolo à instituição do modelo' then raise; end if; end;
 perform public.academy_workflow_bind(req,other_tenant);
 begin
  perform public.academy_workflow_start(model,req);
  raise exception 'TEST FAILED: wrong institution';
 exception when others then if sqlerrm<>'Vincule explicitamente o protocolo à instituição do modelo' then raise; end if; end;
 perform public.academy_workflow_bind(req,tenant);
 inst:=public.academy_workflow_start(model,req);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 begin
  perform public.academy_workflow_transition(inst,0,'AVANCAR','Attempt by another institution');
  raise exception 'TEST FAILED: unauthorized';
 exception when others then if sqlerrm<>'Acesso restrito' then raise; end if; end;
 begin
  perform public.academy_workflow_timeline(inst);
  raise exception 'TEST FAILED: history leaked';
 exception when others then if sqlerrm<>'Acesso restrito' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 begin
  perform public.academy_admin_approve_request(req,'Bypass unfinished workflow',5);
  raise exception 'TEST FAILED: approval bypass';
 exception when others then if sqlerrm<>'Conclua o workflow antes da decisão final' then raise; end if; end;
 perform public.academy_workflow_transition(inst,0,'DEVOLVER','Please correct the documents');
 if (select status from public.academy_requests where id=req)<>'PENDENTE_DOCUMENTOS' then raise exception 'TEST FAILED: return state'; end if;
 perform public.academy_workflow_transition(inst,1,'RETOMAR','Corrections reviewed by analyst');
 begin
  perform public.academy_workflow_transition(inst,0,'AVANCAR','Stale command before return');
  raise exception 'TEST FAILED: stale revision';
 exception when serialization_failure then null; end;
 perform public.academy_workflow_transition(inst,2,'AVANCAR','First step verified with evidence');
 perform public.academy_workflow_transition(inst,3,'CONCLUIR','All internal steps completed');
 begin
  perform public.academy_workflow_finalize(inst,'APROVADO','Approval without validated evidence',5);
  raise exception 'TEST FAILED: evidence missing';
 exception when others then if sqlerrm<>'Nenhum comprovante validado' then raise; end if; end;
 insert into public.academy_evidence(request_id,user_id,file_path,file_name,review_status,reviewed_by) values(req,student,student||'/'||req||'/fixture.pdf','fixture.pdf','VALIDADO',admin);
 begin
  perform public.academy_workflow_finalize(inst,'APROVADO','Approval with invalid hours',null);
  raise exception 'TEST FAILED: null hours';
 exception when others then if sqlerrm<>'Horas verificadas inválidas' then raise; end if; end;
 perform public.academy_workflow_finalize(inst,'APROVADO','Approved after documentary review',5);
 if (select status from public.academy_requests where id=req)<>'APROVADO' or (select hours_verified from public.academy_requests where id=req)<>5 then raise exception 'TEST FAILED: academic result'; end if;
 if (select count(*) from public.academy_workflow_history where instance_id=inst)<>4 then raise exception 'TEST FAILED: history'; end if;
 if exists(select 1 from public.academy_payment_releases where request_id=req) or exists(select 1 from public.academy_certificates where request_id=req) then raise exception 'TEST FAILED: unexpected financial side effect'; end if;
 if has_function_privilege('anon','public.academy_workflow_transition(uuid,integer,text,text)','EXECUTE') then raise exception 'TEST FAILED: anon access'; end if;
end $$;
rollback;
select 'PASS: institutional binding, isolation, return/resume, revision, approval and evidence; fixtures rolled back' as result;
