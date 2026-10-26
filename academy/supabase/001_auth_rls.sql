-- Protocolo Academy - autenticação individual e isolamento por RLS
-- Executar no SQL Editor de um projeto Supabase dedicado.
-- Sem service_role no navegador. Confirm Email deve estar habilitado.
create table if not exists public.academy_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 180),
  created_at timestamptz not null default now()
);
create table if not exists public.academy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity text not null check (char_length(activity) between 3 and 180),
  activity_type text not null check (char_length(activity_type) between 2 and 80),
  start_date date not null,
  end_date date not null,
  hours_declared numeric(8,2) not null check (hours_declared > 0 and hours_declared <= 1000),
  description text not null check (char_length(description) between 15 and 2000),
  status text not null default 'ENVIADA' check (status in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','APROVADO','REPROVADO','INCONCLUSIVO')),
  hours_verified numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_period check (end_date >= start_date)
);
create index if not exists academy_requests_owner_idx on public.academy_requests(user_id,created_at desc);
alter table public.academy_profiles enable row level security;
alter table public.academy_requests enable row level security;
revoke all on public.academy_profiles from anon,authenticated;
revoke all on public.academy_requests from anon,authenticated;
grant select,insert on public.academy_profiles to authenticated;
grant select,insert on public.academy_requests to authenticated;
drop policy if exists academy_profiles_select_self on public.academy_profiles;
create policy academy_profiles_select_self on public.academy_profiles for select to authenticated
 using ((select auth.uid()) = user_id);
drop policy if exists academy_profiles_insert_self on public.academy_profiles;
create policy academy_profiles_insert_self on public.academy_profiles for insert to authenticated
 with check ((select auth.uid()) = user_id);
drop policy if exists academy_requests_select_self on public.academy_requests;
create policy academy_requests_select_self on public.academy_requests for select to authenticated
 using ((select auth.uid()) = user_id);
drop policy if exists academy_requests_insert_self on public.academy_requests;
create policy academy_requests_insert_self on public.academy_requests for insert to authenticated
 with check ((select auth.uid()) = user_id and status='ENVIADA' and hours_verified is null);
-- Proteção extra: cliente autenticado não pode escolher campos internos em INSERT.
-- UPDATE/DELETE não são concedidos ao aluno e não há políticas dessas operações.
-- Revisões, pagamentos e certificados pertencem ao backend administrativo, não ao client.
