# Academy Workflow — Entrega inicial e bloqueios
Data: 31/10/2026

## Implementado
- Modelo institucional em `academy_workflow_templates`, etapas numeradas em `academy_workflow_steps`, estrutura de execução em `academy_workflow_instances` e trilha de auditoria em `academy_workflow_history`.
- RLS habilitado; tabelas não possuem acessos diretos `anon` ou `authenticated`.
- `academy_workflow_setup` e `academy_workflow_list` exigem superadministrador.
- Interface em `/academy/gestao/` permite criar modelos inativos com uma a doze etapas e consultar os existentes.
- Sem IA aprovando solicitações, sem automatizar decisões institucionais e sem modificar protocolos existentes.

## Pendente para operação real
- [ ] Adicionar vinculação segura entre cada protocolo e instituição (tenant), preservando histórico e fluxo legado.
- [ ] Criar papéis de avaliador, responsável e gestor por instituição e fluxos de permissões de leitura por tenant.
- [ ] Introduzir funções de iniciar e avançar etapas com validação de direitos, transação, controle de concorrência, histórico e notificações.
- [ ] Criar tela operacional de tarefas e prazos por instituição.
- [ ] Homologar com duas instituições e duas contas estudantes, inclusive tentativas de acesso cruzado.
- [ ] Ativar modelos somente depois de todos os testes anteriores.
- [ ] Resolver a disponibilidade de www.protocolo.me antes de validar no navegador.

## Revisão de produto e inovações
- **Próxima prioridade:** caixa de entrada por responsabilidade — “Minhas análises”, “Aguardando estudante”, “Concluídas”.
- **SLA inteligente:** prazos por etapa e identificação de gargalos, sem fazer promessas automáticas sobre datas.
- **Modelos reutilizáveis:** fluxos aprovados pela instituição podem ser copiados e versionados, preservando critérios de avaliações anteriores.
- **Assistência contextual:** IA explica informações faltantes, mas decisões e horas aprovadas são humanas.

## Segunda entrega — execução humana supervisionada
- [x] RPC `academy_workflow_activate` restringe ativação/desativação ao superadmin.
- [x] RPC `academy_workflow_start` exige instituição e modelo ativos, protocolo não encerrado e aluno com vínculo `STUDENT` na instituição.
- [x] RPC `academy_workflow_advance` exige revisor/gestor/owner da instituição ou superadmin, justificativa de pelo menos 10 caracteres, etapa correta e registra decisão em histórico.
- [x] RPC `academy_workflow_inbox` limita visão aos responsáveis da instituição e ao superadmin.
- [x] Tela de gestão com ativação de modelo, abertura de fluxo, caixa de análises e registro manual de decisões.
- [ ] **Ainda não é aprovação acadêmica:** conclusão do workflow não altera `academy_requests.status`, pagamentos, certificados ou horas reconhecidas.
- [ ] Homologar com contas reais de duas instituições, casos de concorrência e registros históricos.
- [ ] Testar que o site público está acessível (pendência P0) antes de lançamento.

### Inovação sugerida ao final do marco
Configuração de SLA por etapa com avisos de atraso e substituição de avaliador, mantendo auditoria e confirmação humana.
