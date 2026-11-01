# Entrega de 1 de novembro de 2026

## Implementado nesta entrega
- Navegação compartilhada nas rotas principais, com atalhos administrativos conforme papel.
- Cadastro da UJN e modelo inicial de três etapas, desativado até a definição da equipe.
- Workflow com responsável por papel ou pessoa, condições por horas/tipo e versão imutável após uso. Primeira e última etapas humanas obrigatórias.
- Painel de avaliações com documentos privados, pareceres, complementação, retomada, histórico e revisão concorrente protegida.
- Operação: diagnóstico de configuração sem revelar segredos, registro de homologação e governança de chaves.
- Produção preparada com bloqueio explícito: ambiente production, liberação approved e dez testes registrados. Não foi ativada cobrança real.
- Webhook rejeita pagamento de ambiente diferente; reconciliação idempotente e proteção contra substituição por outro pagamento. Estorno revoga certificado.
- Rotação de chave mantém chave pública antiga e remove material privado aposentado. Revogação invalida verificações online. Isso não equivale a KMS/HSM nem comprova aceitação em carteira externa.
- Correção de exposição RPC de cinco funções internas de trigger. Funções de acesso autenticado continuam com autorização interna; os alertas não podem ser tratados como todos resolvidos.
- Política de privacidade atualizada com selfie, retenção e provedores efetivamente implementados, ainda preliminar.
- Monitoramento periódico das rotas via GitHub Actions. Alertas dependem das preferências de notificações do GitHub; não é monitoramento completo do backend.

## Testes executados
29 testes Node passaram, incluindo preflight do navegador em oito funções e fluxo simulado de convite por e-mail. Uma credencial sintética assinada pelo código do Academy foi verificada independentemente com Python cryptography, incluindo rejeição de adulteração; isso não comprova compatibilidade com carteiras digitais. Testes transacionais no banco, com rollback, validaram encaminhamento condicional, isolamento por instituição, impedimento de autoanálise, bloqueio de revisão desatualizada e ausência de aprovação automática. Outro teste transacional validou ambientes de pagamento, notificação repetida, pagamento alternativo e estorno sem reativação por evento antigo. Nenhuma cobrança ou mensagem externa foi realizada nesses testes.

Também foram corrigidos cabeçalhos CORS para o SDK do navegador, o escopo da variável do trabalho de e-mail e o conflito com o construtor URL no envio de convites.

## Dependências reais que permanecem
1. Configurar provedores pelos painéis e provar entrega/recebimento com a conta de teste do responsável. Ter conta no provedor não significa que os secrets deste projeto estejam configurados.
2. Confirmar regulamento oficial da UJN, categorias, critérios documentais, prazos, valores e procedimentos de contestação/reembolso. Não foram inventados limites de horas nem publicado regulamento universitário.
3. Informar identificação jurídica, endereço e canal de suporte/privacidade para concluir termos e política.
4. Executar câmera/OTP/Flow em aparelhos reais e registrar resultados em Operação.
5. Homologar pagamentos de teste e emissão com o provedor. Depois testar a configuração de produção com procedimento controlado.
6. Verificar assinatura em implementação externa e definir guarda de chaves apropriada ao risco.
7. Habilitar proteção contra senhas vazadas no Supabase Auth, quando disponível no plano, e finalizar revisão de RPCs autenticadas.
8. Preparar cópia separada do Storage e executar restauração em ambiente isolado. O backup do Postgres não contém os bytes dos arquivos do Storage. Não foi efetuada restauração sobre produção nem criado backup que possa ser afirmado como recuperável.

## Restauração e resposta a incidentes
- Registrar frequência, retenção, responsável e destino protegido de banco e Storage. Não guardar dumps com dados pessoais no GitHub.
- Exportar banco conforme método suportado pelo plano; copiar objetos privados para destino protegido, preservando bucket, caminho e hash. Registrar manifesto sem conteúdo sensível em lugar público.
- Restaurar em projeto isolado com envios, pagamentos e cron desativados; restaurar Storage separadamente; conferir contagens, hashes e acesso por perfil.
- Registrar tempo de restauração, dados mais recentes recuperados, erros e evidência no item restore. Somente marcar aprovado após executar o ensaio.
- Em incidente: suspender emissão/checkout pelos modos disabled, preservar registros, revogar chaves comprometidas e acompanhar credenciais afetadas. Rotacionar segredos nos provedores e no Supabase, sem colocá-los no chat.

Fontes técnicas: https://supabase.com/docs/guides/platform/backups e https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications

## Continuação da revisão de segurança
- Corrigida a revisão de comprovantes no painel institucional: VALIDADO exige arquivo no bucket privado, propriedade correspondente, formato permitido e tamanho entre 1 byte e 10 MB. A conferência usa os metadados do Storage; não equivale a verificar autenticidade do conteúdo.
- Teste transacional de encaminhamento passou também com tentativa de validar arquivo ausente, seguida de metadados de teste válidos. Todas as alterações fictícias foram desfeitas por rollback.
- Teste de autorização chamou 21 rotinas administrativas com uma conta comum fictícia; nenhuma devolveu dados nem permitiu operação administrativa. Isso testa suas verificações de identidade e papel com argumentos nulos; não representa cobertura exaustiva de todas as entradas ou uma auditoria externa.
- A solicitação de autenticação no painel Supabase foi bloqueada pela revisão automática por limite de uso do ambiente, antes de abrir formulário. A configuração de provedores e os testes reais permanecem pendentes. Não foram coletadas senhas nem tokens pelo chat.
