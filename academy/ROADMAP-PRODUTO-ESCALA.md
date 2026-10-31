# Protocolo Academy — Evolução para plataforma institucional
Data: 31/10/2026. Documento de controle técnico; nenhuma previsão de faturamento ou avaliação de mercado é garantida.

## Implementado e publicado nesta fase
- Busca dos próprios protocolos por texto/código no portal.
- Assistente guiado por relato: extração **heurística básica** de data e horas. Não é chatbot de IA conversacional; pede confirmação do estudante.
- Histórico complementar individual e exportação em HTML para impressão em PDF pelo navegador; não substitui documento institucional oficial.
- Perguntas frequentes junto ao portal, mais tabela `academy_help_articles` com conteúdo inicial.
- Feedback de satisfação de 1 a 5 após resultado de análise, armazenado com RLS por estudante.
- Painel de métricas gerenciais via `academy_admin_metrics`; não é dashboard analítico histórico completo.
- Estruturas SQL para tenants, membros, regras, eventos, participantes, integrações e sinais de inconsistência.
- Cadastro restrito ao SUPER_ADMIN de instituições **inativas** via RPC e painel administrativo. Nenhuma instituição recém-criada passa a acessar dados existentes.
- Todas as tabelas institucionais e de sinais permanecem com RLS habilitada e sem políticas de cliente, como bloqueio preventivo.
- Conferência de sintaxe dos arquivos modificados e dos IDs HTML.

## NÃO concluído — requisitos essenciais para produto multi-institucional seguro
1. Definir modelo de isolamento tenant para requests/evidências/pagamentos/certificados. Migrar esquema, aplicar políticas RLS e testar acesso cruzado com contas distintas. **Não ativar tenants antes disso.**
2. Criar gestão de equipe por tenant, papéis, convites e auditoria.
3. Criar interface e fluxos reais de regulamentos (limites por categoria, datas de vigência, exceções, aprovação).
4. Criar ingestão operacional de eventos por API/planilhas e reconciliação de participantes com consentimento.
5. Criar API versionada e documentada para sistemas acadêmicos, OAuth/credenciais de serviço, escopos, quotas e logs.
6. Criar suporte verificável a Open Badges 3.0 e W3C VC 2.0, emissão, assinatura, status/revogação e verificador independente. PDFs/QR atuais não equivalem a esses padrões.
7. Implementar chatbot conversacional de IA de verdade (intenções, perguntas graduais, confirmação, custo e privacidade), não só extração heurística.
8. Implementar validação inteligente de autenticidade com regras auditáveis, verificação de emissores/QR e revisão humana. Tabela `academy_document_signals` é apenas infraestrutura vazia.
9. Disponibilizar histórico gerado como PDF oficial com identidade institucional somente após revisão de conformidade; hoje há uma página para impressão.
10. Expandir ajuda contextual, acessibilidade WCAG 2.2 com testes assistivos, pesquisa de satisfação sem prompts intrusivos e analytics de conversão/abandono.
11. Configurar/testar OAuth Google, Drive Picker, IA documental, provedores Resend/WhatsApp Cloud API, agendador de notificações.
12. Homologar ponta a ponta Mercado Pago em sandbox, webhook, e-mail, WhatsApp, emissão/assinatura, código de validação, Storage e segurança.
13. Entrevistas com instituições, validação de disposição a pagar, suporte, SLA, pricing, termos contratuais, privacidade/LGPD e modelo comercial.

## Critérios mínimos de qualidade
- Não publicar operação comercial sem teste de integração completo e autorização explícita.
- Não promover dados de tenants inativos a clientes ativos sem políticas isoladas verificadas por testes automatizados.
- IA é assistiva e não aprova horas ou acusa fraude automaticamente.
- Não compartilhar comprovantes sensíveis nem chaves privadas em JavaScript público.
- A experiência de estudante deve ser testada em iOS/Android e redes lentas, inclusive acessibilidade.
