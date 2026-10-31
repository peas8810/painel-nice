# Módulos — entrega de homologação

## Implementação
- SecureDocs: conferência técnica de imagem (contraste, luminosidade e detalhes), giro, checklist humano, upload, SHA-256 calculado no servidor sobre bytes do Storage e histórico de revisão. A pontuação não certifica autenticidade nem completude.
- Flow: QR gerado no servidor, vínculo de 15 minutos, mesma conta nos dois aparelhos, revogação e atualização periódica dos documentos no computador.
- Share: links com validade de 1 a 168 horas, token de 256 bits armazenado somente como hash, revogação e download intermediado pelo servidor. Revogação não recolhe cópias já baixadas.
- Copilot: consulta determinística a cláusulas institucionais publicadas, vigência, categoria, limite numérico e citação integral da fonte/versão. Não é um agente conversacional generativo. Sem regra, informa ausência; não aprova horas.
- Gestão: cadastro/remoção de membros, publicação/retirada de cláusulas e análise preliminar de documentos/regras para superadministrador. Fluxos condicionais avançados e painel próprio dos avaliadores continuam pendentes.
- Verified Credentials: exportação JWS ES256 com payload VC 2.0, chave pública consultável, verificação de assinatura, situação do certificado e revogação. Somente certificados emitidos, aprovados, com pagamento vigente e integridade confirmada. Homologação; aceitação em carteiras externas não testada. Chave privada protegida por acesso exclusivamente de serviço no banco; não equivale a KMS/HSM dedicado.
- Correção no verificador público: variável de configuração não sobrepõe o construtor URL.

## Rotas
- /academy/modules/ — estudante autenticado.
- /academy/share/ — recebimento por token e verificação de credencial.
- /academy/gestao/ — equipes, regulamentos e análise preliminar.

## Verificação
12 testes automatizados passaram, incluindo mocks de API para propriedade, revogação, expiração e isolamento; assinatura verificada criptograficamente e adulteração rejeitada. HTML/JS/MJS validados. Sete tabelas novas verificadas com RLS e sem SELECT de anon/authenticated. Serviço academy-modules publicado; autenticação e autorização são verificadas dentro da função. Isso não substitui homologação com contas e dispositivos reais.

## Pendências para produção
Jornada real em iPhone/Android/computador, testes de provedores de pagamento/notificação, dados oficiais de regulamentos, interoperabilidade externa de credenciais, governança de chaves, automatização condicional avançada e experiência completa por papel institucional. Não anunciar todos os requisitos originais como concluídos. Não houve envio de mensagens externas nem cobrança nos testes.
