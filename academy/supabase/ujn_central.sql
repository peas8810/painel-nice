-- UJN multi-service help desk. All tables and RPCs are server-only.
create table public.ujn_services(id text primary key,name text not null,welcome text not null,knowledge text not null default '',questions jsonb not null default '[]',version integer not null default 1,enabled boolean not null default true);
insert into public.ujn_services(id,name,welcome,knowledge,questions) values
('revistas','Revistas científicas','Informe a revista e como podemos ajudar.','A decisão editorial cabe à revista. Não há garantia de aprovação ou publicação.','[{"key":"journal","label":"Qual é a revista?"},{"key":"subject","label":"Qual é sua dúvida ou solicitação?"}]'),
('escrita','Auxílio à escrita','Vamos entender de que ajuda você precisa para escrever seu artigo.','O auxílio à escrita é independente da avaliação editorial e não garante publicação.','[{"key":"topic","label":"Qual é o tema do artigo?"},{"key":"help","label":"De que ajuda você precisa?"}]'),
('articlerun','Submissão de artigos','Vamos preparar os dados para encaminhar sua submissão.','A integração externa com ArticleRun ainda precisa ser configurada e homologada. Receber os dados na UJN não significa submeter à revista.','[{"key":"journal","label":"Para qual revista deseja enviar?"},{"key":"title","label":"Qual é o título do artigo?"},{"key":"authors","label":"Informe os autores, na ordem correta."},{"key":"email","label":"Qual é o e-mail do autor responsável?"}]'),
('academy','Certificados Academy','Posso ajudar com seu pedido, documentos, pagamento e certificado.','Aprovação humana obrigatória. Pagamentos e emissão obedecem aos controles existentes.','[]'),
('suporte','Pagamentos e suporte','Conte qual serviço você está usando e o que aconteceu.','Não envie senhas ou dados de cartão.','[{"key":"product","label":"De qual serviço você precisa de ajuda?"},{"key":"subject","label":"O que aconteceu?"}]');
create table public.ujn_agents(user_id uuid not null references auth.users(id) on delete cascade,service_id text not null references public.ujn_services(id),enabled boolean not null default true,primary key(user_id,service_id));
create table public.ujn_contacts(id uuid primary key default gen_random_uuid(),user_id uuid unique references auth.users(id) on delete set null,phone text unique,current_service text,created_at timestamptz not null default now(),check(user_id is not null or phone is not null));
create table public.ujn_channels(id uuid primary key default gen_random_uuid(),name text not null,phone_number_id text unique,graph_version text,enabled boolean not null default false,template_name text,created_at timestamptz not null default now());
create table public.ujn_conversations(id uuid primary key default gen_random_uuid(),contact_id uuid not null references public.ujn_contacts(id),service_id text not null references public.ujn_services(id),state text not null default 'BOT' check(state in ('BOT','WAITING','HUMAN','CLOSED')),assigned_to uuid references auth.users(id),revision integer not null default 0,bot_lease_until timestamptz,bot_state jsonb not null default '{}',flow_snapshot jsonb not null default '{}',channel_id uuid references public.ujn_channels(id),last_customer_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index ujn_conversations_queue on public.ujn_conversations(service_id,state,updated_at desc);
create index ujn_conversations_contact on public.ujn_conversations(contact_id,updated_at desc);
create table public.ujn_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.ujn_conversations(id) on delete cascade,event_key text unique,sender text not null check(sender in ('CUSTOMER','BOT','AGENT','NOTE','SYSTEM')),body text not null,actor_id uuid references auth.users(id),payload jsonb not null default '{}',created_at timestamptz not null default now());
create index ujn_messages_conversation on public.ujn_messages(conversation_id,created_at);
create table public.ujn_attachments(id uuid primary key,conversation_id uuid not null references public.ujn_conversations(id),contact_id uuid not null references public.ujn_contacts(id),file_path text unique not null,file_name text not null,mime text not null,created_at timestamptz not null default now());
create table public.ujn_audit(id bigint generated always as identity primary key,conversation_id uuid references public.ujn_conversations(id),actor_id uuid references auth.users(id),action text not null,detail jsonb not null default '{}',created_at timestamptz not null default now());
create table public.ujn_outbox(id uuid primary key default gen_random_uuid(),message_id uuid unique not null references public.ujn_messages(id),channel_id uuid not null references public.ujn_channels(id),phone text not null,state text not null default 'PENDING' check(state in ('PENDING','SENDING','SENT','FAILED','NEEDS_TEMPLATE')),attempts integer not null default 0,lease_until timestamptz,provider_id text,error text,created_at timestamptz not null default now());
create table public.ujn_connectors(id text primary key,name text not null,base_url text,mode text not null default 'DISABLED' check(mode in ('DISABLED','SANDBOX')),contract_note text not null default '',updated_at timestamptz not null default now());
insert into public.ujn_connectors(id,name,contract_note) values('articlerun','ArticleRun','Aguardando endereço correto, documentação da API e homologação. Nenhuma submissão externa automática habilitada.');
do $$ declare t text; begin foreach t in array array['ujn_services','ujn_agents','ujn_contacts','ujn_channels','ujn_conversations','ujn_messages','ujn_attachments','ujn_audit','ujn_outbox','ujn_connectors'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant usage,select on sequence public.ujn_audit_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ujn-atendimento','ujn-atendimento',false,10485760,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
create function public.ujn_super(p_user uuid) returns boolean language sql stable set search_path='' as $$ select exists(select 1 from public.academy_admin_members where user_id=p_user and enabled and role='SUPER_ADMIN'); $$;
create function public.ujn_access(p_user uuid,p_service text) returns boolean language sql stable set search_path='' as $$ select public.ujn_super(p_user) or exists(select 1 from public.ujn_agents where user_id=p_user and service_id=p_service and enabled); $$;
create function public.ujn_contact(p_user uuid default null,p_phone text default null) returns uuid language plpgsql set search_path='' as $$
declare c uuid; oldid uuid;
begin
 if p_user is null and (p_phone is null or p_phone !~ '^[0-9]{8,15}$') then raise exception 'Identidade inválida'; end if;
 perform pg_advisory_xact_lock(hashtext(coalesce(p_user::text,p_phone)));
 if p_user is not null then
  select id into c from public.ujn_contacts where user_id=p_user;
  if c is null then insert into public.ujn_contacts(user_id) values(p_user) returning id into c;end if;
  if p_phone is not null then
   select id into oldid from public.ujn_contacts where phone=p_phone;
   if oldid is not null and oldid<>c then
    if exists(select 1 from public.ujn_contacts where id=oldid and user_id is not null and user_id<>p_user) then raise exception 'Número já vinculado';end if;
    update public.ujn_conversations set contact_id=c where contact_id=oldid;update public.ujn_attachments set contact_id=c where contact_id=oldid;delete from public.ujn_contacts where id=oldid;
   end if;
   update public.ujn_contacts set phone=p_phone where id=c;
  end if;
 else
  update public.ujn_contacts set phone=null where phone=p_phone and user_id is not null;
  insert into public.ujn_contacts(phone) values(p_phone) on conflict(phone) do nothing;
  select id into c from public.ujn_contacts where phone=p_phone;
 end if;return c;
end $$;
create function public.ujn_ingest(p_contact uuid,p_service text,p_event text,p_text text,p_channel uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare c public.ujn_conversations; m public.ujn_messages; flow jsonb;
begin
 if length(p_text)>4000 or length(p_event)>180 then raise exception 'Mensagem muito longa';end if;
 perform pg_advisory_xact_lock(hashtext(p_contact::text));
 select * into m from public.ujn_messages where event_key=p_event;
 if found then
  select * into c from public.ujn_conversations where id=m.conversation_id and contact_id=p_contact;
  if not found then raise exception 'Evento inválido';end if;
  if exists(select 1 from public.ujn_messages where event_key=p_event||':reply') or c.state<>'BOT' then return jsonb_build_object('conversation',to_jsonb(c),'duplicate',true,'reply',(select payload from public.ujn_messages where event_key=p_event||':reply'));end if;
  if c.bot_lease_until>now() then raise exception 'BUSY';end if;
  update public.ujn_conversations set bot_lease_until=now()+interval '90 seconds',revision=revision+1 where id=c.id returning * into c;return jsonb_build_object('conversation',to_jsonb(c),'duplicate',false);
 end if;
 if (select count(*) from public.ujn_messages msg join public.ujn_conversations cv on cv.id=msg.conversation_id where cv.contact_id=p_contact and msg.sender='CUSTOMER' and msg.created_at>now()-interval '1 hour')>=100 then raise exception 'RATE_LIMIT';end if;
 select to_jsonb(s) into flow from public.ujn_services s where id=p_service and enabled;if flow is null then raise exception 'Serviço indisponível';end if;
 select * into c from public.ujn_conversations where contact_id=p_contact and service_id=p_service and state<>'CLOSED' order by created_at desc limit 1 for update;
 if not found then insert into public.ujn_conversations(contact_id,service_id,flow_snapshot) values(p_contact,p_service,flow) returning * into c;end if;
 if c.state='BOT' and c.bot_lease_until>now() then raise exception 'BUSY';end if;
 insert into public.ujn_messages(conversation_id,event_key,sender,body) values(c.id,p_event,'CUSTOMER',p_text);
 update public.ujn_conversations set revision=revision+1,bot_lease_until=case when state='BOT' then now()+interval '90 seconds' else null end,last_customer_at=case when p_channel is not null then now() else last_customer_at end,updated_at=now(),channel_id=coalesce(p_channel,channel_id) where id=c.id returning * into c;
 return jsonb_build_object('conversation',to_jsonb(c),'duplicate',false);
end $$;
create function public.ujn_bot_reply(p_id uuid,p_event text,p_revision integer,p_text text,p_payload jsonb,p_state jsonb,p_handoff boolean default false) returns jsonb language plpgsql set search_path='' as $$
declare c public.ujn_conversations;m uuid;phone text;
begin
 select * into c from public.ujn_conversations where id=p_id for update;
 if c.state<>'BOT' or c.revision<>p_revision then return jsonb_build_object('paused',true);end if;
 insert into public.ujn_messages(conversation_id,event_key,sender,body,payload) values(p_id,p_event||':reply','BOT',p_text,p_payload) on conflict(event_key) do nothing returning id into m;
 if m is null then return jsonb_build_object('duplicate',true);end if;
 update public.ujn_conversations set bot_lease_until=null,bot_state=p_state,state=case when p_handoff then 'WAITING' else 'BOT' end,revision=revision+1,updated_at=now() where id=p_id;
 if p_handoff then insert into public.ujn_audit(conversation_id,action) values(p_id,'HUMAN_REQUESTED');end if;
 if c.channel_id is not null then select x.phone into phone from public.ujn_contacts x where x.id=c.contact_id;if phone is not null then insert into public.ujn_outbox(message_id,channel_id,phone) values(m,c.channel_id,phone);end if;end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.ujn_operator_action(p_user uuid,p_id uuid,p_action text,p_revision integer,p_text text default '',p_target text default null,p_event text default null) returns jsonb language plpgsql set search_path='' as $$
declare c public.ujn_conversations;m uuid;phone text;
begin
 select * into c from public.ujn_conversations where id=p_id for update;
 if not found or not public.ujn_access(p_user,c.service_id) then raise exception 'Acesso restrito';end if;
 if p_event is not null and exists(select 1 from public.ujn_messages where event_key=p_event and actor_id=p_user and conversation_id=p_id) then return jsonb_build_object('ok',true,'duplicate',true);end if;
 if c.revision<>p_revision then raise exception 'A conversa mudou. Atualize antes de continuar.';end if;
 if p_action='claim' then
  if c.state='CLOSED' or (c.assigned_to is not null and c.assigned_to<>p_user and not public.ujn_super(p_user)) then raise exception 'Conversa indisponível';end if;
  update public.ujn_conversations set state='HUMAN',assigned_to=p_user,bot_lease_until=null where id=p_id;
 elsif p_action='reply' then
  if c.state<>'HUMAN' or c.assigned_to<>p_user then raise exception 'Assuma o atendimento antes de responder';end if;
  if length(trim(p_text)) not between 1 and 4000 or p_event is null then raise exception 'Resposta inválida';end if;
  insert into public.ujn_messages(conversation_id,event_key,sender,body,actor_id,payload) values(p_id,p_event,'AGENT',trim(p_text),p_user,jsonb_build_object('text',trim(p_text))) returning id into m;
  if c.channel_id is not null then select x.phone into phone from public.ujn_contacts x where x.id=c.contact_id;if phone is not null then insert into public.ujn_outbox(message_id,channel_id,phone) values(m,c.channel_id,phone);end if;end if;
 elsif p_action='note' then
  if length(trim(p_text)) not between 1 and 2000 then raise exception 'Nota inválida';end if;
  insert into public.ujn_messages(conversation_id,event_key,sender,body,actor_id) values(p_id,p_event,'NOTE',trim(p_text),p_user);
 elsif p_action in ('transfer','resume','close') then
  if c.assigned_to is distinct from p_user and not public.ujn_super(p_user) then raise exception 'Somente responsável ou administrador';end if;
  if p_action='transfer' then
   if not exists(select 1 from public.ujn_services where id=p_target and enabled) then raise exception 'Setor inválido';end if;
   update public.ujn_conversations set service_id=p_target,state='WAITING',assigned_to=null,bot_state='{}',flow_snapshot=(select to_jsonb(s) from public.ujn_services s where id=p_target) where id=p_id;
  elsif p_action='resume' then update public.ujn_conversations set state='BOT',assigned_to=null where id=p_id;
  else update public.ujn_conversations set state='CLOSED',assigned_to=null where id=p_id;end if;
  insert into public.ujn_messages(conversation_id,sender,body) values(p_id,'SYSTEM',case p_action when 'transfer' then 'Seu atendimento foi transferido para o setor responsável.' when 'resume' then 'O assistente automático está disponível novamente.' else 'Atendimento encerrado. Você pode iniciar outra conversa quando precisar.' end);
 else raise exception 'Ação inválida';end if;
 update public.ujn_conversations set revision=revision+1,updated_at=now() where id=p_id;
 insert into public.ujn_audit(conversation_id,actor_id,action,detail) values(p_id,p_user,p_action,jsonb_build_object('target',p_target));return jsonb_build_object('ok',true);
end $$;
create function public.ujn_channel_config(p_id uuid) returns jsonb language sql set search_path='' as $$
 select to_jsonb(c)||jsonb_build_object('secrets',coalesce((select jsonb_object_agg(split_part(name,'.',4),decrypted_secret) from vault.decrypted_secrets where name like 'ujn.channel.'||c.id::text||'.%'),'{}')) from public.ujn_channels c where id=p_id;
$$;
create function public.ujn_channel_save(p_user uuid,p_id uuid,p_data jsonb,p_secrets jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=coalesce(p_id,gen_random_uuid());k text;v text;sid uuid;
begin
 if not public.ujn_super(p_user) then raise exception 'Acesso restrito';end if;
 if length(trim(coalesce(p_data->>'name',''))) not between 2 and 100 or coalesce(p_data->>'phone_number_id','') !~ '^[0-9]{5,30}$' or coalesce(p_data->>'graph_version','') !~ '^v[0-9]+\.[0-9]+$' then raise exception 'Preencha nome, ID do número e versão da API';end if;
 insert into public.ujn_channels(id,name,phone_number_id,graph_version,enabled,template_name) values(cid,trim(p_data->>'name'),p_data->>'phone_number_id',p_data->>'graph_version',false,nullif(p_data->>'template_name','')) on conflict(id) do update set name=excluded.name,phone_number_id=excluded.phone_number_id,graph_version=excluded.graph_version,template_name=excluded.template_name;
 for k,v in select * from jsonb_each_text(p_secrets) loop
  if k not in ('token','app_secret','verify_token') then raise exception 'Campo de credencial inválido';end if;
  if v<>'' then
   if length(v) not between 8 and 8192 then raise exception 'Credencial inválida';end if;
   select id into sid from vault.secrets where name='ujn.channel.'||cid::text||'.'||k;
   if sid is null then perform vault.create_secret(v,'ujn.channel.'||cid::text||'.'||k);else perform vault.update_secret(sid,v);end if;
  end if;
 end loop;
 if coalesce((p_data->>'enabled')::boolean,false) and (select count(*) from vault.secrets where name in ('ujn.channel.'||cid::text||'.token','ujn.channel.'||cid::text||'.app_secret','ujn.channel.'||cid::text||'.verify_token'))<>3 then raise exception 'Cadastre as três credenciais antes de ativar';end if;
 update public.ujn_channels set enabled=coalesce((p_data->>'enabled')::boolean,false) where id=cid;
 insert into public.ujn_audit(actor_id,action,detail) values(p_user,'CHANNEL_SAVED',jsonb_build_object('id',cid));return cid;
end $$;
create function public.ujn_outbox_claim(p_id uuid) returns jsonb language plpgsql set search_path='' as $$
declare o public.ujn_outbox;
begin
 select * into o from public.ujn_outbox where id=p_id for update;
 if not found or o.state='SENT' or o.lease_until>now() or o.attempts>=5 then return null;end if;
 update public.ujn_outbox set state='SENDING',attempts=attempts+1,lease_until=now()+interval '45 seconds' where id=p_id returning * into o;return to_jsonb(o);
end $$;
create function public.ujn_agent_save(p_user uuid,p_email text,p_service text,p_enabled boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not public.ujn_super(p_user) then raise exception 'Acesso restrito';end if;
 select id into uid from auth.users where lower(email)=lower(trim(p_email)) and deleted_at is null;
 if uid is null then raise exception 'Cadastre a conta antes de conceder acesso';end if;
 insert into public.ujn_agents(user_id,service_id,enabled) values(uid,p_service,p_enabled) on conflict(user_id,service_id) do update set enabled=excluded.enabled;
 insert into public.ujn_audit(actor_id,action,detail) values(p_user,'AGENT_SAVED',jsonb_build_object('user_id',uid,'service',p_service,'enabled',p_enabled));return uid;
end $$;
-- Explicit grants for service RPCs; none are callable by browser roles.
do $$ declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname = any(array['ujn_super','ujn_access','ujn_contact','ujn_ingest','ujn_bot_reply','ujn_operator_action','ujn_channel_config','ujn_channel_save','ujn_outbox_claim','ujn_agent_save']) loop execute 'revoke all on function '||r.sig||' from public,anon,authenticated';execute 'grant execute on function '||r.sig||' to service_role';end loop;end $$;
