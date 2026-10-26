# Acesso de testes — Academy

- Página inicial: https://www.protocolo.me/academy/
- Portal do aluno (prévia sem persistência): https://www.protocolo.me/academy/portal/
- Entrada administrativa: https://www.protocolo.me/academy/admin/
- Modelo de certificado: https://www.protocolo.me/academy/modelos/certificado.html
- Painel administrativo real: no Apps Script privado, aberto por conta Google autorizada com o parâmetro `?view=dashboard`.

## Estado
A página pública e o portal do aluno são estáticos no GitHub Pages. Não há criação de conta, armazenamento de senha, envio de documentação ou autenticação por aluno. É intencional: não expor o Apps Script administrativo ao público antes de um backend com autenticação individual e autorização por proprietário da solicitação.

## Próximos blocos
- Backend de identidade separado do painel administrativo, com confirmação de e-mail, recuperação de senha, rate limiting e regras de privacidade.
- Rotas autenticadas de cadastro/solicitação/consulta e upload privado, sem acesso cruzado entre alunos.
- Integração do pagamento sandbox, relatório público sanitizado e PDF verificável.
- Testes ponta a ponta e autorização administrativa antes da ativação de dados reais.
