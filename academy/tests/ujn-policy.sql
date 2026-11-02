begin;
do $$
declare a uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); x uuid:=gen_random_uuid(); r uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); opened uuid; snap text; lease uuid; code text;
begin
 insert into auth.users(id) values(a),(u),(x);
 insert into public.academy_admin_members(user_id,role,enabled) values(a,'SUPER_ADMIN',true);
 begin
  insert into public.academy_requests(user_id,activity,activity_type,start_date,end_date,hours_declared,description,participants_count,teaching_activity) values(u,'Invalid activity','Curso',current_date,current_date,301,'Synthetic test activity only',2,true);
  raise exception 'TEST FAILED: over 300 accepted';
 exception when others then if sqlerrm not like 'Regulamento UJN:%' then raise; end if; end;
 begin
  insert into public.academy_requests(user_id,activity,activity_type,start_date,end_date,hours_declared,description,participants_count,teaching_activity) values(u,'Invalid activity','Curso',current_date,current_date,10,'Synthetic test activity only',1,true);
  raise exception 'TEST FAILED: one participant accepted';
 exception when others then if sqlerrm not like 'Regulamento UJN:%' then raise; end if; end;
 begin
  insert into public.academy_requests(user_id,activity,activity_type,start_date,end_date,hours_declared,description,participants_count,teaching_activity) values(u,'Invalid activity','Curso',current_date,current_date,10,'Synthetic test activity only',2,false);
  raise exception 'TEST FAILED: non teaching accepted';
 exception when others then if sqlerrm not like 'Regulamento UJN:%' then raise; end if; end;
 insert into public.academy_requests(id,user_id,activity,activity_type,start_date,end_date,hours_declared,description,participants_count,teaching_activity) values(r,u,'Zero hour activity','Curso',current_date,current_date,0,'Synthetic test activity only',2,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin
  perform public.academy_admin_approve_request(r,'Human validation synthetic fixture',0);
  raise exception 'TEST FAILED: missing evidence accepted';
 exception when others then if sqlerrm<>'Nenhum comprovante validado' then raise; end if; end;
 insert into public.academy_evidence(request_id,user_id,file_path,file_name,review_status,category) select r,u,u::text||'/'||r::text||'/'||v||'.pdf',v||'.pdf','VALIDADO',v from unnest(array['PRESENCA','FOTOS','ARTES','CONTEUDO']) v;
 begin
  perform public.academy_admin_approve_request(r,'Human validation synthetic fixture',0);
  raise exception 'TEST FAILED: approval without AI';
 exception when others then if sqlerrm<>'Realize a análise preliminar por IA dos dados e documentos atuais' then raise; end if; end;
 snap:=public.academy_policy_snapshot(r);
 insert into public.academy_ai_reviews(request_id,snapshot,model,report,requested_by) values(r,snap,'test-model','Synthetic preliminary report: no provider called',a);
 update public.academy_requests set description='Changed synthetic description for stale report test' where id=r;
 begin
  perform public.academy_admin_approve_request(r,'Human validation synthetic fixture',0);
  raise exception 'TEST FAILED: stale report accepted';
 exception when others then if sqlerrm<>'Realize a análise preliminar por IA dos dados e documentos atuais' then raise; end if; end;
 insert into public.academy_ai_reviews(request_id,snapshot,model,report,requested_by) values(r,public.academy_policy_snapshot(r),'test-model','Current synthetic report: no provider called',a);
 perform public.academy_admin_approve_request(r,'Human validation synthetic fixture',0);
 if not exists(select 1 from public.academy_requests where id=r and status='APROVADO' and hours_verified=0) then raise exception 'TEST FAILED: zero hours approval'; end if;
 insert into public.academy_certificates(id,request_id,status) values(c,r,'PENDENTE_EMISSAO') returning certificate_code into code;
 insert into public.academy_payment_releases(request_id,released_by,checkout_environment,payment_status,mp_payment_id) values(r,a,'sandbox','PAGO_CONFIRMADO','synthetic-payment-no-provider');
 lease:=public.academy_certificate_claim(r,'sandbox');
 if lease is null or public.academy_certificate_claim(r,'sandbox') is not null then raise exception 'TEST FAILED: duplicate issuance reservation';end if;
 begin perform public.academy_certificate_finish(r,gen_random_uuid(),'bad',repeat('a',64),repeat('b',64),'fixture@example.invalid');raise exception 'TEST FAILED: wrong lease';exception when others then if sqlerrm<>'Reserva de emissão inválida ou expirada' then raise;end if;end;
 perform public.academy_certificate_finish(r,lease,u::text||'/'||r::text||'/'||code||'.'||lease::text||'.pdf',repeat('a',64),repeat('b',64),'fixture@example.invalid');
 if public.academy_certificate_claim(r,'sandbox') is not null then raise exception 'TEST FAILED: reissue of emitted certificate';end if;
 perform set_config('request.jwt.claim.sub',x::text,true);
 begin perform public.academy_case_open(r,'CANCELAMENTO','Unauthorized cancellation test');raise exception 'TEST FAILED: unauthorized cancellation';exception when others then if sqlerrm<>'Protocolo não encontrado' then raise; end if;end;
 begin perform public.academy_provider_save('RESEND_API_KEY','synthetic-not-a-real-key');raise exception 'TEST FAILED: provider modification';exception when others then if sqlerrm<>'Acesso restrito' then raise; end if;end;
 if has_function_privilege('authenticated','public.academy_provider_read()','EXECUTE') or has_function_privilege('anon','public.academy_provider_read()','EXECUTE') then raise exception 'TEST FAILED: secret reader public';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 opened:=public.academy_case_open(r,'RECURSO','Synthetic appeal with no provider actions');
 if not exists(select 1 from public.academy_case_list() where id=opened) then raise exception 'TEST FAILED: own case missing';end if;
 perform set_config('request.jwt.claim.sub',x::text,true);
 if exists(select 1 from public.academy_case_list() where id=opened) then raise exception 'TEST FAILED: case leaked';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.academy_case_open(r,'CANCELAMENTO','Synthetic cancellation requested by owner');
 if not exists(select 1 from public.academy_certificates where id=c and status='REVOGADO' and revoked_at is not null) then raise exception 'TEST FAILED: certificate not revoked';end if;
 if not exists(select 1 from public.academy_requests where id=r and status='CANCELADA') then raise exception 'TEST FAILED: request not cancelled';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.academy_provider_save('ACADEMY_EMAIL_FROM','contato@ujn.ojsbr.com');
 if public.academy_provider_read()->>'ACADEMY_EMAIL_FROM'<>'contato@ujn.ojsbr.com' then raise exception 'TEST FAILED: provider read/write';end if;
 begin perform public.academy_provider_save('ACADEMY_ENABLE_PAYMENTS','production');raise exception 'TEST FAILED: production flag writable';exception when others then if sqlerrm<>'Configuração inválida' then raise;end if;end;
end $$;
rollback;
