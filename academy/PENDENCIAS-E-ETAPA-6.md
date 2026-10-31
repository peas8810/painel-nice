# ACADEMY — Pendências bloqueadoras e Etapa 6

Atualizado em 31/10/2026.

## P0 — BLOQUEIO DE PRODUÇÃO: Site inacessível
- [ ] Confirmar resolução DNS de `www.protocolo.me` e CNAME apontando a `peas8810.github.io`.
- [ ] Confirmar GitHub Pages publicado via branch `main`, diretório correto e HTTPS/certificado ativo.
- [ ] Verificar `https://www.protocolo.me/academy/`, `portal/`, `admin/`, `gestao/` e `validar/` por acesso real em redes e navegadores diferentes.
- [ ] Confirmar que alterações de código chegam ao domínio e que PWA não utiliza recursos antigos.
- [ ] Executar jornada de login, envio, upload, revisão e validação em ambiente real.
**Responsável por desbloquear:** administrador do domínio e GitHub Pages. Não tratar publicação de código como validação de disponibilidade.

## Etapa 6 — Mobile e RLS multiusuário/multi-instituição
- [x] Inspecionar RLS em tabelas Academy: todas as tabelas públicas `academy_*` retornadas pela inspeção estão com RLS habilitado.
- [x] Inspecionar grants: `academy_requests` e `academy_evidence` permitem SELECT/INSERT apenas a `authenticated`, sujeitos a RLS. `academy_connected_apps` permite somente SELECT ao autenticado. `academy_tenants`, `academy_tenant_members` e `academy_tenant_rules` não apresentaram grants diretos a `anon` ou `authenticated`.
- [x] Inspecionar HTML e scripts principais: formulários balanceados, sem IDs duplicados nos nove arquivos HTML revisados, e sem erros de parsing nos 11 arquivos JavaScript revisados.
- [ ] Fazer teste real com estudante A e B: listagens, tentativa de acesso direto por UUID, alteração de protocolo, mensagens, upload de outro titular, certificado e consentimentos.
- [ ] Fazer teste real com instituições A e B: escopo de todos os RPCs, chaves API, eventos, aprovações e relatórios sem vazamento lateral.
- [ ] Testar mobile em Safari iPhone, Chrome Android, 320/375/390/768 px, zoom 200%, navegação por teclado, teclado aberto, safe area e VoiceOver/TalkBack.
- [ ] Rodar navegação, emissão, pagamentos e mensagens após domínio voltar.
- [ ] Não habilitar tenants ativos, pagamentos reais ou emissão comercial antes da homologação.

## Próximas inovações após Etapa 6
1. Observabilidade do front-end com monitoramento de erros JS e disponibilidade por região, sem coletar conteúdo sensível de formulários.
2. Testes automatizados a cada commit (Playwright mobile, acessibilidade e rotas), com bloqueio de release em caso de falha.
3. Painel de saúde do produto, com indicadores de falhas, latência e taxa de conclusão de protocolo.

## Critério de conclusão
A Etapa 6 só estará concluída após ensaios autenticados entre contas, verificação mobile real e DNS/Pages funcionais.
