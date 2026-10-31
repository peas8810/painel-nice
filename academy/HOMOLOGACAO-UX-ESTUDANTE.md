# Protocolo Academy — Pacote UX do estudante (30/10/2026)

## Recursos publicados
1. **Preenchimento assistido por IA**: botão após escolher PDF/JPG/PNG, confirmação explícita e Edge Function `academy-suggest-evidence`. São sugestões para o aluno conferir, nunca comprovação automática. Limite: 5 usos por estudante/dia. Requer `OPENAI_API_KEY` nos segredos do Supabase e teste de documento real.
2. **Câmera móvel**: campo de captura traseira, pré-visualização e opção entre imagem original ou recorte central com zoom. O arquivo segue para o mesmo upload privado da conta e protocolo.
3. **Rascunhos automáticos**: cópia remota por estudante no Supabase mais fallback local do navegador para conexões interrompidas. Apenas texto do formulário; nenhum PDF é armazenado em cache local. Em dispositivo compartilhado, recomenda-se limpar dados do site.
4. **Assistente**: dados da atividade → período, horas e descrição → revisão final; validações antes do envio. O protocolo usa o formulário original e segue as regras existentes.
5. **Duplicação**: cópia dos dados de protocolo, SEM copiar evidências, cobranças, aprovações ou certificados.
6. **Pendências**: indicação de protocolos sem documento ou aguardando complementação; ação encaminha ao upload correto.
7. **Pré-validação**: obrigatoriedade, datas, carga horária, tamanho/formato do comprovante e titularidade do protocolo.
8. **Mensagens de protocolo**: estudante e admin respondem no registro correto. RLS exige proprietário ou equipe admin autorizada. A fila de notificações registra novas mensagens para o destinatário.
9. **Carteira de certificados**: lista de certificados emitidos vinculados ao estudante, download por URL privada temporária e link de autenticidade.
10. **PWA**: manifest, ícone SVG, service worker com cache somente da interface estática; não armazena documentos privados, sessões ou API no cache.

## Testes técnicos efetuados
- Sintaxe dos arquivos JavaScript do portal, administração, Drive Picker e Service Worker aprovada.
- IDs únicos e quantidades equilibradas de formulários e seções HTML.
- Operações SQL de rascunho, mensagem e novo protocolo executadas em transações revertidas.
- A função `academy-suggest-evidence` foi implantada como ACTIVE com autenticação JWT.
- Permissões SQL dos novos registros reduzidas ao necessário, em conjunto com RLS.

## Homologação de usuário ainda necessária
- [ ] Cadastrar e editar protocolo com teclado móvel, validando navegação pelas 3 etapas.
- [ ] Testar desligar Wi-Fi, continuar o rascunho, reconectar e salvar.
- [ ] Fotografar documento, conferir original/recorte e verificar vínculo no painel administrativo.
- [ ] Duplicar protocolo e conferir que não copia evidências.
- [ ] Conferir central de pendências com um protocolo sem evidências.
- [ ] Enviar mensagem pela conta do aluno e responder na administração.
- [ ] Com conta com certificado emitido no sandbox, confirmar PDF e código de validação.
- [ ] Adicionar Academy à tela inicial em Android e iOS; verificar comportamento específico dos navegadores.
- [ ] Configurar `OPENAI_API_KEY` em Supabase Secrets; validar leitura de imagem e PDF, erros, limite diário, consentimento.
- [ ] Confirmar notificações pelo Resend e WhatsApp Business API com credenciais e templates válidos.

## Limites atuais
Estes recursos não substituem a homologação do pagamento Mercado Pago, emissão e autenticação de certificado, OAuth Google, Google Drive Picker e provedores de notificação. O PWA torna a interface estática acessível no cache, mas NÃO permite aprovar ou enviar protocolos sem conexão. IA não deve modificar dados sem conferência do estudante. A aplicação continua em homologação, sem habilitar cobrança comercial.
