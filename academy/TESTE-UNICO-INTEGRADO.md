# PROTOCOLO ACADEMY — Acesso unificado para homologação

## O que foi entregue no GitHub
- `academy/apps-script/AcademyIntegracao.gs`: status real das 8 abas, contagens, fluxo de teste único e barreira administrativa
- `academy/apps-script/AcademyIntegracao.html`: painel administrativo integrado
- `academy/apps-script/AcademyDashboard.gs` e `AcademyDashboard.html`: estatísticas e gráficos
- `academy/admin/index.html`: links para painel antigo, centro integrado e dashboard
- `academy/portal/index.html`: prévia do portal independente do estudante

## Etapas obrigatórias para funcionar no Apps Script atual
1. Abra o projeto **Protocolo Academy — Backend** e adicione um arquivo Script `AcademyIntegracao.gs` copiando o arquivo do GitHub.
2. Adicione um arquivo HTML `AcademyIntegracao.html` copiando o arquivo do GitHub.
3. Confirme que **AcademyDashboard.gs** e **AcademyDashboard.html** estão instalados na versão mais recente.
4. Em **Propriedades do script**, configure `ACADEMY_ADMIN_EMAILS` com e-mail da conta administradora. Nunca publique os tokens ou chaves.
5. Altere a função `doGet(e)` existente em **AcademyCore.gs** para:

```javascript
function doGet(e) {
  const view = String(e?.parameter?.view || '');
  if (view === 'integracao') return academyIntegracaoPagina();
  if (view === 'dashboard') return academyDashboardAbrir();
  return HtmlService.createHtmlOutputFromFile('AcademyApp')
    .setTitle('Protocolo Academy — Homologação');
}
```

**Não criar um segundo `doGet`.** A implantação atual deve continuar privada: **Quem pode acessar: Somente eu**. Se `Session.getActiveUser().getEmail()` não estiver disponível, o acesso será negado de forma segura. Não enfraquecer a validação para contornar isso.

6. Salve, use **Implantar → Testar implantações**, abra `/dev?view=integracao`, e depois `/dev?view=dashboard`.
7. Para atualizar o endereço `/exec` já publicado, vá a **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**.

## Teste único seguro
O botão **Executar teste único de homologação** grava um aluno fictício, solicitação `ACA-HOM-...`, arquivo TXT sintético em Drive privado, evidência marcada TESTE_NAO_VALIDADO, parecer `PENDENTE_DOCUMENTOS` e pagamento `NAO_INICIADO`. Testa se a emissão continua bloqueada. NÃO realiza cobrança e NÃO cria certificado.
A rotina é deliberadamente não-idempotente: cada clique cria novos registros identificados como homologação. Execute apenas uma vez para avaliar e conferi-los na planilha. A rotina devolve o ID do pedido fictício.

## Para liberar o cadastro público real
A implantação atual contém métodos internos de administração, então não deve ser disponibilizada a qualquer pessoa. A forma correta é implantar um **backend público separado**, com autenticação verificável por aluno, autorização por proprietário de documento, controles de abuso e segregação do armazenamento. Enquanto isso, o portal do aluno continua uma prévia sem gravação de dados.

## Limitação
Arquivos GitHub foram publicados. A conexão atual não consegue modificar nem executar diretamente o projeto Apps Script na conta do proprietário. O teste completo **não foi executado no Apps Script real** e depende das ações acima. Não anunciar produção nem emitir documentos comerciais até validação.
