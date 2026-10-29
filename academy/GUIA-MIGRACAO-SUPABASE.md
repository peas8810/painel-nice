# Protocolo Academy — migração controlada para Supabase
Data: 29 de outubro de 2026

## Arquitetura adotada
- **GitHub Pages**: páginas públicas, portal e administração em `www.protocolo.me/academy/`.
- **Supabase Auth / PostgreSQL / Storage / Edge Functions**: backend operacional.
- **Google Apps Script / Sheets / Drive**: fonte legada preservada apenas para conferência/contingência; não registrar novos protocolos no legado.
- **Mercado Pago**: provedor de checkout, por API, não é fonte da autenticação do aluno.
- **Resend**: entrega de e-mails transacionais depois de configurar remetente/domínio.
- **ChatGPT**: ferramenta de desenvolvimento, não é necessária para a operação online.

## Migração histórica realizada e verificada
Dados encontrados nas 8 abas do Sheets `Protocolo Academy — Banco de Dados` foram preservados em `academy_archive.source_rows` no schema **não exposto** `academy_archive`, com hash por linha:
- ALUNOS: 2
- SOLICITACOES: 3
- EVIDENCIAS: 2
- VALIDACOES: 2
- PAGAMENTOS: 2
- CERTIFICADOS: 0
- AUDITORIA: 5
- CONFIGURACOES: 0

Índices de leitura administrativa no Supabase: 3 protocolos, 2 evidências, 2 pagamentos antigos. A migração histórica **não** converte pagamentos antigos em liquidados nem emite certificados.

Também copiamos os originais dos 2 arquivos do Drive para `academy_archive.binary_objects` (321508 bytes e 86 bytes), com SHA-256 calculado. O PDF de 321508 bytes coincide exatamente com o hash da planilha; o arquivo de homologação possui valor de hash `NAO_APLICAVEL` na origem e foi identificado como teste.

**Ainda falta uma operação:** entrar em `/academy/admin/` → Configurações → **Importar arquivos históricos do Drive**. Essa ação transfere do arquivo privado PostgreSQL para o bucket Storage privado `academy-legado`, verifica checksum e atualiza o caminho no índice de evidências. Até executá-la, o arquivo está preservado no banco, mas não em Storage.

## Funções Supabase implantadas
- `academy-import-legacy-files`: transfere com checksum para o Storage privado, apenas administrador.
- `academy-checkout`: cria checkout do Mercado Pago **somente com segredos de sandbox e protocolo aprovado/liberado**.
- `academy-mp-webhook`: recebe notificações, valida assinatura HMAC e consulta o pagamento no Mercado Pago; depois concilia valor, moeda, vendedor e pedido.
- `academy-send-emails`: envia mensagens da fila privada pelo Resend, somente com domínio verificado e credenciais.
- `academy-issue-certificate`: gera PDF com dois QR Codes, hash SHA-256 e assinatura HMAC, somente com pagamento confirmado e evidências validadas.
- `academy-verify`: consulta pública restrita a código de alta entropia, com validação da assinatura e situação do certificado, sem expor comprovantes brutos.

**Publicado não significa ativado:** as funções de cobrança, envio de e-mail e emissão falham em modo seguro até configurar segredos e homologar.

## Segredos exigidos — configurar em Supabase → Edge Functions → Secrets
Nunca adicionar valores no GitHub, JavaScript público ou mensagens de chat.
```text
MP_ACCESS_TOKEN                  = credencial de teste do Mercado Pago
MP_WEBHOOK_SECRET                = chave HMAC do webhook de teste
MP_COLLECTOR_ID                  = identificador do vendedor da conta de teste
ACADEMY_ENABLE_PAYMENTS          = sandbox
RESEND_API_KEY                   = chave privada da conta Resend
ACADEMY_EMAIL_FROM               = remetente do domínio previamente verificado (ex.: certificados@protocolo.me)
ACADEMY_SIGNING_SECRET           = segredo aleatório com pelo menos 32 caracteres, exclusivo do Academy
ACADEMY_ENABLE_ISSUANCE          = sandbox
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são normalmente fornecidos automaticamente pelo Supabase, inclusive para o formato de chaves legadas utilizado no código. Confira a existência em **Edge Functions → Secrets**, sem publicá-las.

URL do webhook de teste a cadastrar no Mercado Pago:
`https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-mp-webhook`

A integração de Checkout Pro utiliza a API de preferências já existente; o fornecedor passou a recomendar Orders API para novas integrações. Uma migração de API poderá ser planejada antes da produção.

## Como usar o painel
Acesse `https://www.protocolo.me/academy/admin/` com a conta principal autorizada.
1. **Protocolos**: analisar comprovantes privados e aprovar com horas verificadas.
2. **Liberar para pagamento**: grava autorização auditável.
3. **Criar cobrança**: tenta gerar checkout de sandbox e enviar convite. Se o serviço de e-mail não estiver configurado, a mensagem fica na fila, **não é enviada**.
4. **Financeiro**: a confirmação depende exclusivamente de notificação autenticada do Mercado Pago e consulta à API do provedor.
5. **Emitir após confirmação**: inicia geração do certificado quando há pagamento real confirmado em sandbox, certificado pendente e evidências aprovadas. Não emite diretamente ao liberar a cobrança.
6. **Certificados**: acompanha status e consulta código.
7. **Configurações**: confere migração e transfere arquivos históricos para Storage privado.

O aluno visualiza seus protocolos, faz upload autenticado de evidências, acompanha pagamento e pode baixar o PDF (URL temporária) quando emitido. A página `/academy/validar/` consulta autenticidade do código e relatório sanitizado.

## Testes obrigatórios antes da mudança para produção
- [ ] Novo estudante: cadastro, confirmação de e-mail, login e recuperação.
- [ ] Duas contas diferentes: aluno B não acessa dados e comprovantes de A.
- [ ] Upload PDF/JPG/PNG, arquivo inválido/grande, validação individual, correção documental.
- [ ] Tentativa de aprovação sem comprovantes, com pendências, sem horas válidas (deve bloquear).
- [ ] Aprovação e cobrança sandbox no valor **R$ 15,00**; verificar retorno de erro e duplicidade.
- [ ] Webhook válido/forjado, pagamento pendente/aprovado/estornado, valor e vendedor divergentes.
- [ ] Disparo real de e-mail de teste e tratamento de erro do provedor; domínio remetente verificado.
- [ ] Emissão PDF após pagamento confirmado e impedimento antes; QR 1 autenticidade, QR 2 relatório, download privado.
- [ ] Revogação após estorno e validação pública retornando status revogado.
- [ ] Migração: 8 abas reconciliadas, 2 PDFs arquivados, 2 objetos transferidos para Storage, permissões de acesso ao histórico.
- [ ] Auditoria, políticas legais definitivas, suporte, contestação, retenção e transferência internacional de dados (Supabase us-east-1).

## Regras e limites
- Não apagar o Apps Script, a planilha ou os PDFs do Google Drive até concluir a conferência de integridade e os testes de recuperação.
- Não passar para produção mudando apenas uma flag; token e webhook de produção exigem testes separados e revisão de código.
- Os PDFs gerados pela nova função não substituem retroativamente certificados eventualmente emitidos por outros sistemas.
- **Segunda via gratuita e terceira via R$ 50 ainda não estão automatizadas no backend Supabase**. Esse requisito exige modelagem de reemissão e conciliação específica antes da venda dessa modalidade.
- Cobrança e emissão ainda não estão habilitadas comercialmente.
