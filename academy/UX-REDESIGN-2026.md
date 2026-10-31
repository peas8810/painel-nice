# Academy Experience 2.0 — revisão crítica e redesenho (31/10/2026)

## Diagnóstico da experiência anterior
1. O estudante encontrava muitos módulos e textos administrativos ao mesmo tempo, competindo visualmente com a tarefa principal.
2. A navegação mobile tinha links em formato de chips no topo, menos acessíveis ao polegar que uma barra inferior.
3. Fluxos e estados críticos não tinham hierarquia clara: criar atividade, acompanhar pendências, consultar certificados.
4. Formulários tinham aparência de backoffice; conteúdo técnico de OAuth, auditoria e notificações estava excessivamente próximo das ações essenciais.
5. O painel de gestão tinha muitas abas, densidade excessiva e controles com estilos heterogêneos.

## Referências e princípios
- Uber Base Design System: linguagem visual consistente entre produtos, legibilidade e componentes reutilizáveis — https://base.uber.com/
- Android navigation patterns: três a cinco destinos principais e navegação inferior em telas compactas — https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- Nielsen Norman Group: progressive disclosure e formulários em coluna única — https://www.nngroup.com/articles/progressive-disclosure/ e https://www.nngroup.com/articles/web-form-design/
Não copiar elementos de marca, fontes proprietárias ou identidade da Uber; apenas usar os princípios.

## Alterações publicadas
- Student hero reformulado para “O que vamos fazer hoje?”, CTA de nova atividade e ação secundária de acompanhamento.
- Navegação inferior fixa com 5 destinos (Início, Nova atividade, Pedidos, Certificados, Conta), controles de foco e item ativo.
- Unificação dos componentes visuais: cartões claros, tipografia contrastada, campos de 16px e alvos de toque acima de 44px.
- Assistente de IA visualmente agrupado no módulo de pedidos, com ação primária mais clara.
- Priorização da nova atividade em telas pequenas e na primeira coluna no desktop.
- Administração alinhada a mesma paleta, hierarquia e abas horizontais móveis.
- Corrigido identificador duplicado `tenant-list` no HTML de administração.

## Critérios de homologação ainda pendentes
- Teste manual real em iPhone Safari, Android Chrome e desktop nas larguras 320, 375, 390, 768 e 1280px.
- Conferir teclado aberto, safe areas, leitores de tela, zoom 200%, foco de links e botões, navegação por âncoras e retorno do navegador.
- Testar login, criação, rascunho, upload, consulta, pagamentos e certificados com contas reais de homologação.
- Medir tempo para registrar um protocolo, erros, abandono e taxa de autosserviço. Usar A/B test apenas quando houver volume e consentimentos adequados.
- Validar contraste e acessibilidade WCAG 2.2.
- Verificar deploy GitHub Pages e cache do service worker antes da apresentação final.

## Inovações propostas após esta revisão
1. Home adaptativa por estado: aluno novo vê CTA de primeiro protocolo; aluno com pendência vê correção como ação principal; aluno com certificado emitido vê carteira.
2. Linha do tempo operacional única por protocolo em linguagem natural, com previsão de etapa baseada em dados reais (não promessas de prazo).
3. Captura de comprovante diretamente no fluxo inicial, sem precisar criar protocolo e procurar uma segunda área para anexar.
4. Instrumentação privacy-first para calcular tempo de conclusão e pontos de abandono e gerar melhorias comprovadas de UX.
