begin;
do $$
declare u uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); cid uuid; r jsonb; conv uuid; rev integer; denied boolean:=false;
begin
 insert into auth.users(id,email) values(u,'central-test-'||u||'@example.invalid'),(outsider,'central-test-'||outsider||'@example.invalid');
 insert into public.ujn_agents(user_id,service_id) values(u,'articlerun');
 cid:=public.ujn_contact(outsider,null);
 r:=public.ujn_ingest(cid,'articlerun','test-one','Olá',null);conv:=(r->'conversation'->>'id')::uuid;rev:=(r->'conversation'->>'revision')::integer;
 if public.ujn_access(u,'academy') then raise exception 'Cross-queue access';end if;
 begin perform public.ujn_operator_action(outsider,conv,'claim',rev);exception when others then denied:=true;end;
 if not denied then raise exception 'Unauthorized claim allowed';end if;
 perform public.ujn_operator_action(u,conv,'claim',rev);
 r:=public.ujn_bot_reply(conv,'test-one',rev,'Should not appear','{}','{}',false);
 if not (r->>'paused')::boolean then raise exception 'Bot not paused';end if;
 if exists(select 1 from public.ujn_messages where body='Should not appear') then raise exception 'Late bot message';end if;
 select revision into rev from public.ujn_conversations where id=conv;
 perform public.ujn_operator_action(u,conv,'reply',rev,'Resposta',null,'test-agent');
 perform public.ujn_operator_action(u,conv,'reply',rev,'Resposta',null,'test-agent');
 if (select count(*) from public.ujn_messages where event_key='test-agent')<>1 then raise exception 'Duplicate reply';end if;
 select revision into rev from public.ujn_conversations where id=conv;
 perform public.ujn_operator_action(u,conv,'transfer',rev,'','suporte');
 if public.ujn_access(u,'suporte') then raise exception 'Unexpected access after transfer';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'ujn_%' and c.relkind='r' and not c.relrowsecurity) then raise exception 'RLS missing';end if;
 if has_table_privilege('authenticated','public.ujn_messages','SELECT') then raise exception 'Browser table access';end if;
 if has_function_privilege('authenticated','public.ujn_channel_config(uuid)','EXECUTE') then raise exception 'Secret RPC exposed';end if;
end $$;
rollback;
