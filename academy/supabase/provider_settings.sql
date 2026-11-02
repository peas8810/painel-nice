-- Credentials are encrypted by Supabase Vault; browser clients receive presence only.
create or replace function public.academy_provider_allowed(p_name text) returns boolean language sql immutable set search_path='' as $$
 select p_name = any(array['META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID','META_APP_SECRET','META_WHATSAPP_VERIFY_TOKEN','META_GRAPH_VERSION','ACADEMY_IDENTITY_TEMPLATE','ACADEMY_IDENTITY_OTP_SECRET','ACADEMY_WHATSAPP_TEMPLATE_PREFIX','RESEND_API_KEY','ACADEMY_EMAIL_FROM','RESEND_WEBHOOK_SECRET','OPENAI_API_KEY','ACADEMY_AI_MODEL']);
$$;
revoke all on function public.academy_provider_allowed(text) from public,anon,authenticated;
create or replace function public.academy_provider_save(p_name text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare k uuid;
begin
 if auth.uid() is null or not public.academy_is_super_admin() then raise exception 'Acesso restrito'; end if;
 if not coalesce(public.academy_provider_allowed(p_name),false) or length(trim(coalesce(p_value,''))) not between 1 and 8192 then raise exception 'Configuração inválida'; end if;
 if p_name='ACADEMY_IDENTITY_OTP_SECRET' and length(p_value)<32 then raise exception 'Segredo exige pelo menos 32 caracteres'; end if;
 if p_name='META_GRAPH_VERSION' and p_value !~ '^v[0-9]+\.[0-9]+$' then raise exception 'Versão da API inválida'; end if;
 if p_name='META_WHATSAPP_PHONE_NUMBER_ID' and p_value !~ '^[0-9]+$' then raise exception 'Identificador inválido'; end if;
 if p_name='ACADEMY_EMAIL_FROM' and p_value <> 'contato@ujn.ojsbr.com' then raise exception 'Remetente institucional esperado: contato@ujn.ojsbr.com'; end if;
 perform pg_advisory_xact_lock(hashtext('academy.provider.'||p_name));
 select id into k from vault.secrets where name='academy.provider.'||p_name;
 if k is null then perform vault.create_secret(trim(p_value),'academy.provider.'||p_name,'Academy provider configuration');
 else perform vault.update_secret(k,trim(p_value)); end if;
 insert into public.academy_event_log(event_type,actor_id,metadata) values('PROVEDOR_CONFIGURADO',auth.uid(),jsonb_build_object('name',p_name));
end $$;
revoke all on function public.academy_provider_save(text,text) from public,anon;
grant execute on function public.academy_provider_save(text,text) to authenticated;
create or replace function public.academy_provider_read() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(substr(name,18),decrypted_secret),'{}'::jsonb) from vault.decrypted_secrets where name like 'academy.provider.%' and public.academy_provider_allowed(substr(name,18));
$$;
revoke all on function public.academy_provider_read() from public,anon,authenticated;
grant execute on function public.academy_provider_read() to service_role;
