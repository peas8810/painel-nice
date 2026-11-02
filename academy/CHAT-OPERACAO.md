# Assistente Academy — operação e ativação

## Entrega de 02/11/2026

O portal mantém suas telas e recebe a seção **Conversar com assistente**. O site e o WhatsApp usam o mesmo estado de conversa por conta. Código em `functions/academy-chat` e `functions/academy-chat-whatsapp`.

- Orientações com regras publicadas da UJN. Perguntas livres usam OpenAI somente após autorização no chat; sem chave, as opções guiadas continuam disponíveis. Limite existente de cinco consultas de IA/dia, compartilhado com outros recursos.
- Novo pedido em oito perguntas: nome, tipo, início, término, horas, participantes, ensino e descrição. Resumo e confirmação explícita antes do INSERT. As restrições institucionais do banco continuam obrigatórias. Não há aprovação autônoma.
- Lista e seleção dos últimos 30 pedidos da conta; nenhuma busca por dados de outra pessoa.
- Documentos classificados como presença, fotos, artes ou conteúdo. PDF/JPG/PNG até 10 MB, conferência da assinatura do arquivo e armazenamento privado. Não envia anexos ao modelo de IA.
- Pagamento consulta cobrança já liberada, sem criar cobranças ou confirmar por comprovante. Ambiente sandbox é identificado. Produção exige o checklist comercial aprovado.
- PDF entregue por link de cinco minutos somente quando há aprovação, pagamento confirmado, emissão e verificação pública válida. Revogação impede nova entrega. Um link assinado já emitido pode persistir até expirar.
- Encaminhamento à equipe pelo atendimento existente e contato@ujn.ojsbr.com.
- Áudio não é transcrito nesta entrega. O WhatsApp explica quais formatos aceita.

## Meta — ativação pendente

No painel de provedores existente, cadastrar `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_WHATSAPP_VERIFY_TOKEN` e `META_GRAPH_VERSION` (versão suportada no app Meta). Segredos ficam no Vault. Não inserir chaves em código, GitHub, chat de suporte ou frontend.

No app Meta, configurar callback:
`https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-chat-whatsapp`

Usar o mesmo verify token salvo no painel e assinar o campo `messages`. O endpoint recebe mensagens e mantém os registros de entrega do sistema de notificações existente. Não é necessário apagar o endpoint antigo; apontar o webhook para o novo quando a homologação estiver pronta.

A vinculação começa na conta autenticada, seção WhatsApp do chat. Um código de alta entropia, de uso único e validade de dez minutos, é enviado pelo usuário ao número oficial. O número terá acesso apenas àquela conta por 30 dias, revogável no portal ou com `Desconectar`. Não inferimos identidade por nome, e-mail digitado ou número encontrado no cadastro. Não substitui o selo de identidade.

Respostas livres são enviadas somente a mensagens recentes (margem de 23 horas). Notificações proativas continuam no dispatcher existente e dependem de templates aprovados e preferências. Nenhuma mensagem real foi disparada nesta implementação.

## IA

Configurar `OPENAI_API_KEY` e opcionalmente `ACADEMY_AI_MODEL` no painel de provedores. A autorização da pessoa fica no estado da conversa e pode ser retirada com `Desativar IA`. Chamadas utilizam `store:false`; enviar apenas pergunta e regulamento, sem histórico completo ou anexos. As políticas de retenção do provedor devem ser consideradas na revisão de privacidade.

## Proteções e limites

Tabelas de chat têm RLS e acesso somente ao servidor. Identidade web é validada no Auth; WhatsApp exige HMAC do webhook, número receptor configurado e vínculo vigente. Limite de 100 turnos por conta/hora; escrita serializada por lease; reentregas reutilizam resultado. Pedido e arquivo têm identificadores estáveis para não duplicar efeitos em retries. Timeout ambíguo de envio da Meta ainda pode causar uma resposta repetida; não cria outro pedido.

Histórico/rascunho inativo expiram após 30 dias. `academy-chat-retention` executa limpeza de hora em hora; monitorar `cron.job_run_details`. Pedidos e documentos oficiais seguem a política própria, não são apagados pela limpeza do chat. Links antigos de PDF no histórico podem ter expirado: selecionar Certificado para renovar.

Avisos RLS sem política nas quatro tabelas de chat são intencionais: nenhum acesso direto de `anon`/`authenticated`, apenas Edge Function. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Alertas anteriores de outras funções e proteção contra senhas vazadas não foram encerrados por esta entrega.

## Evidências e pendências reais

- Testes automatizados de conversa, consentimento, autorização, pagamentos, certificado, MIME, HMAC e replay em `tests/chat-*.test.mjs`.
- `tests/chat-database.sql`: transação com rollback, confirma bloqueio de acessos, concorrência, reentrega e vínculo de uso único.
- Interface testada com dados simulados em preview, sem pedido/cobrança real.
- Ainda requer homologação externa: credenciais Meta/IA, envio/recebimento real em número oficial, imagem/PDF real, falhas de rede, pagamento do provedor em sandbox, emissão e revogação reais, jornada com contas de teste em Android/iPhone.
- O chatbot não libera automaticamente a operação comercial nem torna integrações pendentes em homologadas.
