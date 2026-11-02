# Entrega UJN — 2 de novembro de 2026

## Implementado e aplicado no Supabase

- Dados jurídicos UJN do anexo, CNPJ, endereço e contato. Prazo em dias úteis configurável e inicialmente vazio, pois não foi informado.
- Regras no servidor: ensino, mínimo de duas pessoas, horas de 0 a 300, quatro categorias obrigatórias de comprovantes validados. Dados anteriores podem ser conferidos pelo avaliador com justificativa e histórico.
- Regulamento versionado publicado para consulta com fonte e proveniência institucional. Modelo UJN v2 ativo com uma etapa humana; v1 continua desativado. A mesma pessoa autorizada pode conferir documentos e finalizar a decisão.
- Análise preliminar OpenAI dos arquivos privados, com relatório, modelo, solicitante e impressão dos dados analisados. Alterações invalidam o relatório para aprovação. Chave de API necessária; não houve chamada real ao modelo na homologação desta entrega.
- Correções e recursos com protocolo, acompanhamento e resposta. Cancelamento revoga certificado, credencial, selo e links. Reemissão corrigida e reembolso não são executados automaticamente ao abrir atendimento.
- Campos para configurações WhatsApp, Resend e IA no painel Operação, com criptografia Supabase Vault. Leitura de segredos exclusiva do servidor. Nenhum token foi inventado ou publicado.
- PDF com identificação jurídica UJN e emissão protegida por reserva temporária. Confirmação transacional revalida aprovação e pagamento; concorrência, expiração ou cancelamento impedem publicação indevida.
- SafeDraft preserva os novos campos; upload no portal e por QR recebe categoria documental.
- Termos e privacidade atualizados com dados e processos reais, sem declarar certificação internacional. Os pontos operacionais não homologados são explicitados nas páginas.
- Roteiro de operação, incidentes, chaves e recuperação em `ops/OPERACAO-UJN.md`; ferramenta de exportação cifrada de banco e Storage em `ops/backup.py`.

## Verificação executada

34 testes Node passaram: autenticação, escopos, Flow, compartilhamento, hash, assinatura, OTP, notificações, pagamentos, preflight, cofre e análise de IA com provedor simulado.

Testes SQL com dados sintéticos e rollback: regras UJN; zero hora; bloqueio de horas acima de 300, ausência de ensino e participante único; aprovação sem IA e relatório desatualizado; propriedade de atendimentos; cancelamento e revogação; cofre restrito; reserva de emissão; workflow, isolamento, condições, documentos e reconciliação idempotente de pagamento. Nenhuma cobrança ou mensagem real foi gerada por esses testes.

Manifesto de backup testado com arquivo sintético: aceita conteúdo íntegro e rejeita alteração. Nenhum backup de produção nem restauração isolada foi executado.

A tentativa de teste visual local não rodou porque o navegador Chromium não está instalado no runtime. Isso não equivale a homologação em computador, Android ou iPhone.

## Pendências reais para lançamento

| Item | Estado ao final da implementação |
|---|---|
| Dados oficiais | Cadastrados; falta definir prazo em dias úteis no painel. |
| Regulamento | Regras aplicadas e versão publicada; homologar uma solicitação real de teste. |
| Termos/privacidade | Atualizados; finalizar calendário de retenção, contratos de operadores e revisão jurídica. |
| Equipe/workflow | Modelo v2 ativo; cadastrar os humanos reais e atribuições pretendidas na Gestão. Não criamos identidades fictícias. |
| WhatsApp | Campos e integração preparados; faltam credenciais Meta, templates aprovados e testes reais. |
| E-mail | Remetente definido; faltam Resend/DNS/webhook e SMTP de Auth se ainda não configurado; testar entrega. |
| Mercado Pago | Integração preservada e testes sintéticos de idempotência passaram; teste do provedor real em sandbox ainda pendente. |
| Emissão | PDF e controles melhorados; produção bloqueada, aguardando pagamento real de sandbox e conferência do PDF emitido. |
| Selo | Implementado, com configuração no cofre; faltam jornada real, câmera, código, conferência humana e revogação. |
| Aparelhos | Novos campos integrados; faltam testes de dispositivos e interrupção real de conexão. |
| Credenciais | Assinatura e revogação existentes; governança documentada. Falta selecionar/testar carteiras e implantar custódia de produção. |
| Segurança | Autorização e cofre testados; permanece ativação de proteção contra senhas vazadas e revisão completa dos avisos. |
| Backup | Exportador cifrado preparado; faltam conexão de backup, custódia de chave, destino, agendamento e restauração isolada comprovada. |
| Operação | Fila de atendimentos e parâmetros criados; designar titular/substituto e testar entrega de alertas. |
| Lançamento | `academy_commercial_ready()` continua falso. Não houve liberação comercial nem aprovação automática de evidências. |

## O que fornecer para o e-mail

Acesso administrativo ao DNS de `ujn.ojsbr.com` para inserir os registros exatos do Resend; uma chave Resend com escopo adequado; segredo de assinatura do webhook; confirmação de que `contato@ujn.ojsbr.com` recebe mensagens. Inserir segredos diretamente em Operação, nunca no chat. Para e-mails de autenticação, fornecer no painel Supabase os parâmetros SMTP do provedor. Não é necessária a senha pessoal da caixa para a integração Resend.

## Referências operacionais

- Vault: https://supabase.com/docs/guides/database/vault
- Remetente/domínio: https://resend.com/docs/dashboard/domains/introduction
- Senhas vazadas: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Advisor SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- LGPD: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- CDC: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
