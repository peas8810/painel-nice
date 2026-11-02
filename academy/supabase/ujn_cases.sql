create table public.academy_service_cases(
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.academy_requests(id),owner_id uuid not null references auth.users(id),
 kind text not null check(kind in ('CORRECAO','RECURSO','CANCELAMENTO')),reason text not null check(length(reason) between 15 and 2000),
 status text not null default 'ABERTO' check(status in ('ABERTO','EM_ATENDIMENTO','RESPONDIDO','CANCELADO')),
 response text,responded_by uuid references auth.users(id),created_at timestamptz not null default now(),responded_at timestamptz
);
alter table public.academy_service_cases enable row level security;
revoke all on public.academy_service_cases from public,anon,authenticated;
grant all on public.academy_service_cases to service_role;
create index on public.academy_service_cases(owner_id,created_at desc);
create unique index academy_one_open_case on public.academy_service_cases(request_id,kind) where status in ('ABERTO','EM_ATENDIMENTO');
create or replace function public.academy_revoke_request_documents(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.academy_certificates set status='REVOGADO',revoked_at=coalesce(revoked_at,now()) where request_id=p_id;
 update public.academy_verifiable_credentials set revoked_at=coalesce(revoked_at,now()) where certificate_id in (select id from public.academy_certificates where request_id=p_id);
 update public.academy_identity_seals set revoked_at=coalesce(revoked_at,now()),selfie=null,phone=null,otp_hash=null where certificate_id in (select id from public.academy_certificates where request_id=p_id);
 update public.academy_share_links set revoked_at=coalesce(revoked_at,now()) where certificate_id in (select id from public.academy_certificates where request_id=p_id);
end $$;
revoke all on function public.academy_revoke_request_documents(uuid) from public,anon,authenticated;
create or replace function public.academy_case_open(p_request uuid,p_kind text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.academy_requests; result uuid;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 select * into r from public.academy_requests where id=p_request and user_id=auth.uid() for update;
 if not found then raise exception 'Protocolo não encontrado'; end if;
 if p_kind is null or p_kind not in ('CORRECAO','RECURSO','CANCELAMENTO') or length(trim(coalesce(p_reason,''))) not between 15 and 2000 then raise exception 'Informe o tipo e o motivo com 15 a 2000 caracteres'; end if;
 if r.status='CANCELADA' then raise exception 'Protocolo já cancelado'; end if;
 insert into public.academy_service_cases(request_id,owner_id,kind,reason,status) values(p_request,auth.uid(),p_kind,trim(p_reason),case when p_kind='CANCELAMENTO' then 'CANCELADO' else 'ABERTO' end) returning id into result;
 if p_kind='CANCELAMENTO' then
  update public.academy_requests set status='CANCELADA',updated_at=now() where id=p_request;
  perform public.academy_revoke_request_documents(p_request);
 end if;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(p_request,'ATENDIMENTO_'||p_kind,auth.uid(),jsonb_build_object('case_id',result));
 return result;
end $$;
revoke all on function public.academy_case_open(uuid,text,text) from public,anon;
grant execute on function public.academy_case_open(uuid,text,text) to authenticated;
create or replace function public.academy_case_list() returns setof public.academy_service_cases language sql stable security definer set search_path='' as $$
 select * from public.academy_service_cases where auth.uid() is not null and (owner_id=auth.uid() or public.academy_is_super_admin()) order by created_at desc limit 200;
$$;
revoke all on function public.academy_case_list() from public,anon;
grant execute on function public.academy_case_list() to authenticated;
create or replace function public.academy_case_respond(p_case uuid,p_status text,p_response text,p_revoke boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare c public.academy_service_cases;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 if p_status is null or p_status not in ('EM_ATENDIMENTO','RESPONDIDO') or length(trim(coalesce(p_response,''))) not between 15 and 2000 then raise exception 'Resposta inválida'; end if;
 select * into c from public.academy_service_cases where id=p_case for update;
 if not found then raise exception 'Atendimento não encontrado'; end if;
 perform 1 from public.academy_requests where id=c.request_id for update;
 if p_revoke then perform public.academy_revoke_request_documents(c.request_id); end if;
 update public.academy_service_cases set status=case when c.kind='CANCELAMENTO' then 'CANCELADO' else p_status end,response=trim(p_response),responded_by=auth.uid(),responded_at=now() where id=p_case;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(c.request_id,'ATENDIMENTO_RESPONDIDO',auth.uid(),jsonb_build_object('case_id',c.id,'documents_revoked',p_revoke));
end $$;
revoke all on function public.academy_case_respond(uuid,text,text,boolean) from public,anon;
grant execute on function public.academy_case_respond(uuid,text,text,boolean) to authenticated;
