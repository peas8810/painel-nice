# Integração da administração ao site — Academy (27/10/2026)

## Problema diagnosticado
As solicitações do estudante são gravadas na tabela Supabase `public.academy_requests`; o painel Apps Script listava prioritariamente as planilhas Google. A screenshot de administração informa que a conexão privada com Supabase não está configurada, por isso as solicitações do estudante não aparecem ali.

## Solução já versionada
A página **https://www.protocolo.me/academy/admin/** agora tem autenticação Supabase própria e lista diretamente os protocolos no banco que recebe pedidos do aluno, sob uma política RLS administrativa. O painel Google Apps Script fica numa seção isolada como ferramenta legada temporária.

## Instalação obrigatória no Supabase
1. SQL Editor do projeto **Protocolo Academy** → execute **`academy/supabase/003_admin_integrado.sql`**.
2. No menu Authentication → Users, encontre a **conta com a qual o administrador fará login**. Pode ser uma conta de teste previamente cadastrada e confirmada no sistema, mas nunca use a conta de um aluno.
3. Copie o UUID (ID) daquela conta, não a senha nem um token.
4. Execute esta consulta no SQL Editor, substituindo o UUID apenas no Supabase:
   ```sql
   insert into public.academy_admin_members(user_id)
   values ('COLE-AQUI-UUID-DA-CONTA-ADMIN')
   on conflict(user_id) do update set enabled=true;
   ```
5. Abra `https://www.protocolo.me/academy/admin/`, entre com a conta designada e confira se aparecem os protocolos de teste criados pelo aluno.

## Segurança
O acesso não é concedido por email digitado, URL ou metadata editável. Somente UUIDs inseridos na tabela de autorização pelo administrador do banco têm acesso à leitura de todos os protocolos. A verificação é executada no Supabase por `academy_is_admin()`, e as linhas são protegidas pela política RLS no banco. Não coloque service_role, `sb_secret_...` ou outros segredos em arquivos publicados no GitHub.

## Limites atuais
- A página integrada lê protocolos **do Supabase**, e o painel Apps Script legado continua responsável pelos registros **do Google Sheets**.
- A aprovação, documentos e pagamentos não foram migrados para esse painel; não criar permissões de UPDATE para alunos/administradores via navegador antes de desenhar trilhas de auditoria no backend.
- Os dados entre Google Sheets e Supabase **não foram sincronizados bidirecionalmente**. Status administrativo no Sheets não aparece automaticamente no portal do aluno.
- O sistema não está apto a cobrança real ou emissão comercial.
- A página precisa de homologação com duas contas: administrador autorizado vê todos os pedidos, conta normal não acessa a lista completa nem os dados alheios.
