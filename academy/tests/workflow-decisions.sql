-- The old step-number endpoint is intentionally disabled. Revision-safe behavior
-- is exercised by workflow-launch.sql and launch-conditional.sql.
begin;
do $$
begin
 begin
  perform public.academy_workflow_decide(gen_random_uuid(),1,'AVANCAR','Legacy endpoint must not mutate state');
  raise exception 'TEST FAILED: obsolete endpoint accepted';
 exception when others then
  if sqlerrm<>'Atualize a página para usar a revisão atual do workflow.' then raise;end if;
 end;
end $$;
rollback;
