# Sistema NICE de Certificados

## O que foi criado

- Portal público: `https://www.protocolo.me/certificados/`
- Eventos sequenciais: `https://www.protocolo.me/certificados/23/`
- Validador: `https://www.protocolo.me/certificados/validar/`
- Código por certificado: `CERT-NICE-00023-XXXXXXXXXX`
- QR Code apontando para o validador
- Selo HMAC-SHA256 de integridade
- Geração automática de PDF
- Envio automático por e-mail
- Revogação e rastreabilidade

## Instalação no Apps Script

1. Crie um novo arquivo no projeto Apps Script chamado `CertificadosNICE.gs`.
2. Copie para ele todo o conteúdo de `apps-script/CertificadosNICE.gs` deste repositório.
3. Substitua o conteúdo do arquivo `WebAppNICE.gs` pela versão atual deste repositório.
4. Salve.
5. Execute manualmente `instalarSistemaCertificados()` e autorize os escopos solicitados (Drive, Slides, Gmail, planilhas e UrlFetch).
6. Atualize a implantação do Web App: **Implantar → Gerenciar implantações → lápis → Nova versão → Implantar**.
7. Confirme que o Web App continua sendo executado pela conta `nice@unipacto.com.br` (ou que esse endereço seja um alias autorizado no Gmail da conta executora).

## Fluxo de uso

1. Abra a planilha mestre NICE.
2. Use o menu **NICE • Certificados → Criar novo evento**.
3. O sistema gera o `EVENTO_ID` sequencial e publica a página `/certificados/{id}/`.
4. Na aba `CERT_EMISSOES`, cole uma linha por participante, preenchendo pelo menos `EVENTO_ID`, `NOME` e `EMAIL`.
5. Use **NICE • Certificados → Emitir certificados pendentes**.
6. O sistema gera PDF, QR Code, código único, selo de integridade, salva no Drive e envia por e-mail.
7. O participante valida o documento pelo QR Code ou pelo código no portal público.

## Abas criadas

- `CERT_EVENTOS`: cadastro e rastreabilidade dos eventos.
- `CERT_EMISSOES`: participantes, códigos, emissão, envio e revogação.
- `CERT_LOG`: trilha de auditoria.

## Segurança

- Não publique e-mails no GitHub Pages.
- O validador consulta o Apps Script por código individual.
- O token do GitHub deve permanecer somente em `GITHUB_SYNC_TOKEN` nas Propriedades do script.
- O segredo HMAC é criado automaticamente em `CERT_SIGNING_SECRET` e nunca deve ser publicado.
- Para manter o remetente `nice@unipacto.com.br`, o Apps Script deve executar por essa conta ou por uma conta em que esse endereço seja alias permitido.

## Limite operacional

A rotina processa até 40 certificados por execução para reduzir risco de timeout e respeitar cotas de e-mail/serviços do Google. Para eventos maiores, execute novamente até concluir todos os pendentes.
