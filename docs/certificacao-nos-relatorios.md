# Enriquecimento pela planilha enviada em 17/11/2026

Atualização em 24/11/2026: dashboard e PDFs de cursos consideram exclusivamente
certificados cuja instituição emissora é AlfaUnipac. Emissões de terceiros e sem
instituição informada ficam fora dos totais, vínculos, correlações e quadros por
curso. A identificação é normalizada por caixa e espaços, sem reatribuir registros.
As contagens do inventário exibido também usam esse recorte; o arquivo original
permanece preservado como fonte. Os números abaixo documentam a auditoria original.

O arquivo `FORMALIZAÇÃO DE EVENTOS - AlfaUnipac (respostas) (2).xlsx` confirma as
329 respostas e os 368 IDs já reconciliados. A diferença de precisão dos carimbos
entre XLSX e Google Sheets é inferior a meio segundo; não representa novas ações.
Três datas de evento são textos com anos inconsistentes, preservados na origem e
não utilizados para inventar um novo período de formalização.

A nova fonte analítica inclui 998 códigos de emissão distintos: 997 com situação
ENVIADO ou ATIVO e um REVOGADO. O Livro Digital contém 929 lançamentos, sendo 927
códigos presentes no cadastro de emissões e dois sem correspondência nesse
cadastro. As linhas do livro e do backup não são somadas como emissões adicionais.
O inventário de todas as abas explica o uso de cada conjunto de dados, sem exportar
os valores de configurações, cobranças, cotas, logs ou cadastros privados.

A relação com curso e ação exige protocolo NICE completo e existente. Os vínculos
atuais identificam 260 emissões em três formalizações; 738 ficam no total geral,
sem atribuição forçada a cursos. Os resultados por curso e por ação distinguem
emissões vigentes, revogadas e referências de escrituração. O recorte respeita o
ano de protocolo da ação, conforme o filtro já existente, e não o ano de emissão
do certificado. Totais gerais da certificação são identificados como base completa.

Certificados não são pessoas únicas, atendimentos comprovados ou resultados
comunitários medidos. O número de certificados não é somado ao público previsto.
Os valores por curso podem se sobrepor em ações multicursos; o total geral usa
códigos distintos. A correlação de Spearman considera somente formalizações com
vínculo documental e estimativa válida, informando o tamanho da amostra e ND
quando não existe informação ou variação suficiente.

`scripts/import_certificate_evidence.py` lê o XLSX e extrai uma lista explícita de
campos analíticos para `protocolos/relatorios/certificacoes.json`. Nomes, e-mails,
assinaturas HMAC, tokens, URLs privadas e valores de cobrança não são publicados.
O arquivo original permanece preservado. Datas de última alteração observadas
nos registros, no fuso da planilha, orientam a comparação de fontes; propriedades
core ausentes do XLSX não são interpretadas como alteração na hora da extração.

`certificates.js` usa a fonte pública de certificação já sincronizada quando ela é
mais recente e preserva a cobertura do arquivo. As referências do Livro são
conciliadas por código. Fonte incompleta não substitui silenciosamente o inventário
mais completo. Uma fonte ausente aparece como ND, sem transformar falta de acesso
em zero emissões. Dashboard e PDF utilizam a mesma análise.

Validação: deduplicação, revogação, vinculação estrita, sobreposição multicursos,
filtros, atualização por cache, proteção contra fontes incompletas, campos públicos
permitidos, PDFs geral e de Farmácia e inventário de cobertura das abas.
