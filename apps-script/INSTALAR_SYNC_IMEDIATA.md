# NICE — Sincronização imediata Google → GitHub

## Objetivo

Fazer um novo protocolo ou relatório acionar o GitHub imediatamente, sem depender apenas do agendamento de 5 minutos.

Fluxo:

`Google Forms → Apps Script → repository_dispatch → GitHub Actions → live-data.json → portal`

O agendamento de 5 minutos continua ativo como redundância.

## 1. Criar token no GitHub

Crie um **Fine-grained personal access token** com:

- Resource owner: `peas8810`
- Repository access: **Only select repositories**
- Repositório: `painel-nice`
- Repository permissions → **Contents: Read and write**

Não coloque o token em arquivo do repositório e não envie o token por chat/e-mail.

## 2. Guardar o token no Apps Script

No projeto Apps Script:

**Configurações do projeto → Propriedades do script → Adicionar propriedade**

- Propriedade: `GITHUB_SYNC_TOKEN`
- Valor: cole o token

Salve.

## 3. Adicionar o arquivo GitHubSync.gs

Crie um novo arquivo no Apps Script chamado `GitHubSync` e copie o conteúdo de:

`apps-script/GitHubSync.gs`

Salve o projeto.

## 4. Instalar os gatilhos rápidos

No seletor de funções, execute:

`instalarSincronizacaoImediataNICE`

Autorize as permissões solicitadas.

A função substitui os gatilhos de submissão por wrappers que:

1. executam a rotina original do Sistema NICE;
2. aguardam a gravação do protocolo/relatório;
3. acionam o GitHub imediatamente.

A rotina diária continua ativa.

## 5. Resultado esperado do teste

A função faz um teste automático. O resultado correto é:

`GitHub respondeu HTTP 204`

HTTP 204 significa que o GitHub aceitou o `repository_dispatch`.

## 6. Segurança

O token fica apenas nas **Propriedades do Script**. O código público contém somente o nome da propriedade, nunca o segredo.

Se o token for revogado ou expirar, o sistema principal (Forms, Sheets, Drive) continua funcionando; apenas a atualização imediata do painel deixa de ocorrer. O cron de 5 minutos permanece como redundância.
