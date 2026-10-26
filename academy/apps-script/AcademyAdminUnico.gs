/** Rota de painel unificado, aproveitando funções já instaladas no Academy. */
function academyAdminUnicoPagina() {
  academyIntegracaoAuth_();
  return HtmlService.createHtmlOutputFromFile('AcademyAdminUnico')
    .setTitle('Protocolo Academy — Administração');
}
