begin;
do $$
declare a uuid:=gen_random_uuid();u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();n bigint;pid text:='987654321012345678901234567890';
begin
 insert into auth.users(id) values(a),(u);
 insert into public.academy_requests(id,user_id,activity,activity_type,start_date,end_date,hours_declared,description) values(r,u,'Payment fixture','Test',current_date,current_date,1,'Fictitious rollback only');
 insert into public.academy_payment_releases(request_id,released_by,checkout_environment) values(r,a,'sandbox');
 begin perform public.academy_payment_provider_reconcile_v2(r,pid,'approved',1500,'BRL','test','production');raise exception 'TEST FAILED: environment accepted';exception when others then if sqlerrm<>'Ambiente do checkout divergente' then raise;end if;end;
 perform public.academy_payment_provider_reconcile_v2(r,pid,'approved',1500,'BRL','test','sandbox');
 select count(*) into n from public.academy_event_log where request_id=r and event_type='PAGAMENTO_CONFIRMADO';
 perform public.academy_payment_provider_reconcile_v2(r,pid,'approved',1500,'BRL','test','sandbox');
 if (select count(*) from public.academy_event_log where request_id=r and event_type='PAGAMENTO_CONFIRMADO')<>n then raise exception 'TEST FAILED: duplicate event';end if;
 begin perform public.academy_payment_provider_reconcile_v2(r,'987654321012345678901234567891','approved',1500,'BRL','test','sandbox');raise exception 'TEST FAILED: alternate payment overwrote';exception when others then if sqlerrm<>'Outro pagamento já vinculado ao protocolo' then raise;end if;end;
 perform public.academy_payment_provider_reconcile_v2(r,pid,'refunded',1500,'BRL','test','sandbox');
 if (select status from public.academy_certificates where request_id=r)<>'REVOGADO' then raise exception 'TEST FAILED: refund certificate';end if;
 perform public.academy_payment_provider_reconcile_v2(r,pid,'approved',1500,'BRL','test','sandbox');
 if (select payment_status from public.academy_payment_releases where request_id=r)<>'ESTORNADO' then raise exception 'TEST FAILED: stale event restored payment';end if;
end $$;
rollback;
