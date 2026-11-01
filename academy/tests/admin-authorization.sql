begin;
do $$
declare outsider uuid:=gen_random_uuid(); f record; args text; rows_returned bigint; checked int:=0;
begin
 insert into auth.users(id) values(outsider);
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 for f in select oid,proname,proargtypes from pg_proc where pronamespace='public'::regnamespace and (proname like 'academy_admin_%' or proname like 'academy_superadmin_%') and proname<>'academy_admin_my_role' and has_function_privilege('authenticated',oid,'EXECUTE') loop
  select string_agg('null::'||format_type(t,null),',' order by ord) into args from unnest(f.proargtypes) with ordinality as a(t,ord);
  begin
   execute format('select count(*) from public.%I(%s)',f.proname,coalesce(args,'')) into rows_returned;
   if rows_returned>0 then raise exception 'TEST FAILED: account accessed %',f.proname;end if;
  exception when others then
   if sqlerrm like 'TEST FAILED:%' or sqlerrm !~* '^(Acesso|Não autorizado|Sem autorização|Somente|Autenticação|Administrative|Access)' then raise;end if;
  end;
  checked:=checked+1;
 end loop;
 if checked<15 then raise exception 'TEST FAILED: insufficient coverage %',checked;end if;
end $$;
select 'PASS: ordinary-account administrative authorization checks; all fixtures rolled back' as result;
rollback;
