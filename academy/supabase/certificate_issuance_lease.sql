alter table public.academy_certificates add column if not exists issuance_token uuid;
alter table public.academy_certificates add column if not exists issuance_expires timestamptz;
alter table public.academy_certificates add column if not exists issuance_environment text;
create or replace function public.academy_certificate_claim(p_request uuid,p_environment text) returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 if p_environment is null or p_environment not in ('sandbox','production') then raise exception 'Ambiente inválido';end if;
 perform 1 from public.academy_requests where id=p_request and status='APROVADO' for update;
 if not found then raise exception 'Protocolo não aprovado';end if;
 if not exists(select 1 from public.academy_payment_releases where request_id=p_request and payment_status='PAGO_CONFIRMADO' and checkout_environment=p_environment and mp_payment_id is not null) then raise exception 'Pagamento incompatível com emissão';end if;
 update public.academy_certificates set issuance_token=token,issuance_expires=now()+interval '5 minutes',issuance_environment=p_environment where request_id=p_request and status='PENDENTE_EMISSAO' and (issuance_expires is null or issuance_expires<now());
 if not found then return null;end if;
 return token;
end $$;
revoke all on function public.academy_certificate_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_certificate_claim(uuid,text) to service_role;
create or replace function public.academy_certificate_finish(p_request uuid,p_token uuid,p_path text,p_sha text,p_signature text,p_email text) returns void language plpgsql security definer set search_path='' as $$
declare c public.academy_certificates;r public.academy_requests;
begin
 select * into r from public.academy_requests where id=p_request for update;
 if not found or r.status<>'APROVADO' then raise exception 'Protocolo não está aprovado';end if;
 select * into c from public.academy_certificates where request_id=p_request for update;
 if not found or c.status<>'PENDENTE_EMISSAO' or c.issuance_token is distinct from p_token or c.issuance_expires<now() then raise exception 'Reserva de emissão inválida ou expirada';end if;
 if not exists(select 1 from public.academy_payment_releases where request_id=p_request and payment_status='PAGO_CONFIRMADO' and checkout_environment=c.issuance_environment and mp_payment_id is not null) then raise exception 'Pagamento não confirmado';end if;
 if p_path is distinct from r.user_id::text||'/'||r.id::text||'/'||c.certificate_code||'.'||p_token::text||'.pdf' or coalesce(p_sha,'')!~'^[a-f0-9]{64}$' or coalesce(p_signature,'')!~'^[a-f0-9]{64}$' then raise exception 'Arquivo de emissão inválido';end if;
 update public.academy_certificates set status='EMITIDO',pdf_path=p_path,pdf_sha256=p_sha,signature_hmac=p_signature,issued_at=now(),issuance_token=null,issuance_expires=null where id=c.id;
 insert into public.academy_event_log(request_id,event_type,metadata) values(p_request,'CERTIFICADO_EMITIDO',jsonb_build_object('code',c.certificate_code,'pdf_sha256',p_sha));
 insert into public.academy_email_outbox(request_id,kind,recipient,status) values(p_request,'CERTIFICATE_READY',p_email,'PENDENTE') on conflict(request_id,kind) do nothing;
end $$;
revoke all on function public.academy_certificate_finish(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.academy_certificate_finish(uuid,uuid,text,text,text,text) to service_role;
