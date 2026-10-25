# Protocolo Academy — implementação

**Status:** interface de apresentação publicada. Formulário e modelo de atestado ainda não são serviço em produção.

## Backend complementar
O pacote `Protocolo-Academy-MVP-Backend.zip` preparado nesta conversa contém `AcademyCore.gs`, `AcademyApp.html` e instruções `INSTALAR.md`. Esse backend foi gerado fora do repositório e precisa ser instalado no projeto Apps Script vinculado à planilha.

A implantação deve incluir: armazenamento de evidências no Drive não público, identidade administrativa verificada, controles antiabuso e de privacidade, termos de uso e testes integrados. **Não publique formulário público nem ative pagamento real antes de completar essas condições.**

## Organização
- `/academy/index.html`: landing page pública (formulário visual desativado)
- `/academy/assets/style.css`: estilos
- `/academy/modelos/certificado.html`: documento demonstrativo **sem validade**
- Google Sheets: `ALUNOS`, `SOLICITACOES`, `EVIDENCIAS`, `VALIDACOES`, `PAGAMENTOS`, `CERTIFICADOS`, `AUDITORIA`, `CONFIGURACOES`.

## Próximos itens de produção
1. Instalar backend no Apps Script e configurar pasta privada no Drive.
2. Implantar identidade, privacidade, antispam, segurança e painel administrativo completo.
3. Validar conciliação com Mercado Pago e webhooks assinados.
4. Gerar atestados PDF com códigos únicos e duas verificações públicas, sem expor provas originais.
5. Integrar serviço de e-mail transacional confirmado (API v2 IAGENTEmail fornecida documenta contatos, não envio).
6. Homologar juridicamente redação e política comercial antes do lançamento.
