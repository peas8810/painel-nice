# Protocolo Academy — Instalação da Gestão de Protocolos e Categorias

## O que foi implementado no repositório
- `academy/apps-script/AcademyGestao.gs`: funções privadas para listar, abrir, consultar evidências e registrar pareceres de protocolos, além de criar e renomear tipos de atividade.
- `academy/apps-script/AcademyAdminUnico.html`: botão **Abrir** para solicitações, visualização de detalhes/documentos, formulário de aprovação, reprovação, correção ou inconclusivo; aba **Tipos de atividade** com **Adicionar** e **Editar**.
- `academy/supabase/002_activity_types.sql`: catálogo dos tipos no Supabase, com leitura autenticada e alteração restrita a chave administrativa.
- `academy/assets/auth.js`: formulário do aluno obtém as categorias da tabela no Supabase, com opções predefinidas se a tabela ainda não estiver disponível.

## 1. Instalar no Apps Script (manual)
1. Abra o projeto privado **Protocolo Academy — Backend**.
2. Crie um arquivo de script `AcademyGestao.gs` e cole todo o conteúdo do arquivo do GitHub com mesmo nome.
3. **Substitua** o conteúdo de `AcademyAdminUnico.html` pela versão atualizada do GitHub.
4. Mantenha `AcademyIntegracao.gs`, `AcademyDashboard.gs`, `AcademyCore.gs` e `AcademyAdminUnico.gs` já instalados. Não crie uma segunda função `doGet`.
5. Teste o endereço de desenvolvimento `/dev?view=admin` com a conta autorizada. Execute depois **Gerenciar implantações → Nova versão**.

## 2. Instalar catálogo no Supabase
1. Abra o projeto Supabase Protocolo Academy e o **SQL Editor**.
2. Execute `academy/supabase/002_activity_types.sql`.
3. Verifique a tabela `public.academy_activity_types`, com as opções: Grupo de estudos, Projeto colaborativo, Ação comunitária, Oficina independente, Capacitação interna e Outra.
4. Quando estiver autenticado, o aluno verá essas opções no campo Tipo. Novas opções administradas no Apps Script serão sincronizadas **somente** depois de configurar a conexão privada abaixo.

## 3. Conectar a administração privada ao Supabase (necessário para mostrar os protocolos feitos pelos alunos)
No Apps Script → **Configurações do projeto → Propriedades do script**:
- `ACADEMY_SUPABASE_URL`: `https://jufnkfyvqgkrxsbctqqk.supabase.co`
- `ACADEMY_SUPABASE_SECRET_KEY`: chave administrativa **service_role LEGACY JWT** do projeto Supabase, obtida em **Project Settings → API Keys → Legacy API keys**. **Nunca** envie esta chave por mensagem, copie para GitHub, JS público ou a página do aluno.

AVISO: a chave pública `sb_publishable_` usada no portal NÃO serve para o backend administrativo. O código do Apps Script usa a chave service_role JWT (legado) tanto no cabeçalho `apikey` como no `Authorization`. Configuração incorreta causa falha de integração. A implantação deve ser privada e `ACADEMY_ADMIN_EMAILS` deve continuar exigida.

**Segurança:** a chave service_role ignora RLS. Somente o script privado autorizado pode usá-la. Revise e limite permissões do projeto, proteja propriedades do script e não exponha a implantação como "Qualquer pessoa".

## 4. Como usar
1. Abra Administração unificada → **Solicitações** → **Abrir** ao lado de um processo.
2. Confira atividade, período, descrição, horas declaradas e evidências (Drive exige permissão de acesso).
3. Selecione **Aprovar**, **Reprovar**, **Pedir correção** ou **Inconclusivo**, insira a justificativa e confirme. Não há emissão nem pagamento automático nesse processo.
4. Na aba **Tipos de atividade**, digite um novo tipo e clique **Adicionar**, ou clique **Editar** em uma categoria existente para renomeá-la. Pedidos anteriores mantêm o nome original por integridade histórica.

## Limitações importantes
- Pedidos do Google Sheets podem ser aprovados somente quando há evidências e os demais critérios de `academyRevisarSolicitacao` são atendidos.
- Pedidos do portal Supabase **ainda não têm upload de evidência**; por isso sua aprovação é bloqueada. É possível pedir correção, reprovar ou marcar inconclusivo, mantendo auditoria no Google Sheets.
- O painel de **Visão geral** e **Estatísticas** ainda consulta o Google Sheets; a lista de Solicitações é que consolida Sheets e Supabase quando configurado. Indicadores unificados exigirão integração posterior.
- O fluxo público de upload, pagamento, emissão e atualização de comentários/parecer para o aluno não está completo; não anunciar comercialização.
- A verificação em código confirma a existência das funções e a ligação da interface, mas a execução real no Apps Script e no Supabase precisa de teste após a instalação.
