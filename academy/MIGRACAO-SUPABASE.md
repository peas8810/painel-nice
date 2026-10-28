# Migração operacional do Protocolo Academy para Supabase

## Arquitetura-alvo
- GitHub Pages: interface pública e administrativa.
- Supabase Auth + PostgreSQL + Storage: origem operacional única para novas solicitações, arquivos, decisões, status financeiros, trilha de auditoria e certificado.
- Mercado Pago: provedor de pagamentos (integração de produção pendente).
- Serviço de e-mail: fornecedor transacional ainda não configurado.
- Google Apps Script/Sheets/Drive: fonte histórica, sem aceitar NOVOS pedidos após conferência da migração.

## Executado
- Base de dados principal para solicitações, evidências, decisões, liberações, certificados e auditoria.
- Tabelas administrativas de migração: `academy_migration_batches`, `academy_legacy_evidence_index`, `academy_legacy_payments_index`.
- Página `academy/admin/` mostra conferência da migração e caracteriza o Apps Script como arquivo histórico.
- Código privado `AcademySincronizacaoLegado.gs` atualizado para importar índices históricos de comprovantes e pagamentos.
- Registros de teste continuam marcados como teste; não converter `PREFERENCE_CREATED` em `PAGO_CONFIRMADO`.

## Instalação mínima restante — no Apps Script privado
1. Atualize todo o arquivo `AcademySincronizacaoLegado.gs` com a versão no GitHub.
2. Confirme as propriedades secretas já usadas no projeto: `ACADEMY_SUPABASE_URL` e `ACADEMY_SUPABASE_SECRET_KEY`, sem revelar seu conteúdo.
3. Execute `academySincronizarProtocolosLegados()`, verifique contagem de pedidos.
4. Execute `academyMigrarIndicesHistoricos()`, verifique contagem de comprovantes e pagamentos.
5. Compare na administração as contagens com ALUNOS, SOLICITACOES, EVIDENCIAS, VALIDACOES, PAGAMENTOS e CERTIFICADOS; preserve exportação/backup dos dados originais.
6. NÃO apague Google Sheets, arquivos Drive, credenciais ou Apps Script. Essa exclusão é separada e só ocorre após migração verificável de binários, pareceres, PDFs e registros.

## Bloqueadores para desativar o Apps Script
- Cópia dos arquivos binários privados do Google Drive, com hash SHA-256 e controle de acesso por protocolo.
- Importação das validações e vínculos com usuários Supabase; não atribuir automaticamente identidades não verificadas.
- Importação de registros de pagamento como histórico, jamais confiar em status textual para habilitar emissão; reconciliar diretamente com Mercado Pago.
- Serviço backend protegido para criação de checkout e webhook de pagamento, com idempotência, verificação de vendedor e valor.
- Serviço de e-mail transacional com entrega/erros/reenvio.
- Gerador de PDF definitivo, código único, QR de autenticação, relatório sanitizado, revogação e acesso do titular.
- Homologação ponta-a-ponta em sandbox com duas contas de teste.
- Auditoria de segurança e privacidade, backup, recuperação, retenção e monitoramento.

## Situação atual
Supabase é o banco principal para pedidos NOVOS. A migração do legado é incremental e permanece não concluída enquanto `academy_legacy_protocols` e os índices históricos estiverem vazios. A emissão comercial e pagamentos reais devem permanecer bloqueados.
