CREATE OR REPLACE FUNCTION public.academy_admin_approve_request(p_id uuid, p_justification text, p_hours numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare st text; declared numeric;
begin
 if exists(select 1 from public.academy_requests where id=p_id and user_id=auth.uid()) then raise exception 'Não é permitido avaliar o próprio protocolo'; end if;
 if auth.uid() is null or not (public.academy_is_admin() or public.academy_can_review(p_id)) then raise exception 'Não autorizado'; end if;
 if length(trim(coalesce(p_justification,''))) not between 15 and 2000 then raise exception 'Justificativa insuficiente'; end if;
 if exists(select 1 from public.academy_workflow_instances where request_id=p_id and state<>'CONCLUIDO') then raise exception 'Conclua o workflow antes da decisão final'; end if;
 select status,hours_declared into st,declared from public.academy_requests where id=p_id for update;
 if not found or st not in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO') then raise exception 'Protocolo não pode ser aprovado'; end if;
 if p_hours is null or p_hours::text in ('NaN','Infinity','-Infinity') or p_hours<0 or p_hours>declared then raise exception 'Horas verificadas inválidas'; end if;
 if not exists(select 1 from public.academy_evidence where request_id=p_id and review_status='VALIDADO') then raise exception 'Nenhum comprovante validado'; end if;
 if exists(select 1 from public.academy_evidence where request_id=p_id and review_status<>'VALIDADO') then raise exception 'Todos os comprovantes devem ser analisados e validados'; end if;
 update public.academy_requests set status='APROVADO',hours_verified=p_hours,updated_at=now() where id=p_id;
 -- A tabela histórica de pareceres atual só aceita 3 decisões; registra aprovação em uma tabela dedicada.
 insert into public.academy_approvals(request_id,admin_id,justification,hours_verified) values(p_id,auth.uid(),trim(p_justification),p_hours);
end $function$;
CREATE OR REPLACE FUNCTION public.academy_admin_review_request(p_id uuid, p_decision text, p_justification text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare st text;
begin
 if exists(select 1 from public.academy_requests where id=p_id and user_id=auth.uid()) then raise exception 'Não é permitido avaliar o próprio protocolo'; end if;
 if auth.uid() is null or not (public.academy_is_admin() or public.academy_can_review(p_id)) then raise exception 'Acesso administrativo negado'; end if;
 if p_decision is null or p_decision not in ('PENDENTE_DOCUMENTOS','REPROVADO','INCONCLUSIVO') then raise exception 'Aprovação requer evidências verificadas e não está habilitada'; end if;
 if length(trim(coalesce(p_justification,''))) not between 15 and 2000 then raise exception 'Justificativa inválida'; end if;
 if p_decision='REPROVADO' then
 if exists(select 1 from public.academy_workflow_instances where request_id=p_id and state<>'CONCLUIDO') then raise exception 'Conclua o workflow antes da decisão final'; end if;
 end if;
 select status into st from public.academy_requests where id=p_id for update;
 if not found then raise exception 'Solicitação não encontrada'; end if;
 if st not in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO') then raise exception 'Decisão final já registrada'; end if;
 update public.academy_requests set status=p_decision,updated_at=now() where id=p_id;
 insert into public.academy_admin_decisions(request_id,admin_id,decision,justification)
 values(p_id,auth.uid(),p_decision,trim(p_justification));
end;
$function$;
CREATE OR REPLACE FUNCTION public.academy_reviewer_detail(p_instance uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.academy_workflow_instances; result jsonb;
begin
 select * into i from public.academy_workflow_instances where id=p_instance;
 if i.id is null or not public.academy_can_review(i.request_id) then raise exception 'Acesso restrito'; end if;
 select jsonb_build_object('instance',to_jsonb(i),'request',to_jsonb(r),'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.file_name,'path',e.file_path,'status',e.review_status,'category',e.category)) from public.academy_evidence e where e.request_id=r.id),'[]'::jsonb),'history',coalesce((select jsonb_agg(jsonb_build_object('step',h.step_order,'decision',h.decision,'note',h.note,'at',h.created_at) order by h.id) from public.academy_workflow_history h where h.instance_id=i.id),'[]'::jsonb)) into result from public.academy_requests r where r.id=i.request_id;
 return result;
end $function$;
CREATE OR REPLACE FUNCTION public.academy_workflow_finalize(p_instance uuid, p_decision text, p_note text, p_hours numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.academy_workflow_instances%rowtype; cap numeric;
begin
 if auth.uid() is null then raise exception 'Acesso restrito'; end if;
 if p_decision is null or p_decision not in ('APROVADO','REPROVADO') then raise exception 'Decisão inválida'; end if;
 select * into item from public.academy_workflow_instances where id=p_instance for update;
 if not public.academy_can_review(item.request_id) then raise exception 'Acesso restrito'; end if;
 if not found or item.state<>'CONCLUIDO' then raise exception 'Conclua todas as etapas antes da decisão acadêmica'; end if;
 if p_decision='APROVADO' then
  if p_hours is null or p_hours::text in ('NaN','Infinity','-Infinity') or p_hours<0 then raise exception 'Horas verificadas inválidas'; end if;
  select r.max_hours into cap from public.academy_tenant_rules r join public.academy_workflow_templates t on t.tenant_id=r.tenant_id and t.category=r.category where t.id=item.template_id;
  if cap is not null and p_hours>cap then raise exception 'Carga horária ultrapassa o limite institucional'; end if;
  perform public.academy_admin_approve_request(item.request_id,p_note,p_hours);
 else
  perform public.academy_admin_review_request(item.request_id,p_decision,p_note);
 end if;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(item.request_id,'WORKFLOW_DECISAO_FINAL',auth.uid(),jsonb_build_object('instance_id',item.id,'decision',p_decision));
end $function$;