# Backend Google Apps Script — Sistema NICE

O GitHub Pages hospeda a interface pública em `/protocolos/`, mas o GitHub Pages é estático e não deve receber dados pessoais nem credenciais. Por isso, o backend operacional permanece no Google Apps Script, ligado às planilhas institucionais.

## Arquivos

- `SistemaNICE.gs` — geração do ID, criação do chamado, prazos, Drive, vínculo do relatório e encerramento.
- `WebAppNICE.gs` — API pública sanitizada usada pelo GitHub Pages para indicadores e consulta de protocolo.
- `appsscript.json` — manifesto sugerido.

## Instalação

1. Abra a planilha de Formalização de Eventos.
2. Vá em **Extensões → Apps Script**.
3. Crie/cole os arquivos `SistemaNICE.gs` e `WebAppNICE.gs` deste diretório.
4. Salve.
5. Execute `instalarEstruturaNICE()` uma vez e conceda as permissões.
6. Na aba `CONFIG_NICE`, informe `ROOT_FOLDER_ID` da pasta institucional do Drive.
7. Faça um protocolo de teste.
8. Depois execute `adicionarCampoIdNoFormularioRelatorio()` em ambiente de teste.

## Publicar a API para o GitHub Pages

No Apps Script:

1. **Implantar → Nova implantação**.
2. Tipo: **Aplicativo da Web**.
3. Executar como: **você / conta institucional responsável pelo sistema**.
4. Acesso: escolha a opção compatível com a política da instituição para permitir a consulta pública do protocolo.
5. Clique em **Implantar**.
6. Copie a URL terminada em `/exec`.

Exemplo:

```text
https://script.google.com/macros/s/AKfycbXXXXXXXXXXXX/exec
```

Depois, no GitHub, edite:

`protocolos/config.js`

preenchendo:

```js
API_URL: "https://script.google.com/macros/s/AKfycbXXXXXXXXXXXX/exec"
```

A partir daí, o portal passa a exibir os indicadores operacionais e permite consultar o andamento por `NICE-AAAA-00000`.

## Privacidade

A API pública foi deliberadamente limitada. Ela não retorna:

- nome do responsável;
- e-mail;
- observações administrativas;
- link da pasta interna do Drive;
- link direto dos arquivos enviados.

A consulta retorna apenas situação do protocolo, título da ação, curso/unidade, datas e link público do formulário de relatório quando aplicável.

## Autocrat

O Autocrat pode continuar no fluxo atual. Esta versão do código não envia e-mails automaticamente, evitando mensagens duplicadas durante a homologação.

## Produção

Antes de ativar nas planilhas oficiais, valide pelo menos:

1. criação de 3 protocolos de teste;
2. sequência correta dos IDs;
3. criação das pastas no Drive;
4. aprovação manual;
5. mudança para `AGUARDANDO_RELATORIO`;
6. envio de 3 relatórios;
7. encerramento correto dos 3 chamados;
8. funcionamento da consulta no GitHub Pages.

## URL do portal

Após o GitHub Pages publicar a alteração:

`https://peas8810.github.io/painel-nice/protocolos/`
