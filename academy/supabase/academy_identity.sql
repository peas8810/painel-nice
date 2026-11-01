-- Service-only records; no biometric matching or public photographs.
create table public.academy_identity_seals (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 certificate_id uuid not null references public.academy_certificates(id), snapshot jsonb not null,
 phone text, otp_hash text, otp_expires timestamptz, attempts int not null default 0,
 sent_at timestamptz, send_count int not null default 0, phone_confirmed_at timestamptz,
 selfie text check (length(selfie)<=1400000), selfie_sha256 text, selfie_expires_at timestamptz,
 confirmed_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
 review_result text check(review_result in ('CONFERIDA','RECUSADA')), review_note text,
 revoked_at timestamptz, created_at timestamptz not null default now()
);
create unique index academy_identity_one_active on public.academy_identity_seals(owner_id,certificate_id) where revoked_at is null;
create table public.academy_identity_events (
 id bigint generated always as identity primary key, seal_id uuid not null references public.academy_identity_seals(id),
 actor_id uuid, action text not null, created_at timestamptz not null default now()
);
alter table public.academy_identity_seals enable row level security;
alter table public.academy_identity_events enable row level security;
revoke all on public.academy_identity_seals,public.academy_identity_events from public,anon,authenticated;
grant all on public.academy_identity_seals,public.academy_identity_events to service_role;
grant usage,select on sequence public.academy_identity_events_id_seq to service_role;
-- Locks protect retries and limits against concurrent requests. Only server can call.
create function public.academy_identity_reserve(p_id uuid,p_phone text,p_hash text) returns boolean
language plpgsql set search_path=public as $$
declare s academy_identity_seals;
begin
 perform pg_advisory_xact_lock(hashtext(p_phone));
 select * into s from academy_identity_seals where id=p_id for update;
 if s.id is null or s.revoked_at is not null or s.confirmed_at is not null or s.phone_confirmed_at is not null then return false; end if;
 perform pg_advisory_xact_lock(hashtext(s.owner_id::text));
 if s.sent_at>now()-interval '60 seconds' or s.send_count>=5 then return false; end if;
 if (select coalesce(sum(send_count),0) from academy_identity_seals where (owner_id=s.owner_id or phone=p_phone) and sent_at>now()-interval '1 day')>=10 then return false; end if;
 update academy_identity_seals set phone=p_phone,otp_hash=p_hash,otp_expires=now()+interval '5 minutes',attempts=0,sent_at=now(),send_count=send_count+1 where id=p_id;
 insert into academy_identity_events(seal_id,actor_id,action) values(p_id,s.owner_id,'CODIGO_SOLICITADO');
 return true;
end $$;
create function public.academy_identity_check(p_id uuid,p_hash text) returns boolean
language plpgsql set search_path=public as $$
declare s academy_identity_seals;
begin
 select * into s from academy_identity_seals where id=p_id for update;
 if s.id is null or s.revoked_at is not null or s.otp_hash is null or s.otp_expires<=now() or s.attempts>=5 or s.phone_confirmed_at is not null then return false; end if;
 update academy_identity_seals set attempts=attempts+1 where id=p_id;
 if s.otp_hash<>p_hash then return false; end if;
 update academy_identity_seals set phone_confirmed_at=now(),otp_hash=null,otp_expires=null where id=p_id;
 insert into academy_identity_events(seal_id,actor_id,action) values(p_id,s.owner_id,'TELEFONE_CONFIRMADO');
 return true;
end $$;
revoke execute on function public.academy_identity_reserve(uuid,text,text),public.academy_identity_check(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_identity_reserve(uuid,text,text),public.academy_identity_check(uuid,text) to service_role;

create extension if not exists pg_cron;
select cron.schedule('academy-identity-retention','17 * * * *',$job$update public.academy_identity_seals set selfie=null where selfie is not null and selfie_expires_at<=now();$job$);
