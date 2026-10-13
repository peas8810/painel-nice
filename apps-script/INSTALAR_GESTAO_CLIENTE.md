# Link de gestão do cliente e limites de envio

Atualize estes quatro arquivos no Apps Script:

- `CursosEventos.gs`
- `CertificadosCustomizados.gs`
- `WebAppNICE.gs`
- `CertificadosPublicPost.gs`

Mantenha `CertificadosDashboard.gs` com o encaminhamento de operações `courses_` já instalado. Salve e publique **Nova versão da implantação existente**. O frontend é atualizado pelo GitHub Pages. Recarregue `/certificados/cursos/` com Ctrl + F5.

## Fluxo comercial

1. O administrador cria o evento, configura a identidade e define limite total de envios e limite por pessoa, identificada pelo e-mail. Valores iniciais sugeridos na tela: 100 envios por link e 3 por pessoa; ajuste à contratação.
2. Entrega o **link de gestão do cliente**, privado, ao contratante. Não entregue a chave administrativa global.
3. O cliente cadastra nomes, e-mails, funções, horas e tema. Pode salvar cadastros sem emitir. Participante, Palestrante e Organizador estão disponíveis, assim como Concluinte, Coordenador e Monitor.
4. O cliente emite e envia individualmente e acompanha os certificados e o saldo daquele evento.
5. Ao atingir qualquer limite, o servidor bloqueia novos envios. Somente o administrador altera os limites no botão **Alterar limites**; o link permanece o mesmo.

Cada envio concluído (incluindo reenvio) consome 1 unidade total e 1 unidade por e-mail. Cadastro não consome unidades. Falhas são registradas sem consumir unidades. Reservas em andamento contam provisoriamente para impedir que solicitações simultâneas ultrapassem o limite. Uma repetição da mesma solicitação concluída retorna o código anterior sem enviar outro e-mail nem consumir novamente.

A aba `CERT_CURSOS_COTAS` guarda o histórico de reservas e envios. Certificados anteriores são importados para a contagem a partir do histórico existente de envios. Alterar um limite não zera o uso. Os limites existentes na tela de edição também são exclusivos do administrador.

O link do cliente permite consultar dados pessoais do seu próprio evento. É uma credencial de acesso e deve ser compartilhado somente com responsáveis. Não é um link público de autoatendimento de participantes.

Cadastros com documentos já emitidos não permitem alterar nome, horas ou tema silenciosamente. Correções desses documentos devem ser tratadas pelo administrador. Editar o modelo continua preservando PDFs já registrados.

A correção de PDF pula caixas de texto opcionais vazias antes da formatação, evitando o erro “The object … has no text”.

## Verificação após implantação

Crie um evento piloto com limite total 2 e limite por e-mail 1. Cadastre sem emitir e confirme saldo intacto. Envie uma vez e confira PDF/e-mail/registro. Tente reenviar ao mesmo e-mail: deve bloquear. Envie para outro e-mail: deve concluir e esgotar o total. Tente um terceiro: deve bloquear. Aumente os limites e confira que o mesmo link libera o saldo adicional.

Não foi realizada emissão real no Google durante o desenvolvimento. Se uma execução Google for interrompida sem retornar, a reserva fica bloqueada para evitar exceder a franquia; confira a aba de cotas e os registros antes de intervir. A versão atual não inclui recuperação automática dessas reservas nem login nominal do cliente.

## Dois QR Codes e formatação do conteúdo programático

Atualize `CursosEventos.gs` e publique uma nova versão. O novo PDF contém QR de validação e QR para abrir o próprio arquivo PDF no Drive, além de um link clicável. O ID do arquivo é reservado antes de gerar o PDF, e seu conteúdo final é gravado via Drive API. O arquivo é disponibilizado como **qualquer pessoa com o link — leitor**, necessário para que o QR funcione para o destinatário. Se a conta impedir esse compartilhamento, a emissão retorna erro.

No cadastro/edição do evento, escolha **Texto justificado** ou **Tópicos — um por linha**. As quebras de linha são preservadas. Em tópicos, um texto em linha única pode ser dividido pelos separadores “ - ” ou “ – ”. Palavras como “hands-on” são preservadas. A formatação também se aplica à regeneração de um PDF, preservando os dados textuais originais do registro. PDFs já enviados não são alterados automaticamente.

Confira após implantar: ler ambos os QR Codes, abrir o Drive em sessão sem login, verificar o arquivo final e o hash, conferir uma página com tópicos e outra com parágrafos justificados. A publicação local não executa Slides/Drive da conta Google.

## Editor de texto completo

O campo de conteúdo programático agora tem editor ampliado com negrito, itálico, sublinhado, listas numeradas e de tópicos, alinhamentos e tela cheia. Formatação e texto são armazenados em estrutura validada e aplicados por parágrafo no PDF.

Atualize `CursosEventos.gs` e `WebAppNICE.gs`, publique nova versão e recarregue a página. Para atualizar um PDF antigo, autentique no Dashboard de Certificados e use **Atualizar PDF** no código desejado; reenviar sozinho recupera o PDF que já estava armazenado. A regeneração mantém os dados originais e pode aplicar a formatação atual quando o conteúdo textual coincide, além dos dois QR Codes. Se o texto for alterado de fato, esse conteúdo é usado em novas emissões, preservando os registros antigos.
