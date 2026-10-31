# Protocolo Academy — Marco 4: e-mail e WhatsApp transacionais

Atualizado em 31/10/2026. As funções foram implantadas, mas não há comprovação de entregas reais nem segredos externos configurados.

## Componentes técnicos
- `academy-dispatch-notifications` v4: aceita JWT de SUPER_ADMIN ou cabeçalho de agendador protegido por segredo `x-academy-cron-secret`.
- `academy-whatsapp-receipts` v1: valida `hub.verify_token` no GET e HMAC SHA-256 `X-Hub-Signature-256` no POST; recebe status Meta.
- `academy-resend-receipts` v1: verifica cabeçalhos Svix, HMAC SHA-256 do corpo bruto e janela de cinco minutos; recebe delivered, bounced, complained.
- SQL de recebimentos registra `ENTREGUE` e distingue `ENVIADO` (aceito) de entrega real. Erros de destino não são reenviados automaticamente.
- RPC `academy_admin_delivery_metrics` com restrição SUPER_ADMIN, exibida no painel administrativo.
- GitHub Actions `.github/workflows/academy-notifications.yml`: agendamento a cada cinco minutos, até 30 jobs por execução, apenas quando segredo configurado.

## Etapas que o administrador deve realizar em painéis de configuração
1. **Supabase Secrets:** configurar `ACADEMY_DISPATCH_CRON_SECRET` (valor aleatório longo), `RESEND_API_KEY`, `ACADEMY_EMAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_WHATSAPP_VERIFY_TOKEN` e `ACADEMY_WHATSAPP_TEMPLATE_PREFIX`.
2. **GitHub Actions secrets**, no repositório `peas8810/painel-nice`: definir `ACADEMY_DISPATCH_CRON_SECRET` com exatamente o mesmo valor utilizado em Supabase.
3. **Meta Business:** registrar webhook `https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-whatsapp-receipts`, verificar o token e assinar o campo `messages` do WhatsApp Business Account. Aprovar modelos com nomes `academy_protocolo_criado` etc. Os modelos usados pelo dispatcher enviam um parâmetro textual (o número do protocolo), que precisa corresponder ao modelo aprovado.
4. **Resend:** configurar/validar domínio de envio e registrar webhook `https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-resend-receipts` para `email.delivered`, `email.bounced`, `email.complained`; copiar o segredo assinado ao Supabase.
5. **GitHub:** conferir que o fluxo está habilitado em Actions e executar manualmente um teste inicial com protocolo não comercial, antes de depender do cron.
6. **Homologação:** com dois estudantes-teste e conta de admin, verificar consentimento WhatsApp, não envio após opt-out, fila, retries, e-mail recebido, mensagem Meta recebida, status `ENVIADO` antes do recibo e `ENTREGUE` após confirmação. Testar entrega e falha em ambos os canais.

Não inserir tokens em commits nem compartilhá-los em mensagens. A ação agendada do GitHub não executa envios quando o segredo obrigatório não está configurado.

## Critérios de conclusão do Marco 4
- Segredos e modelos aprovados configurados, webhooks validados e registros de recebimento assinados.
- Agendamento periódico comprovado sem intervenção manual.
- Testes de envio, entrega, falha, cancelamento de consentimento e isolamento de contas.
- Painel exibe métricas reais e a fila não repete envios para destinos definitivamente rejeitados.

## Revisão e inovação
Melhoria desta rodada: telemetria de entrega real por canal. Propostas seguintes:
- Preferência por canal e escalonamento seguro: e-mail primeiro; WhatsApp apenas para pendências críticas, respeitando consentimento.
- Reenvio orientado à ação somente quando o estudante não acessou a pendência, sem spam e com limites de frequência.
- Indicador de satisfação/tempo de resolução por instituição, com ocultação de dados pessoais e comparação por volume.
