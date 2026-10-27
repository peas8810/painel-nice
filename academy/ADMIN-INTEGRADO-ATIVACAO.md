# Administração integrada do Protocolo Academy — atualização 27/10/2026

## Já implantado
- Projeto Supabase `jufnkfyvqgkrxsbctqqk`: `academy_admin_decisions`, RPC auditada `academy_admin_review_request` para reprovação, pedido de correção ou inconclusivo; `academy_legacy_protocols` com RLS para administradores. Esses objetos foram aplicados ao banco.
- `academy/admin/index.html`: administração no mesmo domínio do portal, duas listas separadas (pedidos novos do Supabase e espelho de pedidos antigos do Sheets), formulário e histórico de decisões dos pedidos novos.
- `academy/apps-script/AcademySincronizacaoLegado.gs`: sincronização controlada do Google Sheets para a tabela espelho.

## Uma instalação manual necessária para exibir os protocolos antigos
1. Abra o projeto privado Google Apps Script **Protocolo Academy — Backend**.
2. Crie `AcademySincronizacaoLegado.gs` e cole todo o código disponível no GitHub.
3. Em Propriedades do script, confirme:
   - `ACADEMY_SUPABASE_URL=https://jufnkfyvqgkrxsbctqqk.supabase.co`
   - `ACADEMY_SUPABASE_SECRET_KEY` = credencial privada de serviço (NUNCA publicar no GitHub/site). A função foi escrita para a chave JWT `service_role` legado.
4. Selecione `academySincronizarProtocolosLegados`, execute, conceda autorizações e confira o resultado no log.
5. Abra `https://www.protocolo.me/academy/admin/` e atualize a página. A seção **Protocolos antigos · Google Sheets** passa a listar os registros sincronizados.
6. Só depois de validar dados e permissões considere criar um acionador agendado (por exemplo, a cada 15 minutos) para a função de sincronização.

## Limitações e segurança
- Os protocolos novos do Supabase são consultados diretamente, sem depender do Google Apps Script.
- As decisões dos pedidos novos aceitam apenas `PENDENTE_DOCUMENTOS`, `REPROVADO` e `INCONCLUSIVO`. A aprovação é bloqueada até haver upload de evidências verificável e processo documental auditado.
- Pedidos antigos continuam sendo analisados pelo backend privado. A tabela de espelho é **somente leitura** para o navegador e não migra anexos, pagamentos ou decisões editáveis.
- O envio de e-mail para pagamento e emissão definitiva continuam bloqueados até implementar e testar o ciclo completo.
- Não use a chave pública `sb_publishable_` como chave administrativa para a sincronização. Não compartilhe segredo `service_role`.
