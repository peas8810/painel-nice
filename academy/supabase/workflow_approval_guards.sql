CREATE OR REPLACE FUNCTION public.academy_admin_approve_request(p_id uuid, p_justification text, p_hours numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare st text; declared numeric;
begin
 if auth.uid() is null or not public.academy_is_admin() then raise exception 'Não autorizado'; end if;
 if length(trim(coalesce(p_justification,''))) not between 15 and 2000 then raise exception 'Justificativa insuficiente'; end if;
 if exists(select 1 from public.academy_workflow_instances where request_id=p_id and state<>'CONCLUIDO') then raise exception 'Conclua o workflow antes da decisão final'; end if;
 select status,hours_declared into st,declared from public.academy_requests where id=p_id for update;
 if not found or st not in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO') then raise exception 'Protocolo não pode ser aprovado'; end if;
 if p_hours is null or p_hours::text in ('NaN','Infinity','-Infinity') or p_hours<=0 or p_hours>declared then raise exception 'Horas verificadas inválidas'; end if;
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
 if auth.uid() is null or not public.academy_is_admin() then raise exception 'Acesso administrativo negado'; end if;
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

