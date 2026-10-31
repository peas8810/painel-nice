# Academy — contexto consolidado para continuidade
Atualizado em 31/10/2026.

## Alcance e evidência
Esta consolidação reúne trechos recuperados de conversas, documentação do repositório e verificações técnicas realizadas nesta conversa. Não é transcrição integral do chat original: a recuperação não disponibilizou todas as mensagens. Documentos antigos descrevem fases superadas e não devem ser interpretados como estado atual sem conferir código e serviços.

## Visão confirmada pela usuária
Plataforma independente de marcas, inspirada na simplicidade Apple/Uber, segurança Samsung, continuidade Xiaomi e automação institucional Microsoft. Referências de produto, sem alegação de equivalência ou certificação dessas marcas.
Layout branco, texto preto e consistência entre áreas, conforme histórico recuperado.

## Jornada e requisitos recuperados
Cadastro/login → atividade/protocolo → documentos → análise humana → correção ou aprovação → pagamento Mercado Pago → certificado PDF → validação pública.
- Documentos pelo dispositivo, câmera e Google Drive; assistência de IA sujeita à conferência.
- Dois QR Codes: autenticidade do certificado e relatório resumido.
- E-mail e WhatsApp nas movimentações, com consentimento e acompanhamento de entrega.
- SafeDraft, assistente em três passos, duplicação, pendências, mensagens, carteira e PWA.
- Instituições, equipes, regulamentos, workflow e integração com sistemas acadêmicos.
- Integrações MCP/IA e aplicativos conectados.
- Certificação de atividades anteriores consta no histórico recuperado; critérios completos de retroatividade não foram recuperados. Não inferir regras de emissão ou alterar datas de emissão.
- Segunda via gratuita/terceira via R$ 50 aparecem no guia de migração, mas a automação e a confirmação comercial atual permanecem pendentes.

## Arquitetura documentada
- Código: peas8810/painel-nice, pasta academy.
- Site: https://www.protocolo.me/academy/
- Supabase: jufnkfyvqgkrxsbctqqk (Auth, PostgreSQL, Storage e funções).
- Apps Script/Sheets/Drive: legado preservado para conferência.
- Mercado Pago, Resend e WhatsApp/Meta: integrações externas previstas e com componentes documentados; operação real exige configuração e teste.

## Inventário e nível de comprovação
| Área | Evidência disponível | Pendência |
| --- | --- | --- |
| Portal e autenticação | Código e documentação de cadastro/login/recuperação | Jornada autenticada entre contas e dispositivos |
| UX | Documentação de assistente, câmera, rascunho, SafeDraft, duplicação, pendências, mensagens, carteira, PWA | Teste móvel, conexão instável, acessibilidade e continuidade entre dispositivos |
| Documentos | Upload privado e revisão descritos; migração histórica documentada | Conferir importação de arquivos ao Storage e OAuth/Drive Picker |
| IA | Funções de sugestão documental e preparação de protocolo documentadas | Configuração e avaliação com exemplos reais; aprovação continua humana |
| Pagamentos | Checkout e webhook com conciliação documentados | Homologação Mercado Pago sandbox e critérios de produção |
| Certificados | Função de PDF, dois QR Codes, hash/assinatura e verificador documentados | Ciclo completo após pagamento, download, revogação e reemissão |
| Comunicação | Fila, dispatcher, recibos Meta/Resend e métricas documentados | Credenciais, modelos, consentimento e entregas reais |
| Integração institucional | API de recebimento/consulta, cadastro e regras documentados | Ligar solicitações externas ao fluxo interno e isolamento completo |
| MCP/OAuth | Piloto de leitura, consentimento e revogação documentados | Habilitação do provedor e testes PKCE/clientes |
| Workflow | Funções verificadas no banco e interface no repositório | Vínculo protocolo/instituição, retomada, histórico visível e decisão acadêmica |

## Trabalho verificado nesta conversa
- Inspeção das funções de workflow e permissões no Supabase.
- Zero modelos e zero instâncias na inspeção anterior desta conversa; não representa contagem permanente.
- Correção de decisões sobre etapa desatualizada, conclusão prematura e protocolos encerrados.
- Interface captura etapa exibida, impede duplo envio, preserva justificativa em falhas e recarrega análises.
- Migração aplicada: academy_workflow_step_checked_decisions.
- Commit: 0d479a8b2f21e13b39cbf0f9ac476436c41a50b3.
- Testes SQL com fixtures revertidas; testes de interface aprovados; quality gate aprovado.
- HTTP 200 observado na gestão. A atualização específica da interface ainda estava em publicação no último acompanhamento. Isso não comprova homologação de todas as páginas.
- Conclusão interna do workflow ainda não altera aprovação, horas, pagamentos ou certificados.

## Sequência de continuidade
1. Conferir publicação atual e consolidar regras de instituição/protocolo, papéis e acesso antes de ativar clientes.
2. Implementar vínculo explícito protocolo/instituição, testar estudante em duas instituições e acesso cruzado.
3. Completar devolução/retomada, histórico operacional e decisão humana final com horas verificadas e evidências.
4. Homologar jornada integrada de estudante/avaliador, pagamento sandbox, emissão, validação e notificações.
5. Homologar SafeDraft e interface móvel, Drive, IA e OAuth/MCP.
6. Validar regras comerciais e de certificação ainda ausentes do histórico recuperado antes de operação comercial.

## Fontes de continuidade
GUIA-MIGRACAO-SUPABASE.md; HOMOLOGACAO-UX-ESTUDANTE.md; MARCO-4-OPERACAO-NOTIFICACOES.md; PENDENCIAS-E-ETAPA-6.md; ROADMAP-PRODUTO-ESCALA.md; PLANO-MCP-SEGURO.md; UX-REDESIGN-2026.md; API-INTEGRACAO-INSTITUCIONAL.md; WORKFLOW-STATUS.md.
A documentação registra implementação declarada; somente os itens da seção de verificações têm validação técnica realizada nesta conversa.
