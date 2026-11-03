# Central UJN — operação e ativação

## Acessos
- Usuários: https://www.protocolo.me/academy/atendimento/
- Equipe: https://www.protocolo.me/academy/central/
- Mesma conta do Academy. Administradores SUPER_ADMIN configuram canais, setores e permissões. Outros atendentes precisam de permissão por setor.

## O que está implementado
Cinco setores: revistas, auxílio à escrita, ArticleRun, certificados Academy e suporte. Conversas persistentes, formulários guiados com confirmação, recebimento privado de PDF/DOCX/JPG/PNG de até 10 MB, fila humana, assumir/transferir/encerrar/devolver ao robô, notas internas, controles de concorrência e trilha de auditoria. Os fluxos são versionados por conversa. O Academy reutiliza sua lógica de pedidos, regras, IA com consentimento, documentos, cobranças e certificados, sem remover bloqueios de homologação.

A lista da equipe mostra as 200 conversas mais recentes; as contagens referem-se a essa lista. O detalhe mostra as 100 mensagens mais recentes. Não é uma busca histórica completa. Polling de 10 segundos enquanto a aba está visível.

## Ativar WhatsApp
1. Abra Configurações da central com uma conta SUPER_ADMIN.
2. Cadastre nome do canal, ID do número, versão da Graph API informada pela Meta, token de acesso, App Secret e token de verificação. Salve inicialmente desativado.
3. Copie a URL gerada para o webhook da Meta, use o mesmo token de verificação e assine os eventos de mensagens.
4. Ative o canal e teste com o número de teste autorizado pela Meta: menu, seleção de setor, texto, documento, atendimento humano, reentrega do webhook e falhas.
5. No portal do usuário, gere VINCULAR e envie ao número oficial. O código expira em 10 minutos, a vinculação em 30 dias. DESconectar ou o botão do portal revogam a vinculação. Dados privados do Academy exigem essa vinculação.

As chaves ficam no Supabase Vault; nunca ficam no HTML ou retornam ao navegador. Cada canal tem credenciais próprias. O webhook verifica HMAC, número do canal e data do evento. A janela operacional é conservadora: 23 horas desde a última mensagem recebida pelo WhatsApp; mensagens do site não a reabrem.

O nome de template pode ser registrado, mas o disparo ativo por templates não está habilitado: depende do modelo aprovado, seus parâmetros e homologação. Fora da janela, o painel sinaliza a pendência e aguarda nova mensagem. Falhas têm até cinco tentativas, acionadas no painel ou ao receber nova mensagem; não há um agendador automático. Uma falha de rede após a aceitação pela Meta pode deixar o resultado incerto e causar repetição em nova tentativa; conferir a conversa antes de reenviar.

## ArticleRun
Recebimento de dados e arquivos na central funciona independentemente da API externa. O cadastro do endereço e documentação é somente uma referência; o conector permanece DISABLED. Não há endpoint de submissão presumido. É necessário confirmar URL oficial, autenticação, contrato de metadados/autores/arquivos, consentimentos, retorno do protocolo e idempotência. Somente uma resposta externa confirmada permitirá informar "submetido".

## Verificações
- Testes Node de fluxos, assinatura, autorização e regressão do Academy.
- Testes SQL com rollback: isolamento por setor, pausa do robô, idempotência e bloqueio dos RPCs/tabelas para navegador.
- Endpoint central exige sessão válida; webhook sem canal configurado fica indisponível.
- Arquivos são privados e acessados por links de cinco minutos após autorização.

## Antes da operação pública
Homologar o WhatsApp real e os templates; integrar ArticleRun; testar usuários e atendentes reais no celular e computador. A central não libera emissão comercial do Academy. Definir retenção operacional e exclusão dos novos históricos/arquivos, incluindo backups; não prometer a limpeza automática de 30 dias do chat Academy para esta nova central. Configurar monitoramento de falhas e responsável pelo atendimento.
