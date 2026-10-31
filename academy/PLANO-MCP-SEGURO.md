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


## Revisão de implementação de 31/10/2026 — Marco 2 e abertura do Marco 3
- [x] Registro de auditoria `academy_ai_access_log` com RLS e consulta própria via `academy_ai_access_history`.
- [x] MCP de leitura implantado como versão 2 (requere JWT individual, sem operações financeiras).
- [ ] **Marco 2 não homologado:** falta OAuth externo real (PKCE, descoberta OAuth, consentimento, escopos e revogação de tokens), testes de conectividade ChatGPT e Claude e testes entre contas.
- [x] `academy-prepare-request` implantada, versão 2, com autenticação, limite diário e retorno de campos sugeridos.
- [x] Assistente textual do aluno conectado à nova API; registro do protocolo ainda depende de revisão e confirmação pelo formulário.
- [ ] **Marco 3 não homologado:** configurar chave da OpenAI em Secrets e validar resposta com exemplos reais; testar limites e controle de custos; avaliar privacidade dos dados enviados.

### Ideias de inovação após Marco 2
Painel de trilha de cada ferramenta e consentimentos por ação, prazo e instituição. Exigir autorização nova para quaisquer ações mutáveis.

### Ideias de inovação após primeiro incremento do Marco 3
Assistente que explique somente os campos faltantes e ofereça uma estimativa de esforço, sem inventar horas ou certificar autenticidade. Monitorar taxa de conclusão e tempo real de preenchimento.
