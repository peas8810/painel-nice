alter table public.academy_requests add column if not exists participants_count integer;
alter table public.academy_requests add column if not exists teaching_activity boolean;
alter table public.academy_requests add column if not exists policy_version text;
alter table public.academy_requests drop constraint academy_requests_hours_declared_check;
alter table public.academy_requests add constraint academy_requests_hours_declared_check check(hours_declared>=0 and hours_declared<=1000);
alter table public.academy_evidence add column if not exists category text check(category in ('PRESENCA','FOTOS','ARTES','CONTEUDO','OUTRO'));
create table public.academy_ai_reviews (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.academy_requests(id),
 snapshot text not null,model text not null,report text not null check(length(report) between 10 and 16000),
 requested_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
alter table public.academy_ai_reviews enable row level security;
revoke all on public.academy_ai_reviews from public,anon,authenticated;
grant all on public.academy_ai_reviews to service_role;
create index on public.academy_ai_reviews(request_id,created_at desc);
create or replace function public.academy_policy_snapshot(p_id uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object('activity',r.activity,'type',r.activity_type,'description',r.description,'hours',r.hours_declared,'start',r.start_date,'end',r.end_date,'participants',r.participants_count,'teaching',r.teaching_activity,'version',r.policy_version,'documents',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'path',e.file_path,'category',e.category) order by e.id) from public.academy_evidence e where e.request_id=r.id),'[]'::jsonb))::text) from public.academy_requests r where r.id=p_id;
$$;
revoke all on function public.academy_policy_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.academy_policy_snapshot(uuid) to service_role;
create or replace function public.academy_ujn_request_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or (new.activity,new.activity_type,new.description,new.hours_declared,new.start_date,new.end_date,new.participants_count,new.teaching_activity) is distinct from (old.activity,old.activity_type,old.description,old.hours_declared,old.start_date,old.end_date,old.participants_count,old.teaching_activity) then
  if new.hours_declared<0 or new.hours_declared>300 or new.hours_declared::text in ('NaN','Infinity','-Infinity') then raise exception 'Regulamento UJN: carga horária entre 0 e 300 horas'; end if;
  if new.participants_count is null or new.participants_count<2 or new.teaching_activity is distinct from true then raise exception 'Regulamento UJN: atividade de ensino e pelo menos duas pessoas'; end if;
  if tg_op='UPDATE' and old.status in ('APROVADO','CANCELADA') then raise exception 'Solicite correção formal do protocolo encerrado'; end if;
  new.policy_version:='UJN-2026-11-02';
 end if;
 if new.status='APROVADO' and (tg_op='INSERT' or old.status<>'APROVADO') then
  if new.participants_count is null or new.participants_count<2 or new.teaching_activity is distinct from true or new.hours_declared>300 or new.hours_verified is null or new.hours_verified<0 or new.hours_verified>least(new.hours_declared,300) then raise exception 'Complete os dados exigidos pelo regulamento UJN'; end if;
  if (select count(distinct category) from public.academy_evidence where request_id=new.id and review_status='VALIDADO' and category in ('PRESENCA','FOTOS','ARTES','CONTEUDO'))<>4 then raise exception 'Valide lista de presença, fotos, artes e conteúdo ensinado'; end if;
  if not exists(select 1 from public.academy_ai_reviews a where a.request_id=new.id and a.snapshot=public.academy_policy_snapshot(new.id)) then raise exception 'Realize a análise preliminar por IA dos dados e documentos atuais'; end if;
 end if;
 return new;
end $$;
revoke all on function public.academy_ujn_request_guard() from public,anon,authenticated;
create trigger academy_ujn_request_guard before insert or update on public.academy_requests for each row execute function public.academy_ujn_request_guard();
-- Atomic edit: preserve the existing ownership/status/evidence guards.
create or replace function public.academy_student_policy_edit(p_id uuid,p_activity text,p_activity_type text,p_start_date date,p_end_date date,p_hours numeric,p_description text,p_participants integer,p_teaching boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.academy_requests;
begin
 if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
 select * into r from public.academy_requests where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Protocolo não encontrado'; end if;
 if r.status not in ('ENVIADA','EM_ANALISE','PENDENTE_DOCUMENTOS','INCONCLUSIVO') or exists(select 1 from public.academy_payment_releases where request_id=p_id) or exists(select 1 from public.academy_approvals where request_id=p_id) or exists(select 1 from public.academy_certificates where request_id=p_id) or exists(select 1 from public.academy_evidence where request_id=p_id and review_status='VALIDADO') then raise exception 'Solicite correção formal à administração'; end if;
 update public.academy_requests set activity=trim(p_activity),activity_type=trim(p_activity_type),start_date=p_start_date,end_date=p_end_date,hours_declared=p_hours,description=trim(p_description),participants_count=p_participants,teaching_activity=p_teaching,status='EM_ANALISE',updated_at=now() where id=p_id;
 insert into public.academy_event_log(request_id,event_type,actor_id,metadata) values(p_id,'PROTOCOLO_EDITADO',auth.uid(),jsonb_build_object('policy','UJN-2026-11-02'));
end $$;
revoke all on function public.academy_student_policy_edit(uuid,text,text,date,date,numeric,text,integer,boolean) from public,anon;
grant execute on function public.academy_student_policy_edit(uuid,text,text,date,date,numeric,text,integer,boolean) to authenticated;
-- Signed-in reviewer access only; returns current report and whether its snapshot is still current.
create or replace function public.academy_ai_review_get(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.academy_can_review(p_id) then raise exception 'Acesso restrito'; end if;
 return (select jsonb_build_object('id',a.id,'report',a.report,'model',a.model,'created_at',a.created_at,'current',a.snapshot=public.academy_policy_snapshot(p_id)) from public.academy_ai_reviews a where a.request_id=p_id order by a.created_at desc limit 1);
end $$;
revoke all on function public.academy_ai_review_get(uuid) from public,anon;
grant execute on function public.academy_ai_review_get(uuid) to authenticated;
-- Explicit institutional provenance; do not attribute user instructions to an arbitrary account.
alter table public.academy_regulation_clauses alter column created_by drop not null;
alter table public.academy_regulation_clauses add column if not exists approval_source text;
insert into public.academy_regulation_clauses(tenant_id,category,title,version,clause_text,source_url,max_hours,valid_from,published,approval_source)
select id,'Geral','Regulamento de certificação UJN','UJN-2026-11-02','São aceitos todos os tipos de cursos e ações com finalidade de ensino e no mínimo duas pessoas. A carga horária declarada e verificada deve estar entre 0 e 300 horas. Exigem-se lista de presença, fotos do evento, artes e conteúdo ensinado. A IA produz análise preliminar; a decisão exige validação humana. Correções, recursos e cancelamentos são registrados com histórico. Cancelamento invalida o certificado na consulta pelo QR Code. A certificação documental não garante reconhecimento por terceiros.','https://www.protocolo.me/academy/regulamento/',300,'2026-11-02',true,'Instrução expressa do responsável na conversa Academy de 02/11/2026'
from public.academy_tenants where slug='editora-ujn';
insert into public.academy_tenant_rules(tenant_id,category,max_hours,requires_evidence) select id,'Ensino UJN',300,true from public.academy_tenants where slug='editora-ujn' on conflict(tenant_id,category) do update set max_hours=300,requires_evidence=true;
-- One human validation step; AI is a prerequisite at the final approval guard.
with model as (insert into public.academy_workflow_templates(tenant_id,name,category,active) select id,'UJN — IA + validação humana v2','Ensino UJN',true from public.academy_tenants where slug='editora-ujn' returning id)
insert into public.academy_workflow_steps(template_id,step_order,label,assigned_role) select id,1,'Conferir análise da IA e validar documentos','MANAGER' from model;
update public.academy_tenants set active=true where slug='editora-ujn';

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
 if p_hours is null or p_hours::text in ('NaN','Infinity','-Infinity') or p_hours<0 or p_hours>declared then raise exception 'Horas verificadas inválidas'; end if;
 if not exists(select 1 from public.academy_evidence where request_id=p_id and review_status='VALIDADO') then raise exception 'Nenhum comprovante validado'; end if;
 if exists(select 1 from public.academy_evidence where request_id=p_id and review_status<>'VALIDADO') then raise exception 'Todos os comprovantes devem ser analisados e validados'; end if;
 update public.academy_requests set status='APROVADO',hours_verified=p_hours,updated_at=now() where id=p_id;
 -- A tabela histórica de pareceres atual só aceita 3 decisões; registra aprovação em uma tabela dedicada.
 insert into public.academy_approvals(request_id,admin_id,justification,hours_verified) values(p_id,auth.uid(),trim(p_justification),p_hours);
end $function$;
CREATE OR REPLACE FUNCTION public.academy_workflow_finalize(p_instance uuid, p_decision text, p_note text, p_hours numeric DEFAULT NULL::numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item public.academy_workflow_instances%rowtype; cap numeric;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 if p_decision is null or p_decision not in ('APROVADO','REPROVADO') then raise exception 'Decisão inválida'; end if;
 select * into item from public.academy_workflow_instances where id=p_instance for update;
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
