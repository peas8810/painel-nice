# Importação histórica do formulário de protocolos

Fonte: planilha `1midUEo4zaK2uyI_bJvD2NK2Efy1gYC0Ny_qHVJw_CVE`, aba
`Respostas ao formulário 1` (`gid=454925152`). Conferência em 17/11/2026.

- 329 respostas preenchidas na fonte; as demais linhas da grade estão vazias.
- 90 IDs existentes apontavam para 51 respostas de origem.
- Foram acrescentados 278 IDs: 37 de 2024, 169 de 2025 e 72 de 2026.
- Resultado: 368 IDs distintos e todas as 329 respostas com vínculo de origem.
- Os IDs, estados, valores preenchidos e vínculos dos 90 registros existentes foram preservados.

O destino operacional é `CONTROLE_NICE`. Os identificadores e links de relatório
foram gravados somente nos campos auxiliares das respostas ainda não vinculadas.
Nenhum formulário foi reenviado, pasta criada ou e-mail disparado pela importação.
Os novos registros recebem `PROTOCOLADO`; execução e encerramento não são inferidos
pela antiguidade ou pela presença de um PDF de formalização.

Os campos das 39 colunas da resposta original foram retidos no campo interno
`DADOS_ORIGINAIS_JSON`, inclusive descrições e referências documentais. Esse campo
não pertence à lista pública da API e não deve ser incluído em caches, commits ou
relatórios públicos. Contatos lançados equivocadamente em campos de título ou
responsável permanecem no original privado e são removidos dos campos públicos.

`scripts/plan_protocol_import.py` é um planejador sem acesso remoto. Recebe leituras
fundamentadas das duas abas e produz um plano privado de inclusão e preenchimento
de lacunas. A identidade usada é planilha + aba + linha de origem; múltiplos IDs
anteriores de uma origem são mantidos. O planejador bloqueia IDs de origem sem
destino, datas de protocolo ilegíveis e IDs de destino duplicados. A saída contém
dados privados e deve permanecer fora do repositório.

Antes de aplicar um plano, conferir novamente cabeçalhos, borda preenchida,
validações e destino vazio. A gravação desta importação foi atômica por lote
Sheets, com comparação posterior das 12.054 células gravadas e dos formatos de
data. Uma repetição do plano sobre os vínculos já importados não gera novos IDs.

O histórico analítico foi reconciliado com os novos IDs por linha de origem:
permanece com 1.571 formalizações distintas, agora vinculando os 368 IDs NICE.
Categorias históricas de curso e território não são substituídas por campos
inválidos ou vazios do formulário antigo. A lista pública usa a data de protocolo
para ordenar os registros, pois o número novo de uma importação não representa
uma submissão recente.

Os gatilhos de novos formulários e a sincronização pública existentes continuam
responsáveis pela entrada de novas submissões. O cache publicado nesta importação
foi obtido da API pública após confirmar os 368 registros; não foi reconstruído
a partir do campo privado de originais.

Validação: testes do planejador (idempotência, preservação de estados e valores,
origens órfãs, datas inválidas e separação de contatos), testes de reconciliação e
PDF de 2025 com vínculos importados.
