# Produção histórica e vigência do relatório final

Toda formalização continua na produção e nas análises temáticas. A ausência de
documento final antes do marco institucional não é pendência retroativa. Artigos,
projetos e ações mantêm os tipos registrados; documentos de certificação não
representam novas ações, pessoas únicas ou benefícios comunitários medidos.

`protocolos/relatorios/politica-relatorios.json` guarda a data oficial de início da
obrigatoriedade (`effective_from`, ISO YYYY-MM-DD), sua referência e a política de
cancelamentos. Sem confirmação institucional, o valor permanece `null`: o sistema
exibe marco pendente e não inventa uma data. A configuração é relida pela página
e pela sincronização. O marco inclui a própria data de início.

O histórico recebeu a data original conciliada da formalização. Datas de importação,
IDs gerados posteriormente e o campo ano isolado não definem a coorte. Datas
desconhecidas ficam a verificar. O fuso de referência é America/Sao_Paulo.

A taxa de entrega considera somente formalizações do fluxo atual com prazo já
vencido. O dia do prazo permanece aberto. O numerador conta recebimentos confirmados
dentro desse mesmo conjunto. Testes e ações integralmente canceladas ficam fora
conforme a política. Prazos ausentes ou conflitantes são encaminhados para verificação.
Múltiplos IDs de uma origem não ampliam o denominador. Qualquer recebimento positivo
confirmado identifica a entrega da origem; ausência só é confirmada se todos os
IDs tiverem consulta negativa. Uma pendência desconhecida impede publicar a taxa
final desse conjunto; denominador vazio produz Não aplicável, nunca 0%.

Encerramento administrativo não prova recebimento do documento. O script
`scripts/sync_report_receipts.py` consulta o endpoint público `protocol`, conserva
apenas booleano e data de recebimento, data de verificação e chave técnica de
atualização. Links privados e contatos não são copiados. Falhas ou respostas
inconsistentes permanecem não apuradas, sem substituir erro por não entrega.

A verificação é incremental: até 12 consultas em paralelo limitado por execução.
Mudança de situação, data de origem ou prazo invalida a consulta anterior; a mesma
situação é revalidada no máximo a cada 24 horas. Consultas pendentes são distribuídas
entre execuções para não bloquear a atualização da lista pública. A fila pendente
permanece visível por meio de recebimentos não apurados. A configuração sem marco
não inicia consultas de exigibilidade presumida.

O quadro de certificação mantém somente AlfaUnipac. Se não houver vínculo no
recorte, mas existirem emissões ainda não atribuídas na fonte, a quantidade aparece
como Não apurado / vinculação pendente. Zero é reservado à fonte sem pendências
de vinculação. Contagens positivas são identificadas como confirmadas, sem prometer
cobertura integral de todas as emissões do curso.

Dashboard e PDF apresentam produção, documentação e cumprimento separadamente.
Percentuais de encerramento sobre todo o acervo foram retirados das comparações:
eles não são taxas de entrega nem medidas de qualidade de cursos históricos.
