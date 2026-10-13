# Emissão em lote — adição ao módulo de cursos

A emissão individual continua no mesmo fluxo. A nova opção abre uma página separada, com até 100 pessoas e um único endereço de entrega.

## Instalação

1. Adicione o novo arquivo `CertificadosLotes.gs` ao Apps Script.
2. Atualize `CursosEventos.gs`, `WebAppNICE.gs` e `CertificadosPublicPost.gs` com as versões deste repositório. Os demais arquivos existentes continuam necessários.
3. Execute **instalarEmissaoLotes** uma vez e autorize os serviços solicitados. Ela cria a aba `CERT_LOTES`, acrescenta campos de lote à base de emissões e instala um gatilho de processamento a cada minuto. Não exclui os dados existentes.
4. Publique uma **Nova versão da implantação existente** e recarregue a página de Cursos e Eventos.

## Uso

- Na lista administrativa do evento, clique **Emissão em lote**. O cliente também encontra esse acesso no próprio link do evento.
- Informe o e-mail único de entrega e cadastre as pessoas na tabela ou importe CSV UTF-8 com cabeçalho `nome,funcao,carga,tema,email,aprovado`.
- Campos obrigatórios: nome, função e horas numéricas. Tema e e-mail individual são opcionais. Para concluintes, `aprovado` precisa ser `sim`, `true` ou `1`.
- Cada linha resulta em PDF, código UJN, Livro/Registro e QR próprios. Os signatários por função e o bloqueio de autoassinatura são aplicados.
- O sistema reserva o saldo na criação e processa até cinco PDFs por execução. A página acompanha concluídos e falhas; o processamento continua depois de fechar a página.
- Cada certificado concluído consome uma unidade, independentemente do único e-mail de entrega. O controle por titular usa o e-mail individual quando fornecido; caso contrário, o nome normalizado. Pessoas homônimas devem receber e-mails individuais para identificação distinta.
- Na entrega, o destinatário recebe um único e-mail com link de ZIP. Se o ZIP tiver menos de 18 MB, também será anexado. Os arquivos têm nome e código para facilitar identificação. O ZIP é compartilhado como leitor para quem possui o link.
- O lote congela o modelo do evento no momento da criação. Alterações futuras não mudam silenciosamente um lote em andamento.
- Falhas podem ser retomadas pelo botão correspondente. Itens concluídos são preservados. Se o evento for fechado durante o processamento, o lote pausa; reabra e retome.

## Verificação

Faça um lote piloto com duas pessoas e seu próprio e-mail de entrega. Confira a entrega única, os dois PDFs, validação, registros e desconto de duas unidades. Teste CSV inválido, saldo insuficiente e uma retomada antes de usar com 100 pessoas.

Os testes locais validam regras e retomada de registros. Não foi disparado e-mail real nem executado Slides/Drive da conta Google no desenvolvimento. A geração depende das quotas do Apps Script/Drive/Gmail da conta proprietária.

Uma interrupção excepcional após o envio do e-mail e antes de salvar a confirmação pode deixar a entrega marcada `ENVIANDO`. Confira o recebimento e os registros antes de agir; o sistema não repete automaticamente uma entrega com resultado ambíguo.
