# CORREÇÃO FINAL — Administração Academy (27/10/2026)

Os arquivos **completos, corrigidos e versionados** encontram-se em:
- [AcademyAdminUnico.html](apps-script/AcademyAdminUnico.html)
- [AcademyGestao.gs](apps-script/AcademyGestao.gs)

Não cole trechos HTML adicionais no aviso amarelo nem adicione scripts depois de `</html>`. O arquivo HTML contém uma única estrutura e uma única área de Solicitações com o painel de detalhes e decisão.

## Instalação no Apps Script
1. Abra o Apps Script privado **Protocolo Academy — Backend**.
2. No arquivo HTML **AcademyAdminUnico**, substitua **todo** o conteúdo pelo arquivo completo `AcademyAdminUnico.html` deste repositório. Não duplique etiquetas `<script>` nem elementos `<main>`.
3. No arquivo de código **AcademyGestao.gs**, substitua **todo** o conteúdo pela versão completa deste repositório.
4. Se você criou `AcademyProtocolosAdmin.gs` seguindo um exemplo anterior, **desative/remova esse arquivo do projeto** após conferir que ele não é referenciado em outro lugar. O projeto deve usar exclusivamente `academyGestaoDecidir` para análise e `academyGestaoAutorizarEmissao` para autorização.
5. Mantenha `AcademyEmissao.gs`, `AcademyIntegracao.gs`, `AcademyDashboard.gs` e `AcademyCore.gs` já instalados. Não crie outro `doGet`.
6. Salve, abra o teste `/dev?view=admin`, execute testes apenas com dados fictícios e atualize a implantação privada em **Gerenciar implantações → Editar → Nova versão**.

## Recursos
- Aba **Solicitações** → botão **Abrir** → detalhes do protocolo, evidências privadas, horas e análise
- Registrar **Aprovar**, **Reprovar**, **Pedir correção** e **Inconclusivo**, com justificativa
- **Verificar e autorizar emissão** (somente pedidos do Google Sheets com aprovação e confirmação financeira; registra autorização na AUDITORIA, não gera certificado)
- Aba **Tipos de atividade** com inclusão e edição; a integração com Supabase depende da conexão privada já documentada

## Controles de segurança
- A autorização usa `academyIntegracaoAuth_`, `academyEmissaoChecar_`, `LockService`, verifica existência de evidências e bloqueia duplicidade, pedidos apenas Supabase e certificados não demonstrativos preexistentes.
- A autorização grava evento `AUTORIZACAO_EMISSAO` em `AUDITORIA`, **não** adiciona uma linha artificial em `CERTIFICADOS`.
- Status de `PREFERENCE_CREATED`, `PENDING`, `ISENTO` e `LIBERADO_MANUAL` **não** equivalem a `PAID_CONFIRMED` e não satisfazem a checagem existente.
- O sistema ainda **não emite certificado comercial**; `AcademyEmissao.gs` gera somente prévia DEMO em ambiente sandbox.

## Testes de homologação
- [ ] Abrir solicitação com evidência e visualizar documento autorizado no Drive
- [ ] Registrar solicitação de correção com justificativa e verificar linhas de VALIDACOES e AUDITORIA
- [ ] Tentar autorizar sem pagamento confirmado → **deve falhar**
- [ ] Tentar autorizar pedido Supabase sem evidências → **deve falhar**
- [ ] Tentar autorizar pedido TESTE com evidência fictícia → **deve falhar**
- [ ] Em cenário controlado já conciliado e aprovado, confirmar criação **apenas de evento de auditoria**, não de certificado comercial
- [ ] Tentar segunda autorização → **deve falhar**
- [ ] Confirmar que o painel permanece privado
