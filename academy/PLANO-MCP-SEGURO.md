# Marcos da integração de IA — Protocolo Academy

## Etapa 1 — MCP somente leitura
- [x] Publicar `academy-mcp` no Supabase como Edge Function com `verify_jwt=true`.
- [x] Oferecer `academy_my_protocols`, `academy_my_certificates` e `academy_help`.
- [x] Usar JWT do usuário para consultar Supabase com RLS; não enviar service_role para clientes.
- [ ] Homologar uma chamada autenticada real, um usuário sem acesso e tentativas entre contas.
- [ ] Implementar servidor OAuth 2.1 com PKCE, discovery metadata e registro/consentimento adequados para conectar apps de terceiros.
- [ ] Confirmar compatibilidade MCP por cliente (ChatGPT, Claude e outros). A função é piloto técnico, não integração final.
- [ ] Verificar requisitos de Streamable HTTP, sessões, cabeçalhos e versionamento dos clientes.

## Revisão da Etapa 1
- Critério de segurança adotado: consulta apenas. Nenhuma ferramenta para emissão, cobrança, exclusão ou aprovação.
- Limitação: em sua forma atual, o cliente precisaria obter um JWT individual da sessão Academy, o que não constitui uma experiência segura de conexão para usuários finais. Não pedir ao estudante que copie tokens para chats.
- Inovação sugerida para a próxima revisão: painel “Aplicativos conectados” no perfil, com escopos, expiração e revogação de cada consentimento.

## Ordem de execução
1. Homologar consultas e OAuth MCP completo.
2. Preparar protocolo por IA com revisão explícita e registros de auditoria.
3. Conectar documentos ao protocolo apenas via autorização do titular e upload privado.
4. Concluir dispatch automático e confirmação de e-mail/WhatsApp.
5. Homologar pagamentos sandbox, emissão e validação.
6. Testar mobile e RLS entre estudantes/instituições.
7. Operação comercial somente após critérios de segurança e qualidade aprovados.


## Marco 2 — Central de aplicativos conectados (31/10/2026)
- [x] Registro privado por usuário `academy_connected_apps`, com provedor, permissões, validade e revogação.
- [x] Consulta no portal e botão de revogação via RPC com checagem de titularidade.
- [ ] Conexão OAuth externa funcional (PKCE, discovery, registro de cliente, emissão e rotação de tokens).
- [ ] Garantir revogação efetiva de tokens já emitidos; atualmente não existem tokens MCP externos autorizados por este cadastro.
- [ ] Testar interface autenticada em dispositivos e isolamento entre contas.

**Revisão:** central segura como cadastro e interface, mas não se deve anunciar conexão ChatGPT/Claude operacional. **Próxima inovação proposta:** autorizações por finalidade e escopo, expiração curta configurável e histórico de acesso por aplicativo, com painel de consentimentos.
