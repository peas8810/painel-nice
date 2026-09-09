# NICE · Inteligência Institucional de Extensão e Eventos

Sistema web do NICE / AlfaUnipac para acompanhamento de extensão, eventos, inteligência institucional, inteligência documental e gestão do ciclo de protocolos.

## Módulos publicados

### Painel Institucional

- indicadores históricos 2021–2026;
- filtros por ano, curso, tipo, modalidade, unidade/campus e alcance;
- Índice de Efetividade Extensionista (IEE);
- acompanhamento documental;
- tendências e perfis institucionais;
- Inteligência Documental com classificação temática, ODS potenciais, qualidade documental, similaridade e correspondência protocolo ↔ relatório.

URL permanente:

`https://peas8810.github.io/painel-nice/atual/`

### Sistema NICE de Protocolos

Portal operacional para o novo ciclo:

**Formalização → Protocolo NICE → Análise → Realização → Relatório Final → Encerramento**

Recursos:

- acesso ao formulário de formalização;
- acesso ao formulário de relatório final;
- consulta pública pelo identificador `NICE-AAAA-00000`;
- indicadores de chamados abertos, aguardando relatório, atrasados e finalizados;
- integração com Google Apps Script, Google Sheets e Google Drive;
- camada pública sanitizada, sem nomes, e-mails ou links internos do Drive.

URL:

`https://peas8810.github.io/painel-nice/protocolos/`

## Arquitetura

```text
Google Forms
   ↓
Google Sheets
   ↓
Google Apps Script
   ├── ID NICE
   ├── status
   ├── prazos
   ├── vínculo protocolo ↔ relatório
   └── organização do Google Drive
          ↓
GitHub Pages
   ├── Painel Institucional
   └── Portal de Protocolos
```

O GitHub Pages funciona como interface pública. Dados pessoais, controle administrativo e documentos permanecem no ambiente Google institucional.

## Backend

O código do backend está em `apps-script/`.

Consulte `apps-script/README.md` para instalação e publicação da API utilizada pelo portal.
