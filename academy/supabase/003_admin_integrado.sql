-- Protocolo Academy: administração integrada no domínio próprio
-- Instale e atribua administrador por auth.users.id, nunca por metadata editável.
create table if not exists public.academy_admin_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.academy_admin_members enable row level security;
revoke all on public.academy_admin_members from anon,authenticated;

create or replace function public.academy_is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
 select exists (
  select 1 from public.academy_admin_members am
  where am.user_id = (select auth.uid()) and am.enabled
 );
$$;
revoke all on function public.academy_is_admin() from public,anon;
grant execute on function public.academy_is_admin() to authenticated;

drop policy if exists academy_requests_admin_select on public.academy_requests;
create policy academy_requests_admin_select on public.academy_requests
 for select to authenticated using ((select public.academy_is_admin()));

-- Administração no portal consulta os pedidos com permissões RLS.
-- NÃO conceder UPDATE/DELETE ou acesso a documentos até implementar o
-- workflow de evidências e histórico de decisões em transação auditável.
-- A aprovação continua apenas no backend administrativo privado.

-- Depois que sua conta de admin estiver criada e confirmada em Authentication > Users,
-- copie o UUID dela e execute MANUALMENTE:
-- insert into public.academy_admin_members(user_id) values ('UUID-DA-CONTA-AQUI')
-- on conflict(user_id) do update set enabled=true;
