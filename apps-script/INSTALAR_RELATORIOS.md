# Relatórios e paginação — 30/09/2026

O frontend está em `/relatorios/`. A consulta pública, CSV e impressão para PDF usam os caches existentes e não exigem nova implantação. Projetos, eventos, certificados e tabelas de relatórios exibem 30 linhas por padrão, com opções de 50 e 80 e navegação Anterior/Próxima. Busca e exportação consideram todas as linhas disponíveis, não só a página atual.

## Dados completos administrativos

1. Adicione `RelatoriosSistema.gs` ao projeto Apps Script atual.
2. Substitua `CertificadosDashboard.gs` pela versão deste repositório.
3. Salve e atualize a implantação existente: Implantar → Gerenciar implantações → Editar → Nova versão → Implantar.
4. Abra `/relatorios/` e use **Dados administrativos**, com a mesma chave administrativa do dashboard.

A operação `cert_admin / reports` exige validação da chave no servidor antes de ler dados pessoais. Nome e e-mail não são adicionados ao cache público. A página administrativa conserva esses dados somente em memória e permite sair desse modo.

## Indicadores

- Um código de certificado é contado uma vez; isso não comprova participantes únicos.
- Emissão aberta considera o status cadastrado e o intervalo de emissão no momento da geração.
- Reemissões, PDFs, participantes únicos e entrega de e-mails não são inferidos a partir da tabela atual.
- O período usa a data da ação, do evento e de emissão, conforme a entidade. Linhas sem data ficam fora quando há filtro de período.
- O backend atualizado remove o limite de 1.000 certificados do dashboard e calcula totais sobre todos os registros. Até essa implantação, fontes antigas podem continuar limitadas. O relatório sinaliza limites conhecidos e falhas de atualização.
- Projetos ainda seguem o limite público existente de 500 registros. Para volumes maiores, será necessário paginar também a consulta e a sincronização no servidor.
- PDF: use **Imprimir / salvar PDF** e escolha Salvar como PDF no navegador. A impressão e o CSV incluem todas as linhas filtradas.
- Relatórios exibem código, instante de geração, filtros, datas das fontes e tipo de sessão; não criam um arquivo permanente nem um registro de auditoria no banco.
