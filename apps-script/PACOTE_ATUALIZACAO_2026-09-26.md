# PACOTE DE ATUALIZAÇÃO NICE — 26/09/2026

Este pacote consolida as alterações recentes que dependem do Google Apps Script e adiciona a busca de certificados por titular.

## 1. Arquivos do Apps Script que devem ser SUBSTITUÍDOS integralmente

Copie do GitHub e substitua todo o conteúdo dos arquivos correspondentes no projeto Apps Script:

- `SistemaNICE.gs`
- `CertificadosNICE.gs`
- `CertificadosCustomizados.gs`
- `CertificadosDashboard.gs`
- `CertificadosPublicos.gs`
- `CertificadosPublicPost.gs`
- `WebAppNICE.gs`

Não cole o código novo abaixo do antigo. Use Ctrl+A e substitua o conteúdo inteiro.

## 2. Arquivos NOVOS que devem ser criados no Apps Script

Crie estes arquivos com os mesmos nomes e copie o conteúdo integral:

- `CertificadosLivros.gs`
- `CertificadosBusca.gs`
- `PacoteAtualizacaoNICE.gs`

## 3. Alterações consolidadas neste pacote

### Protocolos
- identificação robusta do professor/responsável;
- rotina de reparo de responsáveis vazios;
- roteamento correto dos e-mails:
  - Para: professor/responsável;
  - Cc: coordenador, quando informado;
  - Bcc: coordenacaoensino@unipacto.com.br;
  - Reply-To: nice@unipacto.com.br;
- rastreabilidade do envio de e-mail na planilha.

### Certificados
- instituição emissora;
- QR Code ampliado e painel de validação reorganizado;
- cancelamento/revogação de certificado;
- período automático de abertura e encerramento de emissão;
- Livro Digital de Certificações;
- numeração sequencial de Livro e Registro por instituição;
- registro imutável, inclusive após revogação;
- SHA-256 do PDF;
- dashboard do Livro Digital;
- certificados customizados com livro/registro automáticos.

### Busca por titular
- gestão: pesquisa parcial por nome, protegida pela autenticação administrativa;
- público: página `/certificados/meus/`;
- o público informa o nome completo;
- se houver certificado, o sistema solicita o e-mail usado na emissão antes de revelar os detalhes;
- isso evita que terceiros pesquisem certificados de uma pessoa apenas sabendo o nome.

## 4. Aplicação do pacote

Depois de atualizar todos os arquivos:

1. Salve o projeto Apps Script.
2. Selecione a função:
   `aplicarPacoteAtualizacaoNICE`
3. Clique em **Executar**.
4. Autorize se o Google solicitar permissões.
5. Aguarde a mensagem final com o resultado das etapas.
6. Recarregue a planilha.

A rotina atualiza estruturas, reinstala gatilhos e tenta corrigir protocolos antigos sem responsável.

## 5. Publicação do Web App

Depois:

**Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**

Abra o endpoint de health e confirme:

```json
"version": "2.6"
```

## 6. Novas páginas

- Gestão de certificados:
  `https://www.protocolo.me/certificados/dashboard/`
- Consulta pessoal:
  `https://www.protocolo.me/certificados/meus/`
- Validação:
  `https://www.protocolo.me/certificados/validar/`

## 7. Observação de privacidade

A busca pública não exibe certificados apenas com o nome. O nome localiza possíveis registros; o e-mail usado na emissão confirma a identidade antes da apresentação dos certificados. A busca administrativa, por outro lado, permite nome parcial e exibe os registros aos gestores autenticados.
