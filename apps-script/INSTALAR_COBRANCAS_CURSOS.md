# E-mail de cobrança por curso/evento

Adição administrativa: mantém os fluxos de certificados, lotes, registros, signatários e limites. Nenhuma cobrança é enviada ao instalar ou abrir o formulário.

## Ativação

1. Adicione o arquivo **CursosCobrancas.gs** ao projeto Apps Script existente.
2. Atualize **CursosEventos.gs** e **WebAppNICE.gs** com as versões do repositório. Os demais arquivos do projeto continuam necessários.
3. Execute **instalarCobrancasCursos** uma vez, com a conta proprietária, e autorize os serviços solicitados. O instalador verifica o remetente e cria a aba `CERT_CURSOS_COBRANCAS`; não envia mensagens nem altera as abas de certificados.
4. Publique uma **nova versão da implantação existente**, mantendo a URL usada pelo site. A implantação deve executar como `peas8810@gmail.com`, ou como uma conta que tenha esse endereço configurado e autorizado em **Gmail → Configurações → Contas → Enviar e-mail como**.
5. Recarregue **Cursos e Eventos** com Ctrl + F5 e acesse a administração.

O site passa a carregar `cobranca.js` automaticamente. Não é necessário instalar outro serviço ou mudar a chave administrativa. As operações de cobrança usam POST e exigem a mesma autenticação administrativa do painel.

## Uso

No cartão do curso, clique **Enviar e-mail de cobrança**. Preencha um destinatário, descrição, valor em reais e instruções de pagamento. O vencimento, nome, link HTTPS e mensagem complementar podem ser ajustados. As opções de pagamento são Pix, transferência bancária, link de pagamento, boleto e outro. Dados bancários, chave Pix e links são informados pelo administrador; o sistema não gera boleto nem cria uma cobrança em uma operadora de pagamento.

Clique **Revisar e-mail de cobrança**: o sistema salva um rascunho e mostra remetente, destinatário, assunto e texto completo. Depois de conferir o endereço e os dados de pagamento, clique **Enviar e-mail de cobrança** e confirme o valor e o destinatário. O envio usa o rascunho salvo, e não campos alterados depois da revisão.

O histórico de cada curso mostra as 20 últimas cobranças, destinatário, valor, situação e horário do envio confirmado. **Ver cobrança** permite recuperar uma prévia. Repetir a mesma solicitação de envio de uma cobrança já `ENVIADO` não dispara outra mensagem. Para uma nova cobrança ou lembrete deliberado, revise uma nova mensagem no formulário.

`ENVIADO` significa que o Gmail aceitou a chamada de envio; não comprova leitura, entrega na caixa de entrada ou pagamento. `ENVIANDO` ou `ENVIO_INCERTO` não são repetidos automaticamente: confira a pasta **Enviados** da conta remetente e o erro no histórico antes de iniciar outro envio.

As cobranças não emitem certificados, não consomem franquia, não abrem/fecham links e não confirmam pagamentos. O formulário é exclusivo da administração; o link entregue ao cliente não mostra esse recurso.

## Verificação

Os testes locais usam Gmail e planilhas simulados para validar destinatário, valores em centavos, prévia, autenticação, isolamento por curso, remetente e repetição de solicitações. Não enviam e-mail real. Após implantar, faça uma cobrança piloto para um endereço sob seu controle, confira a pasta Enviados e a mensagem recebida antes de usar com clientes.

Documentação do remetente/alias: https://developers.google.com/apps-script/reference/gmail/gmail-app#sendEmail(String,String,String,Object)
