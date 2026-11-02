begin;
do $$
declare u uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); r jsonb; denied boolean:=false;
begin
 insert into auth.users(id,aud,role) values(u,'authenticated','authenticated');
 if has_table_privilege('anon','public.academy_chat_events','SELECT') or has_table_privilege('authenticated','public.academy_chat_links','SELECT') or has_function_privilege('authenticated','public.academy_chat_begin(uuid,text,text,text,uuid)','EXECUTE') then raise exception 'Private chat exposed'; end if;
 r:=public.academy_chat_begin(u,'test1','web','Novo pedido',l);
 begin perform public.academy_chat_begin(u,'test2','web','Outro',gen_random_uuid()); exception when others then denied:=sqlerrm='BUSY'; end;
 if not denied then raise exception 'Concurrent turn allowed'; end if;
 perform public.academy_chat_finish(u,'test1',l,'{"step":0}','{"text":"Qual o nome?"}');
 r:=public.academy_chat_begin(u,'test1','web','Novo pedido',gen_random_uuid());
 if r->'cached'->>'text'<>'Qual o nome?' then raise exception 'Replay failed'; end if;
 insert into public.academy_chat_links(user_id,token_hash,token_expires) values(u,'fixture-hash',now()+interval '10 minutes');
 if public.academy_chat_link_redeem('wrong','5511999990000') is not null then raise exception 'Invalid link accepted'; end if;
 if public.academy_chat_link_redeem('fixture-hash','5511999990000')<>u then raise exception 'Link failed'; end if;
 if public.academy_chat_link_redeem('fixture-hash','5511999990000') is not null then raise exception 'Link reused'; end if;
 if not public.academy_chat_delivery_claim('fixture-delivery') or public.academy_chat_delivery_claim('fixture-delivery') then raise exception 'Duplicate delivery lease'; end if;
end $$;
rollback;
