# Academy — relatório de testes automatizados (25/10/2026)

## Escopo
Testes executados localmente contra o código de MVP `AcademyCore.gs` entregue no pacote `Protocolo-Academy-MVP-Backend.zip`, com substitutos em memória para Google Apps Script, Sheets, Drive e Mercado Pago. Nenhuma transação real, solicitação real ou certificado foi emitido pelos testes.

## Resultado: 14/14 aprovados (somente ambiente simulado)
- Aceite de privacidade obrigatório
- E-mail inválido rejeitado
- Horas negativas rejeitadas
- Tipo de arquivo proibido rejeitado
- Pedido sem comprovante rejeitado
- Cadastro válido gera IDs e registros em memória
- Consulta com chave errada rejeitada
- Consulta com chave correta permitida
- Listagem administrativa sem identidade rejeitada
- Listagem de administrador autorizado permitida
- Horas verificadas maiores que as declaradas rejeitadas
- Aprovação dentro do limite permitido
- Nenhum pagamento fictício é aprovado sem transação
- Código de certificado desconhecido é tratado como inválido

## Verificação do banco Google Sheets
As tabelas ALUNOS, EVIDENCIAS, VALIDACOES e CERTIFICADOS ainda estavam vazias. Há somente uma solicitação fictícia antiga e uma preferência financeira PREFERENCE_CREATED. Isso não demonstra pagamento confirmado.

## Bloqueios de produção identificados
1. O sistema Academy não tem implementação operacional de PDF e dois QR Codes independentes (autenticidade e relatório de provas). O modelo recebido usa layout A4 paisagem, dois lados, numeração/livro e assinatura HMAC; não se deve reutilizar emissor ou assinatura de outra entidade sem autorização.
2. O MVP e os arquivos manuais posteriormente fornecidos usam nomes distintos de funções, propriedades e status. No projeto Apps Script deve existir uma implementação única de `doGet` e convenções padronizadas; não instalar os dois backends lado a lado.
3. O controle administrativo requer validação efetiva de identidade e permissões antes de acesso público. Não publicar a implantação atual para qualquer pessoa.
4. A conciliação precisa confirmar cada transação por GET autenticado, identificação do vendedor, moeda, valor e pedido. Padronizar statuses `APPROVED` versus `PAID_CONFIRMED` e evitar dupla emissão.
5. Não há fluxo de e-mails transacionais verificado; IAGENTEmail v2 fornecido documenta contatos/grupos, não endpoint de envio.
6. Faltam testes reais de upload, autorização, reversão/estorno, concorrência, relatórios LGPD, QR e acessibilidade.
7. O site público não pôde ser acessado pelo verificador externo neste teste; arquivos no GitHub não demonstram acessibilidade operacional.

## Próximo teste real seguro
Implantar somente para a conta administradora, cadastrar um aluno fictício, enviar um PDF fictício, conferir três tabelas, revisar o pedido, executar reconciliação em sandbox, conferir se não há emissão indevida.
