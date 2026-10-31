# API Institucional do Protocolo Academy — v1 (homologação)

## Objetivo e estágio
Permitir que o ERP ou sistema acadêmico de uma instituição **encaminhe solicitações de emissão** e acompanhe sua situação, sem duplicar dados manualmente. Esta versão **não emite, assina, paga nem libera automaticamente um certificado**. A emissão comercial depende da vinculação à cadeia interna de análise, evidências, pagamento e assinatura. **Não anunciar como emissão automática pronta.**

## Endpoint HTTPS
Base: `https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-partner-api`

Autenticação: cabeçalho `x-academy-key: aca_live_...` (segredo criado pelo SUPER_ADMIN, visível uma vez). Use somente do servidor institucional, NUNCA de JavaScript no navegador ou aplicativo móvel. Guarde em gerenciador de segredos. Revoke/rotate em caso de vazamento.

Por padrão, instituições são cadastradas **inativas**, portanto as chamadas são recusadas até sua habilitação após testes de isolamento e homologação. No momento não há comando público de ativação. CORS não substitui autenticação.

### Criar solicitação (fila de análise)
`POST /v1/issuance-requests`

```bash
curl -X POST 'https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-partner-api/v1/issuance-requests' \
  -H 'Content-Type: application/json' \
  -H 'x-academy-key: SEU_SEGREDO' \
  -d '{
    "external_id": "curso-engenharia:aluno-918:event-182",
    "student_name": "Estudante Exemplo",
    "student_email": "aluno@instituicao.edu.br",
    "activity": "Semana de Engenharia",
    "hours": 12,
    "start_date": "2026-10-10",
    "end_date": "2026-10-12",
    "metadata": {"course": "Engenharia", "event": "182"}
  }'
```

Retorno de sucesso **202** (novo), ou **200** (mesma solicitação, idempotente):
```json
{"id":"uuid","external_id":"curso-engenharia:aluno-918:event-182","status":"RECEBIDA","created_at":"timestamp","idempotent":false,"message":"Recebido para análise. Nenhum certificado foi emitido."}
```

A chave `external_id` deve ser estável e única por instituição. Repetir com os mesmos dados retorna a mesma solicitação. Repetir com alterações de informações principais gera conflito e exige procedimento de correção controlado. Metadados devem ser estritamente necessários e ter até 4 KB. Não envie CPF, documentos ou dados sensíveis dentro dos metadados.

### Consultar situação
`GET /v1/issuance-requests/{id}`

```bash
curl 'https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-partner-api/v1/issuance-requests/UUID_DA_SOLICITACAO' \
 -H 'x-academy-key: SEU_SEGREDO'
```

Resposta exemplificativa:
```json
{"id":"uuid","external_id":"curso-engenharia:aluno-918:event-182","status":"RECEBIDA","certificate_code":null,"created_at":"timestamp","updated_at":"timestamp"}
```

A consulta é isolada pelo identificador da instituição da chave. Certificado emitido só deve ser indicado com registro interno verificado.

## Segurança
- Chaves aleatórias com 256 bits; armazenamento exclusivo do SHA-256 no banco.
- Escopos separados: `requests:create` e `requests:read`.
- Limite de até **60 chamadas por minuto por chave**; `429` ao atingir.
- O banco tem **RLS ativa e sem acesso direto** dos usuários públicos às tabelas de integração.
- Somente SUPER_ADMIN cria e revoga chaves; não há edição pública de permissões.
- Instituições inativas não conseguem acessar o endpoint.
- Respostas não incluem documentos pessoais ou dados de outros estudantes.
- Logs e auditoria, consentimento institucional, retenção, LGPD e isolamento entre tenants precisam ser formalizados antes de produção.

## Próximas versões para emissão integrada real
1. Vincular solicitação externa a aluno autenticado/identidade institucional verificada e a `academy_requests`.
2. Receber evidência com upload seguro ou declaração de origem institucional auditável; revisar regras de horas por instituição.
3. Exigir decisão administrativa, pagamento (se aplicável) e autorização antes de invocar serviço privado de emissão.
4. Assinatura, código verificador, arquivo PDF privado e link temporário de download.
5. Webhooks de status **assinados** e reenvio com backoff, evitando polling constante.
6. API de revogação, trilhas de auditoria, versionamento, SLA, cobrança por consumo e portal de desenvolvedores.

## Observações
Ativação da função Edge `academy-partner-api` não é sinônimo de serviço comercial liberado. Faça homologação com instituição piloto usando dados fictícios. Não cole chaves em tickets, e-mails ou chats.
