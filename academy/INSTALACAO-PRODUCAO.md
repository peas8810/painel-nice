# Instalação segura — Protocolo Academy (26/10/2026)

## Base utilizada
O módulo foi inspirado nas funções `niceCertGeneratePdf_`, `niceCertSign_`, `niceCertBookAllocate_` e nas rotinas de certificados customizados do sistema NICE, mas **não depende do código NICE** e não modifica sua planilha mestre.

## O que já foi publicado no GitHub
- `/academy/` — página informativa
- `/academy/admin/` — entrada para o Apps Script privado
- `/academy/modelos/certificado.html` — visualização sem validade
- `/academy/apps-script/AcademyConciliacao.gs` — reconciliação apenas em sandbox
- `/academy/apps-script/AcademyEmissao.gs` — emissão de prévia PDF demonstrativa, apenas em sandbox, quando documento e pagamento estiverem aprovados

## Instalar manualmente no Apps Script
1. **Não instale** o arquivo `CertificadosNICE.gs` do sistema antigo dentro do Apps Script Academy.
2. Preserve o `Código.gs` e `AcademyCore.gs` já testados. Evite duas funções `doGet`.
3. Cole o arquivo `AcademyConciliacao.gs` do GitHub no projeto Academy.
4. Cole `AcademyEmissao.gs` no mesmo projeto. Não colocar credenciais em código.
5. Em **Propriedades do script**, configure `ACADEMY_SIGNING_SECRET` com um valor aleatório e privado de 32+ caracteres; preserve `MP_ACCESS_TOKEN` e `MP_ENVIRONMENT=sandbox`; as pastas já foram configuradas com `academyInstalarPastas()`.
6. Execute `academyConciliarPagamentosTeste`. Sem pagamento aprovado, ela não habilita emissão.
7. Use uma solicitação fictícia completa, com aluno, evidência e aprovação válida. Consulte `academyEmissaoChecar_('ACA-...')`. Quando ambos requisitos estiverem aprovados, execute `academyEmitirPreviaTeste('ACA-...')` pela barra do editor por meio de uma função de teste sem parâmetros.
8. Confira o arquivo PDF no Drive em `PROTOCOLO ACADEMY/CERTIFICADOS` e o registro na aba `CERTIFICADOS`.

## O que esta implementação NÃO faz
- Não ativa formulário público nem autentica alunos.
- Não reconhece horas complementares pelo MEC.
- Não publica relatório real de evidências, apenas texto de demonstração.
- Os QR Codes do PDF demonstrativo levam a uma página informativa, não confirmam autenticidade.
- Não envia e-mails nem autoriza pagamentos reais.
- Não libera certificado oficial por conta própria; somente PDF de homologação com marca d'água textual.

## Pendências prioritárias de produção
1. Padronizar no backend os status de aprovação documental/pagamento e campos do relatório.
2. Autenticação e autorização administrativa; identidade do solicitante e acesso protegido aos arquivos.
3. Verificador público seguro, sem dados pessoais sensíveis, com assinatura revalidada e situações de revogação.
4. Confirmação do pagamento com ID do vendedor, estorno, chargeback e idempotência; política de 1ª/2ª/3ª via.
5. PDF definitivo fiel ao layout original e relatório documental sanitizado, ambos com URLs públicas verdadeiras.
6. E-mail transacional: a API v2 do IAGENTEmail fornecida documenta apenas contatos/grupos, não disparo.
7. Revisão jurídica e LGPD; controles de taxa, anti-bot, antivírus e avaliação humana.
8. Teste ponta a ponta real no Apps Script e Mercado Pago antes de ativar cobrança.

## Observação
Acesso GitHub e Google Sheets permite modificar código/planilha; a conexão ChatGPT atual **não edita nem executa o projeto Apps Script vinculado**. É necessária a instalação no editor pelo proprietário ou um pipeline `clasp` autorizado.
