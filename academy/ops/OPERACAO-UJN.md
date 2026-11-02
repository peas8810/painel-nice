# Operação UJN — 02/11/2026

Responsável institucional: administração da Editora Unified Journals Network - Ujn LTDA, CNPJ 53.275.018/0001-62. Atendimento: contato@ujn.ojsbr.com. Indicar nominalmente o titular e substituto operacional antes da abertura comercial; não foram cadastradas pessoas fictícias.

## Preparação de e-mail e WhatsApp

No painel `/academy/operacao/`, o administrador salva as configurações no Supabase Vault. Somente o servidor lê os valores; o navegador não os recupera. Os modos de produção e as chaves de infraestrutura continuam no painel protegido do Supabase.

E-mail: criar/verificar o domínio `ujn.ojsbr.com` no Resend, publicar exatamente os registros DNS fornecidos por ele, cadastrar `RESEND_API_KEY`, `ACADEMY_EMAIL_FROM=contato@ujn.ojsbr.com`, `RESEND_WEBHOOK_SECRET`. O webhook é `/functions/v1/academy-resend-receipts` no projeto Supabase. Não alterar MX da caixa existente sem revisar o serviço atual. Envio transacional não configura automaticamente recebimento de suporte ou SMTP de autenticação do Supabase. Para confirmação de conta e recuperação de senha, configurar separadamente o SMTP de Auth com host, porta, usuário, senha/app password e remetente do provedor. Não compartilhar a senha pessoal da caixa.

WhatsApp: cadastrar token da conta Business, ID do telefone (não o telefone em si), App Secret, verify token, versão suportada da Graph API, nome do template de autenticação aprovado em pt_BR, segredo aleatório de OTP com pelo menos 32 caracteres e prefixo dos templates transacionais. O webhook de recebimentos é `/functions/v1/academy-whatsapp-receipts`. O template do selo usa código no corpo e botão de autenticação; os demais templates devem corresponder ao mapa em `academy-dispatch-notifications`. Testar somente contatos consentidos e próprios na homologação.

IA: cadastrar chave da API OpenAI e opcionalmente `ACADEMY_AI_MODEL`. Assinatura ChatGPT não substitui credencial de API. O módulo envia os comprovantes privados para análise; verificar contrato, finalidade e política de retenção do provedor. Relatórios são preliminares e não autorizam emissão.

## Atendimento e incidentes

1. Administração consulta diariamente a fila de atendimentos e a fila de análises; avalia falhas de entrega no painel de Gestão.
2. Solicitações recebem identificador, motivo, resposta e histórico. Financeiro registra o encaminhamento de estornos no provedor; responder um atendimento não executa devolução financeira.
3. Em suspeita de acesso indevido, bloquear emissões e envios, revogar credenciais comprometidas, preservar evidências mínimas e verificar o alcance por instituição/conta. Não apagar trilhas para ocultar o incidente.
4. Responsável institucional coordena recuperação, comunicação e avaliação das obrigações legais. Registrar causa, contenção, recuperação e prevenção.
5. Monitoramento GitHub existente detecta indisponibilidade HTTP. Alertas de negócio, caixa de suporte e contatos substitutos exigem teste de entrega; salvar destinatário não comprova funcionamento.

## Governança de chaves

- Chaves de credenciais: ES256. A rotação pelo painel cria nova chave e remove a chave privada aposentada, preservando a pública para verificação.
- Como política operacional proposta, revisar acessos mensalmente e rotacionar a chave ativa no máximo a cada 90 dias, e imediatamente após suspeita de comprometimento. O painel não agenda automaticamente essa periodicidade.
- Revogação de chave invalida a consulta online de suas credenciais. Verificadores offline não recebem automaticamente o estado atualizado: precisam consultar o serviço ou uma política externa compatível.
- Não exportar chaves privadas para o repositório. Avaliar KMS/HSM para produção. Recuperação deve preservar chaves públicas históricas; diante de comprometimento ou incerteza, revogar a chave antiga e reemitir de forma rastreável, sem restaurar silenciosamente uma chave comprometida.
- O teste criptográfico independente existente não comprova compatibilidade com carteiras específicas. Selecionar os verificadores/car­teiras pretendidos e testar emissão, leitura e revogação antes de anunciar interoperabilidade.

## Backup e restauração

`backup.py` exporta banco pelo pg_dump e bytes dos buckets privados Academy, cria manifesto com SHA-256 e cifra o pacote com age. Credenciais entram apenas por ambiente protegido. É uma ferramenta preparada; nenhum backup real foi executado nesta entrega por ausência da conexão de backup e do destinatário criptográfico.

Pré-requisitos: acesso de leitura/exportação ao banco, chave service role protegida para Storage, ferramentas pg_dump e age, chave pública de backup e repositório externo cifrado com retenção definida. Não use diretório público, GitHub ou este repositório para dados exportados. A chave privada de recuperação deve ficar em custódia separada, com acesso restrito e substituto designado.

O script deve ser executado em janela sem gravações, pois banco e arquivos não formam um snapshot atômico. O dump inclui esquemas gerenciados; não aplicar cegamente pg_restore --clean em outro projeto Supabase. Seguir o procedimento de migração/restauração suportado pelo provedor, incluindo usuários, referências, RLS, roles e o tratamento especial de Vault e suas chaves.

Roteiro de restauração isolada:
1. Provisionar destino separado e confirmar que não é produção. Desativar pagamentos, emissão, webhooks, cron de mensagens e integrações de saída no destino.
2. Decifrar com age somente em ambiente restrito. Verificar o manifesto antes de importar; preservar permissões privadas.
3. Restaurar banco conforme procedimento Supabase, sem sessões de produção ativas; revisar URLs, funções, RLS e isolamento.
4. Recriar buckets privados e restaurar bytes, caminhos e metadados com propriedade correta. Backup só do banco não recupera arquivos.
5. Comparar quantidades e hashes, testar acesso autorizado/negado, abrir PDFs e anexos e consultar credenciais públicas. Confirmar que nenhum envio ou cobrança externa ocorreu.
6. Registrar duração, perda máxima de dados, resultado e responsável no painel de homologação. Só então aprovar a etapa `restore`.

Frequência inicial proposta: backup diário e ensaio trimestral. RPO de 24h e RTO de 8h são metas a validar no ensaio, não garantias atualmente comprovadas. A periodicidade não foi agendada sem destino e custódia definidos.

## Segurança e limitações

As tabelas de relatórios e atendimentos usam RLS sem acesso direto do cliente; RPCs específicas verificam usuário e papel. O leitor do Vault é exclusivo de service_role. As rotinas de alteração do cofre registram o nome da configuração, nunca seu valor.

O advisor reporta funções SECURITY DEFINER executáveis por autenticados; isso corresponde às APIs com autorização interna e exige revisão contínua. Não conceder SELECT geral para remover alertas de tabelas privadas sem políticas. A proteção contra senhas vazadas permanece pendente de ativação no Auth, conforme disponibilidade do plano: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection . Não foi declarada auditoria externa ou certificação de segurança.

## Evidência de lançamento

Testes reais pendentes: entrega e expiração de OTP Meta, selfie/câmera em aparelhos reais, envio/recebimento Resend, pagamento e estorno reais de sandbox Mercado Pago, carteira externa, restauração isolada, jornada ponta a ponta. Os testes automatizados usam dados sintéticos e rollback; não substituem homologação dos provedores. Nenhum checklist real foi aprovado automaticamente e a operação comercial permanece bloqueada.
