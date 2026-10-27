-- Categorias públicas de atividade, mantidas exclusivamente pelo backend administrativo.
create table if not exists public.academy_activity_types(
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(trim(name)) between 3 and 80),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.academy_activity_types enable row level security;
revoke all on public.academy_activity_types from anon,authenticated;
grant select on public.academy_activity_types to authenticated;
drop policy if exists academy_activity_types_visible on public.academy_activity_types;
create policy academy_activity_types_visible on public.academy_activity_types for select to authenticated using (active=true);
insert into public.academy_activity_types(name) values
('Grupo de estudos'),('Projeto colaborativo'),('Ação comunitária'),
('Oficina independente'),('Capacitação interna'),('Outra')
on conflict(name) do nothing;
