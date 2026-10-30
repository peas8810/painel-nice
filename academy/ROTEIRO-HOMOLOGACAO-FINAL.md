# Protocolo Academy — roteiro de aceite final
Data: 30 de outubro de 2026
Estado: **CANDIDATO A HOMOLOGAÇÃO — NÃO LANÇADO COMERCIALMENTE**

## Correções desta revisão
- Corrigida colisão do nome `URL` na Edge Function Mercado Pago webhook (que impedia `new URL(req.url)`).
- `academy-checkout` utiliza **apenas** `sandbox_init_point`; nunca exibe `init_point` de pagamento real durante homologação.
- O filtro do e-mail aceita os hosts de sandbox do Mercado Pago.
- Certificados emitidos no sandbox recebem a inscrição **HOMOLOGACAO - SEM VALOR COMERCIAL**.
- Conferidas regras SUPER_ADMIN e TESTER no banco com transações `ROLLBACK`; TESTER não pode liberar pagamento.

## Inventário verificado
- Protocolos novos: 2; legados: 3.
- Evidências novas: 0; arquivos históricos arquivados: 2.
- Transferência dos 2 originais para bucket `academy-legado`: pendente.
- Liberações financeiras: 0; certificados novos: 0.
- Os dados de Sheets estão arquivados; não foram apagados.

## Configuração obrigatória antes de teste humano
No Supabase → Edge Functions → Secrets, sem colocar valores em código ou chat:
- `MP_ACCESS_TOKEN`: credencial de testes.
- `MP_WEBHOOK_SECRET`: segredo do webhook da conta de testes.
- `MP_COLLECTOR_ID`: identificador do vendedor da conta de testes.
- `ACADEMY_ENABLE_PAYMENTS=sandbox`.
- `RESEND_API_KEY`: chave privada.
- `ACADEMY_EMAIL_FROM`: e-mail do domínio validado.
- `ACADEMY_SIGNING_SECRET`: string aleatória de no mínimo 32 caracteres, persistente.
- `ACADEMY_ENABLE_ISSUANCE=sandbox`.

Registrar webhook Mercado Pago em `https://jufnkfyvqgkrxsbctqqk.supabase.co/functions/v1/academy-mp-webhook`.
**Não utilizar token e vendedor de produção para homologação**.

## Teste de uma pessoa (executar nesta ordem)
1. Abrir `https://www.protocolo.me/academy/portal/` em navegador incógnito e cadastrar estudante de teste.
2. Confirmar cadastro por e-mail, entrar, recuperar senha, validar que acesso sem autenticação não exibe registros.
3. Criar atividade **SIMULADA — HOMOLOGAÇÃO**, com período e carga horária de teste.
4. Enviar PDF de teste e tentar arquivo inválido/maior que 10 MB (deve recusar).
5. Entrar como `peas8810@gmail.com` em `/academy/admin/`.
6. Ver protocolo e documento; testar bloqueio de aprovação antes de validar; validar comprovante.
7. Aprovar com justificativa de pelo menos 15 caracteres e horas não maiores que as declaradas.
8. Liberar para etapa financeira e criar checkout **sandbox**.
9. Confirmar que e-mail só é enviado quando há link de checkout válido; testar recebimento.
10. Efetuar pagamento com conta/cartão de teste do provedor; conferir atualização pelo webhook **sem modificar status no banco manualmente**.
11. Usar **Emitir após confirmação**; conferir PDF com marca de homologação, dois QR Codes e dados do aluno.
12. Abrir `/academy/validar/?codigo=...` e relatório; testar código inválido.
13. Verificar que outro aluno não consegue acessar PDF ou documento privado.
14. Testar um estorno em sandbox e confirmar revogação do documento, se esse evento for suportado pela conta de testes.
15. Em `Configurações`, usar importação de legados, e conferir migração de 2 arquivos no Storage.
16. Exportar capturas ou logs de cada passo, com status PASSOU/FALHOU, sem compartilhar tokens.

## Critério de aceite
**GO** somente se: nenhum pagamento real for criado, fluxo sandbox de ponta a ponta passar, webhook e e-mails funcionarem, PDF e validação forem consistentes, e políticas RLS não permitirem acesso cruzado. Se falhar qualquer etapa, **NO-GO**.

## Fora de escopo do aceite atual
- Produção: exige credenciais próprias, política de taxas, termos finais, controles de retenção e nova revisão de segurança.
- Automação de segunda/terceira via ainda não implementada.
- A migração dos objetos de arquivo para Storage ainda depende da ação administrativa.
