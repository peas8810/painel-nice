# Academy — seis módulos da visão de produto
Fonte: texto fornecido diretamente pela usuária em 31/10/2026. Requisitos de produto, não afirmações de funcionalidades concluídas.

## Objetivo
Plataforma inteligente de gestão acadêmica independente de marcas. Simplicidade Apple/Uber, segurança documental inspirada na Samsung, continuidade inspirada na Xiaomi e automação institucional inspirada na Microsoft. Não implica integração, certificação ou equivalência com produtos dessas marcas.

## Experiência do estudante
### Academy SecureDocs
Captura por câmera; identificação e ajuste da imagem; sugestões de dados; inconsistências encaminhadas à revisão humana. Hash criptográfico, histórico de alterações e responsáveis por análise. Pontuação interna de legibilidade/completude antes de enviar, sem tratar pontuação como prova de autenticidade.
Estado conhecido: câmera e sugestões documentadas; solução completa de qualidade/integridade/versionamento ainda não demonstrada.

### Academy Flow
Protocolo iniciado no computador; QR acessado pelo celular; captura anexada ao mesmo protocolo e atualização no computador. Android, iPhone, Windows e macOS. Aproveitar SafeDraft.
Estado conhecido: SafeDraft não constitui transferência entre dispositivos. Pareamento por QR e transferência ainda não implementados/verificados. Implementação deve validar titularidade, expiração e uso autorizado do vínculo.

## Inteligência institucional
### Academy Workflow — prioridade inicial
Regras por instituição; protocolo enviado; verificação assistida de preenchimento/documentos; consulta ao regulamento; análise preliminar ao avaliador; decisão humana.
Estado conhecido: estrutura de etapas, vínculo explícito de instituição, devolução/retomada, histórico e decisão acadêmica implementados nesta conversa. Testes técnicos passaram. Ainda faltam análise preliminar integrada ao regulamento, regras condicionais completas, gestão de equipes e homologação institucional de ponta a ponta.

### Academy Copilot
Consultar regulamento específico da instituição e explicar limites de horas, documentos e procedimentos, citando a regra aplicável. Não decidir aprovação.
Estado conhecido: sugestões de formulário não são Copilot institucional. Base de regulamentos com versão/vigência, recuperação, citações e avaliação das respostas permanecem pendentes.

## Confiança e interoperabilidade
### Academy Verified Credentials
Credencial digital assinada e verificável por sistemas externos, potencialmente utilizável em carteiras compatíveis. Representar fielmente o objeto certificado, sem presumir equivalência ou reconhecimento acadêmico.
Estado conhecido: PDF com QR/hash/HMAC não constitui credencial interoperável. Padrão, emissor, chaves, status/revogação e verificador independente precisam de implementação e testes.

### Academy Share
Link temporário para credencial ou documento autorizado, validade definida e revogação. Separar verificação pública de autenticidade do compartilhamento de documentos privados.
Estado conhecido: URL temporária de download próprio não constitui compartilhamento externo revogável. Serviço e interface específicos permanecem pendentes.

## Prioridade e lançamento
A usuária prioriza Workflow, com disponibilidade do site e testes de segurança como pré-requisitos.
Ordem de trabalho: concluir jornada base e homologar Workflow; evoluir SecureDocs/Flow/Share; implementar Copilot institucional e credenciais interoperáveis com testes próprios.
Essa ordem é uma proposta técnica de execução, não substitui os seis requisitos nem permite anunciar módulos incompletos como disponíveis.
Pagamentos, emissão e notificações exigem configuração e homologação externa. O texto não autoriza tratar a inspiração de marcas como conformidade de segurança comprovada.
