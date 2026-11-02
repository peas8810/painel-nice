create or replace function public.academy_reviewer_category(p_instance uuid,p_revision integer,p_evidence uuid,p_category text) returns void language plpgsql security definer set search_path='' as $$
declare i public.academy_workflow_instances;
begin
 select * into i from public.academy_workflow_instances where id=p_instance for update;
 if i.id is null or not public.academy_can_review(i.request_id) then raise exception 'Acesso restrito';end if;
 if i.revision<>p_revision then raise exception 'Análise mudou; atualize' using errcode='40001';end if;
 if i.state<>'EM_ANALISE' or p_category is null or p_category not in ('PRESENCA','FOTOS','ARTES','CONTEUDO','OUTRO') then raise exception 'Classificação inválida';end if;
 perform 1 from public.academy_requests where id=i.request_id and status in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO') for update;
 if not found then raise exception 'Protocolo encerrado';end if;
 update public.academy_evidence set category=p_category where id=p_evidence and request_id=i.request_id;
 if not found then raise exception 'Documento não pertence ao protocolo';end if;
 update public.academy_workflow_instances set revision=revision+1 where id=i.id;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(i.request_id,'DOCUMENTO_CLASSIFICADO',auth.uid(),jsonb_build_object('document_id',p_evidence,'category',p_category));
end $$;
revoke all on function public.academy_reviewer_category(uuid,integer,uuid,text) from public,anon;
grant execute on function public.academy_reviewer_category(uuid,integer,uuid,text) to authenticated;
create or replace function public.academy_reviewer_participants(p_instance uuid,p_revision integer,p_count integer,p_teaching boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare i public.academy_workflow_instances;
begin
 select * into i from public.academy_workflow_instances where id=p_instance for update;
 if i.id is null or not public.academy_can_review(i.request_id) then raise exception 'Acesso restrito';end if;
 if i.revision<>p_revision then raise exception 'Análise mudou; atualize' using errcode='40001';end if;
 if i.state<>'EM_ANALISE' or length(trim(coalesce(p_note,''))) not between 15 and 1500 then raise exception 'Registre a fundamentação documental';end if;
 update public.academy_requests set participants_count=p_count,teaching_activity=p_teaching,updated_at=now() where id=i.request_id and status in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO');
 if not found then raise exception 'Protocolo encerrado';end if;
 update public.academy_workflow_instances set revision=revision+1 where id=i.id;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(i.request_id,'PARTICIPACAO_CONFERIDA',auth.uid(),jsonb_build_object('participants',p_count,'teaching',p_teaching,'note',trim(p_note)));
end $$;
revoke all on function public.academy_reviewer_participants(uuid,integer,integer,boolean,text) from public,anon;
grant execute on function public.academy_reviewer_participants(uuid,integer,integer,boolean,text) to authenticated;
