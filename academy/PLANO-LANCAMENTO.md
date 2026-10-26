# Protocolo Academy — Plano de lançamento (26/10/2026)

## Escopo
Sistema de documentação e verificação independente de atividades acadêmicas, com emissão de documento próprio da Editora UJN. Não implica reconhecimento pelo MEC nem aceitação obrigatória pela instituição destinatária.

## Bloqueadores para comercialização

### P0 — Identidade e segregação de dados
- [ ] Backend público separado da implantação administrativa existente
- [ ] Identidade individual e e-mail confirmado; autenticação segura e recuperação de acesso
- [ ] Cada pedido/documento acessível somente ao proprietário autorizado
- [ ] Controle de tentativas, limites por arquivo e proteção contra automação abusiva
- [ ] Política de privacidade, retenção e exclusão conforme requisitos legais
Critério: usuário A nunca lê nem altera dados/documentos de B; anônimo não acessa administração.

### P0 — Solicitação e análise
- [ ] Portal público grava solicitação com autorização por identidade
- [ ] Arquivo privado no Drive, verificações de MIME/conteúdo, tamanho, hash e quarentena
- [ ] Estados canônicos (RASCUNHO, EM_ANALISE, PENDENTE_DOCUMENTOS, APROVADO, REPROVADO)
- [ ] Parecer motivado e histórico imutável de alterações
- [ ] Pedido de complementação documental pelo aluno
Critério: fluxo completo de novo pedido, upload, correção e decisão testado com duas contas distintas.

### P0 — Pagamento
- [ ] Checkout Mercado Pago associado a pedido aprovado com referência única
- [ ] Confirmação autenticada por consulta de transação e vendedor, valor e moeda
- [ ] Tratar reembolso, chargeback, expiração, duplicidade e concorrência
- [ ] Preço primeira via R$ 15; segunda gratuita; terceira e seguintes R$ 50, com definições de reemissão e transparência
- [ ] Nenhuma emissão por simples retorno do navegador
Critério: matrizes de pagamento pendente/aprovado/estornado/bloqueado em sandbox.

### P0 — Certificado e relatório
- [ ] Documento definitivo em nome da Editora UJN, com ressalvas de alcance
- [ ] Livro digital e registro sequenciais não reutilizáveis
- [ ] PDF com identificação da atividade, carga horária comprovada e código público
- [ ] QR 1 autenticidade (código, assinatura, status, revogação)
- [ ] QR 2 relatório documental público sanitizado
- [ ] Assinatura HMAC em segredo protegido e verificação em backend
- [ ] Reemissão idempotente e revogação auditada
Critério: documento válido consultável em ambos QR; relatório jamais divulga comprovantes brutos.

### P1 — Operação
- [ ] E-mail transacional (confirmação de cadastro, exigência, decisão, cobrança, emissão)
- [ ] Exportação administrativa, trilhas de auditoria e indicadores com acesso restrito
- [ ] Termos, política de privacidade, canais de suporte e processo de contestação
- [ ] Acessibilidade, compatibilidade mobile e monitoramento de falhas

## Estratégia de implantação
1. Manter `/academy/` institucional e `/academy/admin/` como entrada privada.
2. Não tornar pública a implantação atual do Apps Script.
3. Criar autenticação do aluno e API pública separadas, mantendo a planilha como backend privado.
4. Homologar cadastro e revisão antes de ativar pagamentos.
5. Homologar sandbox antes de usar credenciais de produção.
6. Testar autenticação e autorização, fraude, documento, aprovação, estorno, QR, revogação e LGPD com dados fictícios.
7. Publicar inicialmente em lançamento controlado; ativar cobranças reais somente após aprovação dos gates.

## Evidências verificadas até aqui
A tela de homologação e o dashboard foram demonstrados funcionando; houve registro de alunos, pedidos, documentos e decisões. Nenhum certificado de produção ou pagamento aprovado foi comprovado. O portal estudantil segue sem autenticação e submissão públicas.
