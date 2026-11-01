create or replace function public.academy_reviewer_evidence(p_instance uuid,p_revision int,p_evidence uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare i public.academy_workflow_instances;
begin
 select * into i from public.academy_workflow_instances where id=p_instance for update;
 if i.id is null or not public.academy_can_review(i.request_id) then raise exception 'Acesso restrito'; end if;
 if i.revision<>p_revision then raise exception 'Análise mudou; atualize' using errcode='40001'; end if;
 if i.state<>'EM_ANALISE' or p_status not in ('VALIDADO','REPROVADO') or p_status is null or length(trim(coalesce(p_note,''))) not between 15 and 1500 then raise exception 'Revisão inválida'; end if;
 if exists(select 1 from public.academy_requests where id=i.request_id and status in ('APROVADO','REPROVADO','CANCELADA')) then raise exception 'Protocolo encerrado'; end if;
 if p_status='VALIDADO' and not exists(
  select 1 from public.academy_evidence e join storage.objects o on o.bucket_id='academy-evidencias' and o.name=e.file_path
  where e.id=p_evidence and e.request_id=i.request_id and o.owner_id=e.user_id::text
  and o.metadata->>'mimetype' in ('application/pdf','image/jpeg','image/png')
  and coalesce((o.metadata->>'size')::bigint,0) between 1 and 10485760
 ) then raise exception 'Arquivo privado ausente ou metadados inválidos'; end if;
 update public.academy_evidence set review_status=p_status,reviewed_by=auth.uid(),reviewed_at=now() where id=p_evidence and request_id=i.request_id;
 if not found then raise exception 'Documento não pertence ao protocolo'; end if;
 update public.academy_workflow_instances set revision=revision+1 where id=i.id;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(i.request_id,'DOCUMENTO_REVISADO',auth.uid(),jsonb_build_object('evidence_id',p_evidence,'status',p_status,'note',trim(p_note)));
end $$;
