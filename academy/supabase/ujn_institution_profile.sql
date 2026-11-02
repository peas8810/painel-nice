alter table public.academy_tenants add column if not exists legal_name text;
alter table public.academy_tenants add column if not exists cnpj text;
alter table public.academy_tenants add column if not exists legal_address text;
alter table public.academy_tenants add column if not exists support_email text;
alter table public.academy_tenants add column if not exists analysis_business_days integer check(analysis_business_days between 1 and 365);
alter table public.academy_tenants add column if not exists alert_email text;
update public.academy_tenants set legal_name='Editora Unified Journals Network - Ujn LTDA',cnpj='53.275.018/0001-62',legal_address='Rua Doutor Breno Fernandes da Silva, nº 333, Bairro Funcionários, Teófilo Otoni–MG, CEP 39803-500, Brasil',support_email='contato@ujn.ojsbr.com',alert_email='contato@ujn.ojsbr.com' where slug='editora-ujn';
create or replace function public.academy_ujn_profile() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('legal_name',legal_name,'cnpj',cnpj,'address',legal_address,'support_email',support_email,'analysis_business_days',analysis_business_days) from public.academy_tenants where slug='editora-ujn';
$$;
revoke all on function public.academy_ujn_profile() from public;
grant execute on function public.academy_ujn_profile() to anon,authenticated,service_role;
create or replace function public.academy_ujn_operation_save(p_days integer,p_alert_email text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito';end if;
 if p_alert_email is null or length(p_alert_email)>254 or p_alert_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'E-mail inválido';end if;
 update public.academy_tenants set analysis_business_days=p_days,alert_email=p_alert_email where slug='editora-ujn';
 insert into public.academy_event_log(event_type,actor_id,metadata) values('OPERACAO_UJN_CONFIGURADA',auth.uid(),jsonb_build_object('analysis_business_days',p_days,'alert_email',p_alert_email));
end $$;
revoke all on function public.academy_ujn_operation_save(integer,text) from public,anon;
grant execute on function public.academy_ujn_operation_save(integer,text) to authenticated;
