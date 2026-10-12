# Instalação de Cursos e Eventos

O frontend está em `/certificados/cursos/`. O backend exige nova implantação do Web App existente.

1. Faça uma cópia de segurança do projeto Apps Script e da planilha.
2. Adicione `CursosEventos.gs`.
3. Substitua os arquivos `CertificadosCustomizados.gs`, `CertificadosDashboard.gs`, `CertificadosPublicPost.gs` e `WebAppNICE.gs` pelas versões deste repositório. Mantenha os demais módulos, inclusive Livro Digital.
4. Execute `instalarCursosEventos`. A função cria somente a aba `CERT_CURSOS_EVENTOS`; não altera registros anteriores. O JSON do evento e as imagens ficam no Drive da conta proprietária, na pasta do evento, e a aba guarda a referência ao arquivo.
5. Salve e publique uma **nova versão da implantação existente**, mantendo a URL usada pelo site e o acesso público necessário à emissão. Autorize os serviços solicitados pelo Google.
6. Abra `/certificados/cursos/`, entre com a chave administrativa existente e crie um evento piloto. Cadastre seu e-mail como participante e palestrante, com cargas diferentes.
7. Confira as duas emissões, os PDFs, os registros independentes, os hashes e a validação pelo QR Code. Confira também fechamento da emissão e rejeição de um e-mail não cadastrado.

## Operação

- Cadastre cliente/realizador e instituição emissora separadamente. A identidade pode ser reutilizada em novos eventos pelo seletor de cliente.
- Use PNG/JPEG até 85 KB para logo e assinaturas. Não use CPF no campo público de identificação.
- Importe CSV em UTF-8, separado por vírgula, com cabeçalho `nome,email,funcao,carga,tema,aprovado`. Valores com vírgulas devem estar entre aspas.
- Funções: Participante, Concluinte, Palestrante, Organizador, Coordenador e Monitor. Horas são numéricas e individuais. Para concluintes, `aprovado` deve ser `sim`, `true` ou `1`; a confirmação é de responsabilidade do operador.
- Até 500 autorizações por evento. Emita individualmente no painel ou compartilhe o link. O servidor determina nome, função, evento e horas pela lista autorizada.
- A prévia é ilustrativa. O PDF definitivo inclui Livro, Registro, QR Code e assinatura HMAC. O conteúdo programático gera páginas adicionais.
- Cursos aparecem no dashboard e nos relatórios após atualização do backend e sincronização pública. Para dados pessoais, autentique nos relatórios. A exportação de autorizações é distinta do relatório de emissões concluídas.

## Limites desta entrega

A administração usa a chave global já existente. Não há login próprio de cliente nem RBAC por cliente nesta versão; não forneça essa chave aos contratantes. Eles podem receber os links de emissão. O cadastro mantém o vínculo de cliente para uma futura área restrita.

Não inclui cobrança ou disparo de grandes lotes de e-mails em uma só execução. O importador cadastra autorizações; a emissão ocorre individualmente ou por autoatendimento. A entrega de e-mails usa o serviço já disponível no projeto (GmailApp), com suas quotas.

A prévia não substitui a conferência do PDF em um evento piloto. Testes locais cobrem autorização, horas, funções, conclusão, duplicatas e compatibilidade legada; execução de Slides, Drive, e-mail e implantação depende do ambiente Google.

## Edição após aprovação do cliente

Atualize `CursosEventos.gs` e publique nova versão da implantação existente. O botão **Editar evento / certificado** abre os dados cadastrados, lista de pessoas, identidade visual e período. Salvar mantém o mesmo link público e ID do evento. Há controle de revisão para impedir sobrescrita de edição em outra sessão.

Os PDFs já registrados não são modificados ao salvar. O sistema conserva a identidade anterior por código, inclusive para regeneração administrativa. Próximos certificados usam o evento atualizado. Um teste emitido formalmente continua sendo um registro real. Salvar a edição não reemite nem corrige automaticamente esse documento. Reenvios de um certificado existente mantêm o PDF original; seus registros não são apagados.
