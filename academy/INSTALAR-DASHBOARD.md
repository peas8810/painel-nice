# Dashboard administrativo — instalação

## Arquivos prontos no GitHub
- `academy/apps-script/AcademyDashboard.gs`
- `academy/apps-script/AcademyDashboard.html`

O dashboard utiliza dados das abas existentes do Google Sheets, exibindo cadastros, aprovação, indeferimento, correção, pagamento, evidências e emissão. Não salva nenhum dado pessoal no GitHub. Atualização por botão.

## Instalação no Apps Script
1. Abra o projeto privado **Protocolo Academy — Backend**.
2. Crie **Script** `AcademyDashboard` e cole todo o conteúdo de `AcademyDashboard.gs`.
3. Crie **HTML** `AcademyDashboard` e cole o conteúdo de `AcademyDashboard.html`.
4. Em **Configurações do projeto > Propriedades do script**, cadastre `ACADEMY_ADMIN_EMAILS` com o(s) e-mail(s) da(s) conta(s) administradora(s), separados por vírgula, sem tornar a lista pública.
5. Encontre o `doGet(e)` existente em `AcademyCore.gs` e altere **somente o corpo** para:

```javascript
function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'dashboard') {
    return academyDashboardAbrir();
  }
  return HtmlService.createHtmlOutputFromFile('AcademyApp')
    .setTitle('Protocolo Academy - Homologação');
}
```

**Não mantenha duas funções `doGet`** no projeto. Nunca publicar a Web App para **Qualquer pessoa** nesta fase.

6. Salve e, em **Implantar > Testar implantações**, abra seu URL `/dev?view=dashboard`, ainda conectado com a conta autorizada.
7. Para acessar a versão implantada `/exec`, crie uma **nova versão da implantação**.
8. Se aparecer **Acesso administrativo não autorizado**, confira o e-mail na propriedade `ACADEMY_ADMIN_EMAILS`. O Apps Script pode não revelar o e-mail ativo em todos os modos de implantação; o módulo foi projetado para **negar acesso** quando a identidade não puder ser confirmada.

## Segurança
- Implantação restrita à conta administradora, não ao público.
- `academyDashboardResumo` devolve nomes/e-mails de alunos e **não** pode ser exposto por API pública.
- Consulta em `google.script.run` somente no HTML privado. Não colocar links para o painel público no GitHub Pages que presumam acesso irrestrito.
- O dashboard é de **acompanhamento**: as decisões administrativas continuam no painel de homologação original.
- Decisões e pagamentos devem ser obtidos diretamente das abas, não preenchidos manualmente no front-end.

## Notas sobre status
Os indicadores priorizam a decisão mais recente da aba VALIDACOES. Categorias desconhecidas aparecem como Em análise. Valores financeiros não são considerados pagos até estado PAID_CONFIRMED. Registros DEMO são excluídos da contagem de certificados ATIVO.

## Estado atual
Código publicado no GitHub, **ainda não instalado no Apps Script** nem testado ao vivo.
