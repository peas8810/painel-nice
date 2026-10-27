-- Protocolo Academy: administrador principal + conta de homologação.
-- Requer execução prévia de 003_admin_integrado.sql.
-- A conta principal deve existir em Authentication > Users e estar confirmada.
-- Não remove permissões existentes nem cria usuários/senhas.
DO $$
DECLARE
  principal uuid;
BEGIN
  SELECT id INTO principal FROM auth.users
   WHERE lower(email)=lower('peas8810@gmail.com') AND email_confirmed_at IS NOT NULL
   LIMIT 1;
  IF principal IS NULL THEN
    RAISE EXCEPTION 'Conta peas8810@gmail.com não cadastrada ou e-mail não confirmado em Authentication > Users. Crie e confirme a conta primeiro.';
  END IF;
  INSERT INTO public.academy_admin_members(user_id,enabled)
  VALUES(principal,true)
  ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled;
END $$;

-- Resultado esperado: duas contas ativas (teste e principal).
SELECT u.email, m.enabled, m.created_at
FROM public.academy_admin_members m
JOIN auth.users u ON u.id=m.user_id
WHERE lower(u.email) IN ('peas8810@gmail.com','disciplinas.peas@gmail.com')
ORDER BY u.email;
