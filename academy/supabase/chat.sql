-- Shared website/WhatsApp conversation. Server-only access; authenticated identity
-- is resolved by the Edge Function, never accepted from message/model input.
create table public.academy_chat_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null default '{}', lease uuid, lease_until timestamptz,
 updated_at timestamptz not null default now()
);
create table public.academy_chat_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null, channel text not null check(channel in ('web','whatsapp')),
 input text not null, response jsonb, created_at timestamptz not null default now(),
 primary key(user_id,event_id)
);
create table public.academy_chat_links (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text unique, token_expires timestamptz, phone text unique,
 expires_at timestamptz, created_at timestamptz not null default now()
);
alter table public.academy_chat_sessions enable row level security;
alter table public.academy_chat_events enable row level security;
alter table public.academy_chat_links enable row level security;
revoke all on public.academy_chat_sessions,public.academy_chat_events,public.academy_chat_links from public,anon,authenticated;
grant all on public.academy_chat_sessions,public.academy_chat_events,public.academy_chat_links to service_role;
create index academy_chat_events_created on public.academy_chat_events(created_at);
-- Atomic lease serializes turns across devices; completed retries replay the result.
create function public.academy_chat_begin(p_user uuid,p_event text,p_channel text,p_input text,p_lease uuid) returns jsonb language plpgsql set search_path='' as $$
declare s public.academy_chat_sessions; e public.academy_chat_events;
begin
 if length(p_event)>160 or length(p_input)>2500 then raise exception 'Mensagem muito longa'; end if;
 insert into public.academy_chat_sessions(user_id) values(p_user) on conflict do nothing;
 select * into s from public.academy_chat_sessions where user_id=p_user for update;
 select * into e from public.academy_chat_events where user_id=p_user and event_id=p_event;
 if found and e.response is not null then return jsonb_build_object('cached',e.response); end if;
 if s.lease_until>now() then raise exception 'BUSY'; end if;
 if (select count(*) from public.academy_chat_events where user_id=p_user and created_at>now()-interval '1 hour')>=100 then raise exception 'RATE_LIMIT'; end if;
 insert into public.academy_chat_events(user_id,event_id,channel,input) values(p_user,p_event,p_channel,p_input) on conflict do nothing;
 update public.academy_chat_sessions set lease=p_lease,lease_until=now()+interval '90 seconds' where user_id=p_user;
 return jsonb_build_object('state',s.state);
end $$;
create function public.academy_chat_finish(p_user uuid,p_event text,p_lease uuid,p_state jsonb,p_response jsonb) returns void language plpgsql set search_path='' as $$
begin
 update public.academy_chat_sessions set state=p_state,lease=null,lease_until=null,updated_at=now() where user_id=p_user and lease=p_lease;
 if not found then raise exception 'STALE_LEASE'; end if;
 update public.academy_chat_events set response=p_response where user_id=p_user and event_id=p_event;
end $$;
create function public.academy_chat_link_redeem(p_hash text,p_phone text) returns uuid language plpgsql set search_path='' as $$
declare u uuid;
begin
 if p_phone !~ '^[0-9]{8,15}$' then raise exception 'Telefone inválido'; end if;
 update public.academy_chat_links set phone=p_phone,token_hash=null,token_expires=null,expires_at=now()+interval '30 days'
 where token_hash=p_hash and token_expires>now() returning user_id into u;
 return u;
end $$;
revoke all on function public.academy_chat_begin(uuid,text,text,text,uuid),public.academy_chat_finish(uuid,text,uuid,jsonb,jsonb),public.academy_chat_link_redeem(text,text) from public,anon,authenticated;
grant execute on function public.academy_chat_begin(uuid,text,text,text,uuid),public.academy_chat_finish(uuid,text,uuid,jsonb,jsonb),public.academy_chat_link_redeem(text,text) to service_role;
-- Run daily from an authenticated maintenance job (also run on chat startup).
create function public.academy_chat_prune() returns void language sql set search_path='' as $$
 delete from public.academy_chat_events where created_at<now()-interval '30 days';
 delete from public.academy_chat_sessions where updated_at<now()-interval '30 days' and (lease_until is null or lease_until<now());
 delete from public.academy_chat_links where coalesce(expires_at,token_expires)<now();
$$;
revoke all on function public.academy_chat_prune() from public,anon,authenticated;
grant execute on function public.academy_chat_prune() to service_role;
create table public.academy_chat_deliveries(id text primary key,lease_until timestamptz,sent_at timestamptz,created_at timestamptz not null default now());
alter table public.academy_chat_deliveries enable row level security;
revoke all on public.academy_chat_deliveries from public,anon,authenticated;
grant all on public.academy_chat_deliveries to service_role;
create function public.academy_chat_delivery_claim(p_id text) returns boolean language plpgsql set search_path='' as $$
declare d public.academy_chat_deliveries;
begin
 insert into public.academy_chat_deliveries(id) values(p_id) on conflict do nothing;
 select * into d from public.academy_chat_deliveries where id=p_id for update;
 if d.sent_at is not null or d.lease_until>now() then return false; end if;
 update public.academy_chat_deliveries set lease_until=now()+interval '30 seconds' where id=p_id;
 return true;
end $$;
revoke all on function public.academy_chat_delivery_claim(text) from public,anon,authenticated;
grant execute on function public.academy_chat_delivery_claim(text) to service_role;
create or replace function public.academy_chat_prune() returns void language sql set search_path='' as $$
 delete from public.academy_chat_events where created_at<now()-interval '30 days';
 delete from public.academy_chat_sessions where updated_at<now()-interval '30 days' and (lease_until is null or lease_until<now());
 delete from public.academy_chat_links where coalesce(expires_at,token_expires)<now();
 delete from public.academy_chat_deliveries where created_at<now()-interval '30 days';
$$;
-- Requires existing pg_cron extension. Hourly cleanup of records older than 30 days.
select cron.schedule('academy-chat-retention','17 * * * *','select public.academy_chat_prune();');
