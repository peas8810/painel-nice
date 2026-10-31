create table public.academy_flow_sessions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 request_id uuid not null references public.academy_requests(id), token_hash text not null unique,
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.academy_document_integrity (
 id uuid primary key default gen_random_uuid(), evidence_id uuid not null references public.academy_evidence(id),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), size_bytes integer not null check(size_bytes>0),
 recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(evidence_id,sha256)
);
create table public.academy_document_history (
 id bigint generated always as identity primary key, evidence_id uuid not null references public.academy_evidence(id),
 actor_id uuid, action text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.academy_share_links (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 evidence_id uuid references public.academy_evidence(id), certificate_id uuid references public.academy_certificates(id),
 token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz,
 created_at timestamptz not null default now(), check(num_nonnulls(evidence_id,certificate_id)=1)
);
create table public.academy_regulation_clauses (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.academy_tenants(id),
 category text not null check(length(category) between 2 and 120), title text not null check(length(title) between 3 and 200),
 version text not null check(length(version) between 1 and 50), clause_text text not null check(length(clause_text) between 15 and 10000),
 source_url text not null check(source_url ~ '^https://'), max_hours numeric check(max_hours>0 and max_hours<=10000),
 valid_from date not null, valid_until date, published boolean not null default false,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 check(valid_until is null or valid_until>=valid_from)
);
create table public.academy_credential_keys (
 kid uuid primary key default gen_random_uuid(), private_jwk jsonb not null, public_jwk jsonb not null,
 active boolean not null default true, created_at timestamptz not null default now()
);
create unique index academy_credential_one_active_key on public.academy_credential_keys(active) where active;
create table public.academy_verifiable_credentials (
 id uuid primary key default gen_random_uuid(), certificate_id uuid not null unique references public.academy_certificates(id),
 owner_id uuid not null references auth.users(id), kid uuid not null references public.academy_credential_keys(kid),
 jwt text not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['academy_flow_sessions','academy_document_integrity','academy_document_history','academy_share_links','academy_regulation_clauses','academy_credential_keys','academy_verifiable_credentials'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.academy_document_history_id_seq to service_role;
create index on public.academy_flow_sessions(owner_id,created_at);
create index on public.academy_share_links(owner_id,created_at);
create index on public.academy_regulation_clauses(tenant_id,category);
create index on public.academy_document_history(evidence_id,id);
create or replace function public.academy_document_audit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.academy_document_history(evidence_id,actor_id,action,details)
 values(new.id,coalesce(auth.uid(),new.reviewed_by,new.user_id),case when tg_op='INSERT' then 'ENVIADO' else 'REVISAO' end,
 jsonb_build_object('status',new.review_status,'file_path',new.file_path));
 return new;
end $$;
revoke all on function public.academy_document_audit() from public,anon,authenticated;
create trigger academy_document_audit after insert or update of review_status,file_path on public.academy_evidence for each row execute function public.academy_document_audit();
