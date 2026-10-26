# Ativar autenticação de alunos — Protocolo Academy

## O que foi publicado
- `academy/assets/auth.js`: cadastro, confirmação por email, login, recuperação de senha, sessão, solicitação e consulta somente dos próprios registros.
- `academy/assets/auth-config.js`: URL e chave pública configuráveis; vazias inicialmente por segurança.
- `academy/supabase/001_auth_rls.sql`: tabelas e políticas de isolamento por usuário.
- `academy/portal/index.html`: cliente integrado, porém bloqueado até configurar o provedor.

## Instalação no painel Supabase
1. Crie um **projeto exclusivo do Academy** em https://supabase.com/dashboard.
2. Abra **SQL Editor** e execute o conteúdo de `academy/supabase/001_auth_rls.sql`.
3. Em **Authentication → Providers → Email**, habilite **Confirm Email**. Desative anonymous sign-ins, caso não sejam necessários.
4. Em **Authentication → URL Configuration**, configure:
   - Site URL: `https://www.protocolo.me/academy/portal/`
   - Redirect URL permitida: `https://www.protocolo.me/academy/portal/`
5. Configure envio SMTP próprio antes de convidar alunos reais; o e-mail padrão do provedor pode ser limitado. Ative proteções antiabuso/CAPTCHA conforme plano.
6. Copie a **Project URL** e a **publishable key / anon key** para `academy/assets/auth-config.js`. Estas são públicas por definição e estão protegidas pela RLS. **Jamais usar service_role ou secret key nesse arquivo**.
7. Faça novo commit; confirme acesso HTTPS e execução de testes com duas contas de email separadas.
8. O backend administrativo Google Apps Script permanece **privado**. A tabela `academy_requests` da Supabase não é sincronizada automaticamente com as abas do Google Sheets. É necessária uma ponte administrativa segura para triagem. NÃO permitir Apps Script administrativo público.

## Testes obrigatórios antes de habilitar para usuários reais
- [ ] Conta A cadastra-se e confirma email, faz login e cria solicitação; status ENVIADA.
- [ ] Conta B não acessa solicitação A por API direta; não altera dono.
- [ ] Usuário anônimo não consulta solicitação alguma.
- [ ] Usuário A não consegue alterar status, carga horária verificada nem excluir pedido.
- [ ] Recuperação de senha não revela se o email existe e permite definir uma nova senha.
- [ ] Logs não contêm senha nem tokens; RLS ativa e grants restritos.
- [ ] Testar rate limiting, CAPTCHA, confirmação de e-mail e e-mail transacional.
- [ ] Adaptar termos/privacidade jurídicos finais antes de coletar dados reais.
- [ ] Criar ponte segura e auditada para sincronização de pedidos/pareceres com o backend administrativo.

## Limitações existentes
Envio de arquivos por aluno, integração com Google Drive, reconciliação Mercado Pago e certificado definitivo permanecem pendentes. O formulário bloqueia arquivos selecionados e não encaminha senhas ou tokens para Apps Script. A publicação do código no GitHub não configura automaticamente um projeto Supabase.
