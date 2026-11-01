CREATE OR REPLACE FUNCTION public.academy_payment_provider_reconcile(p_request uuid, p_payment_id text, p_status text, p_amount_cents integer, p_currency text, p_collector text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare row_release public.academy_payment_releases%rowtype; old_request uuid;
begin
 if current_user not in ('service_role','postgres') then raise exception 'Service-only reconciliation'; end if;
 if p_payment_id is null or p_payment_id !~ '^[0-9]{4,30}$' then raise exception 'ID de pagamento inválido'; end if;
 if p_status not in ('approved','refunded','charged_back','cancelled','rejected','pending','in_process') then raise exception 'Estado inválido'; end if;
 select * into row_release from public.academy_payment_releases where request_id=p_request for update;
 if not found then raise exception 'Protocolo não liberado para cobrança'; end if;
 if p_amount_cents<>row_release.amount_cents or p_currency<>row_release.currency then raise exception 'Valor ou moeda divergente'; end if;
 if row_release.mp_payment_id is not null and row_release.mp_payment_id<>p_payment_id then raise exception 'Outro pagamento já vinculado ao protocolo'; end if;
 if p_status='approved' and row_release.payment_status='PAGO_CONFIRMADO' and row_release.mp_payment_id=p_payment_id then return 'PAGO_CONFIRMADO'; end if;
 select request_id into old_request from public.academy_mp_transactions where mp_payment_id=p_payment_id;
 if old_request is not null and old_request<>p_request then raise exception 'Pagamento já associado a outro protocolo'; end if;
 insert into public.academy_mp_transactions(mp_payment_id,request_id,provider_status,amount_cents,currency,mp_collector_id)
 values(p_payment_id,p_request,p_status,p_amount_cents,p_currency,p_collector)
 on conflict(mp_payment_id) do update set provider_status=excluded.provider_status,processed_at=now();
 if p_status='approved' and row_release.payment_status<>'ESTORNADO' then
   update public.academy_payment_releases set payment_status='PAGO_CONFIRMADO',mp_payment_id=p_payment_id,paid_at=coalesce(paid_at,now()),provider_checked_at=now() where request_id=p_request;
   insert into public.academy_certificates(request_id) values(p_request) on conflict(request_id) do nothing;
   insert into public.academy_event_log(request_id,event_type,metadata) values(p_request,'PAGAMENTO_CONFIRMADO',jsonb_build_object('payment_id',p_payment_id));
   return 'PAGO_CONFIRMADO';
 elsif p_status in ('refunded','charged_back') then
   update public.academy_payment_releases set payment_status='ESTORNADO',mp_payment_id=p_payment_id,provider_checked_at=now() where request_id=p_request;
   update public.academy_certificates set status='REVOGADO',revoked_at=now() where request_id=p_request and status<>'REVOGADO';
   insert into public.academy_event_log(request_id,event_type,metadata) values(p_request,'PAGAMENTO_ESTORNADO',jsonb_build_object('payment_id',p_payment_id));
   return 'ESTORNADO';
 else
   update public.academy_payment_releases set provider_checked_at=now() where request_id=p_request;
   return 'SEM_MUDANCA';
 end if;
end $function$;

create or replace function public.academy_payment_provider_reconcile_v2(p_request uuid,p_payment_id text,p_status text,p_amount_cents integer,p_currency text,p_collector text,p_environment text) returns text language plpgsql security definer set search_path='' as $$
declare mode text;
begin
 select checkout_environment into mode from public.academy_payment_releases where request_id=p_request for update;
 if p_environment is null or p_environment not in ('sandbox','production') or mode is distinct from p_environment then raise exception 'Ambiente do checkout divergente'; end if;
 return public.academy_payment_provider_reconcile(p_request,p_payment_id,p_status,p_amount_cents,p_currency,p_collector);
end $$;
revoke all on function public.academy_payment_provider_reconcile_v2(uuid,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.academy_payment_provider_reconcile_v2(uuid,text,text,integer,text,text,text) to service_role;

