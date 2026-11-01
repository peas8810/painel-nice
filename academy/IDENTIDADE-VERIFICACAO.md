# Selo de verificação Academy

Implementado em `/academy/identidade/`, ligado ao portal, às ferramentas e à gestão. Cada selo pertence ao titular de um certificado emitido. Confirma telefone por OTP, recebe selfie privada, registra aceite dos dados e permite conferência humana por SUPER_ADMIN (não pode conferir a própria identidade). Não realiza biometria ou prova de vida. Não comprova participação acadêmica. Coautores precisam de contas e certificados individuais; não há cadastro de vários titulares em um único certificado nesta versão.

O download gera uma cópia do certificado original com anexo do selo e QR público, após conferir SHA-256 do original. Não sobrescreve o PDF original, nem altera credenciais digitais anteriormente emitidas. O QR informa situação vigente e revogação. Foto, telefone, notas e OTP não são públicos. Alteração nos dados ou no hash do certificado invalida o selo. Para refazer: revogar e iniciar novamente.

## Ativação WhatsApp
Configurar somente nos secrets do Supabase:
- META_WHATSAPP_TOKEN e META_WHATSAPP_PHONE_NUMBER_ID (integração Meta Cloud API).
- META_GRAPH_VERSION: versão habilitada na conta, no formato vNN.N.
- ACADEMY_IDENTITY_TEMPLATE: template de autenticação aprovado em pt_BR, com botão copiar código e validade indicada de 5 minutos.
- ACADEMY_IDENTITY_OTP_SECRET: segredo aleatório de pelo menos 32 caracteres, exclusivo do módulo.

Não colocar secrets no GitHub, HTML ou chat. Sem essas configurações o envio falha fechado, com mensagem de indisponibilidade. O código tem seis dígitos gerados criptograficamente; somente HMAC é armazenado, vinculado ao selo. Validade 5 minutos, 5 tentativas, 60 segundos entre envios, no máximo 5 envios por selo e limite agregado de 10 por titular/telefone em registros enviados nas últimas 24h. Falha no provedor invalida o desafio. Nenhuma mensagem real foi enviada durante os testes.

## Privacidade e operação
Selfie JPEG de até 1 MB, enviada pelo servidor e armazenada em tabela com RLS e privilégios exclusivos do serviço. Retenção de 30 dias e exclusão horária pelo job academy-identity-retention. Revogação remove foto e telefone imediatamente do registro ativo; histórico e hash permanecem. A política de backups do projeto é independente da remoção da tabela ativa. O responsável visualiza fotos apenas enquanto vigentes; consultas são auditadas. O formulário exige autorização para envio e foto. Há orientação de atendimento assistido, mas não um canal de atendimento novo implementado.

## Validação
17 testes automatizados no total. Novos testes cobrem formato e vínculo do OTP, isolamento por conta, acesso administrativo, ausência de provedor, estados do selo e revogação. Limites e consumo de OTP são transacionais no PostgreSQL. Tabelas e privilégios foram conferidos no banco. Antes da ativação comercial: testar entrega real do template, câmera em iPhone/Android, rotina de revisão e download com certificado real. A mensagem de configuração detecta presença de secrets, não aprovação do template pela Meta.
