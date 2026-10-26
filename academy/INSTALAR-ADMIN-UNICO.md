# Protocolo Academy — painel único administrativo

A página `https://www.protocolo.me/academy/admin/` agora mostra **um único botão** para abrir `/exec?view=admin`.

## Instalação no Apps Script

1. Adicione **Script** chamado `AcademyAdminUnico` e cole o conteúdo de [AcademyAdminUnico.gs](apps-script/AcademyAdminUnico.gs).
2. Adicione **HTML** chamado `AcademyAdminUnico` e cole [AcademyAdminUnico.html](apps-script/AcademyAdminUnico.html).
3. Mantenha os arquivos já instalados `AcademyIntegracao.gs`, `AcademyDashboard.gs`, `AcademyApp.html` e `AcademyCore.gs`. Eles fornecem os dados e as funções do painel. Não remova essas dependências.
4. Na **única** função `doGet(e)` existente em `AcademyCore.gs`, coloque esta condição logo depois de determinar `view`:

```javascript
if (view === 'admin') return academyAdminUnicoPagina();
```

Modelo completo do roteamento:

```javascript
function doGet(e) {
  const view = String((e && e.parameter && e.parameter.view) || '').trim().toLowerCase();
  if (view === 'admin') return academyAdminUnicoPagina();
  if (view === 'integracao') return academyIntegracaoPagina();
  if (view === 'dashboard') return academyDashboardAbrir();
  return HtmlService.createHtmlOutputFromFile('AcademyApp')
    .setTitle('Protocolo Academy — Homologação');
}
```

5. Confirme que `ACADEMY_ADMIN_EMAILS` permanece configurada e que a implantação está restrita (**Somente eu**).
6. Teste a nova página em `/dev?view=admin` e, se funcionar, use **Implantar → Gerenciar implantações → Editar → Nova versão** para atualizar `/exec?view=admin`.

## Funcionalidades reunidas

- Visão geral: KPIs, estados de solicitações/pagamentos e tabela recente
- Solicitações: busca e filtros, leitura de evidências e horários, certificados
- Financeiro: pagamentos confirmados/pendentes/não iniciados
- Estatísticas: filtros por período, seis visualizações e indicadores
- Homologação: diagnóstico de ambiente, configuração e teste único seguro

A nova página não deve criar uma segunda função `doGet`. As rotinas existentes de cadastro e de decisão **não foram duplicadas** no painel unificado; a aba de solicitações consolida a consulta, enquanto modificações permanecem no painel original de homologação. O acesso ao painel atual é somente leitura, exceto pela função de teste único, que exige confirmação e insere dados fictícios.

## Segurança

Este painel chama funções privadas `academyDashboardResumo`, `academyDashboardEstatisticas`, `academyIntegracaoDados` e `academyIntegracaoTesteUnico`. Todas exigem `ACADEMY_ADMIN_EMAILS`. Nunca implante o mesmo Apps Script com acesso público.

## Limitação da publicação

O GitHub está atualizado, mas o projeto Apps Script vinculado continua exigindo a cópia dos **dois arquivos novos** e a atualização do roteamento. Antes disso, o botão da página administrativa apontará para uma rota que não existe na implantação atual.
