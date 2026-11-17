"""Extract only public analytical fields from an uploaded NICE workbook.

Run with the primary runtime Python (openpyxl is used only for reading). Never
exports contacts, names, HMAC signatures, tokens, payment records or backups.
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path
from zoneinfo import ZoneInfo

def extract(path):
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    def rows(name):
        values = iter(wb[name].values)
        headers = next(values)
        return [dict(zip(headers, row)) for row in values if any(v is not None and str(v).strip() for v in row)]
    def clean(value):
        return re.sub(r'\b[^\s@]+@[^\s@]+\.[^\s@]+\b', '', str(value or '')).strip()[:300]
    def event_id(value):
        return str(int(float(value))).zfill(4) if value else ''
    book = rows('CERT_LIVRO_REGISTROS')
    issues = rows('CERT_EMISSOES')
    source_events = rows('CERT_EVENTOS')
    registered = {str(r.get('CODIGO_CERTIFICADO') or '').upper().strip() for r in book} - {''}
    certs = []
    for r in issues:
        code = str(r.get('CODIGO') or '').upper().strip()
        if not code:
            continue
        date = r.get('EMITIDO_EM')
        certs.append(dict(code=code, event_id=clean(r.get('CUSTOM_LINK_ID')) if r.get('TIPO_CERTIFICADO') == 'CUSTOMIZADO' else event_id(r.get('EVENTO_ID')),
                          status='REVOGADO' if r.get('REVOGADO_EM') else clean(r.get('STATUS')).upper(),
                          year=date.year if isinstance(date, (dt.date, dt.datetime)) else None,
                          registered=code in registered, institution=clean(r.get('INSTITUICAO_EMISSORA')) or 'Não informada'))
    events = [dict(id=event_id(r.get('EVENTO_ID')), protocol=clean(r.get('PROTOCOLO_NICE')),
                   title=clean(r.get('TITULO_EVENTO')), unit=clean(r.get('CAMPUS_UNIDADE')))
              for r in source_events if r.get('EVENTO_ID')]
    # An XLSX without core properties can receive a synthetic "modified now" on
    # load. Use observed source mutation dates, in the original Sheet timezone.
    changes = [r.get(key) for r in issues + book + source_events
               for key in ('EMITIDO_EM','ENVIADO_EM','REVOGADO_EM','CRIADO_EM','ATUALIZADO_EM')
               if isinstance(r.get(key), dt.datetime)]
    latest = max(changes).replace(tzinfo=ZoneInfo('America/Sao_Paulo')).astimezone(dt.timezone.utc) if changes else dt.datetime.now(dt.timezone.utc)
    stamp = latest.isoformat().replace('+00:00', 'Z')
    cert_codes = {c['code'] for c in certs}
    roles = {'Respostas ao formulário 1':'Formalizações já conciliadas', 'CONTROLE_NICE':'Identificadores e situação administrativa',
             'CERT_EMISSOES':'Emissões deduplicadas por código', 'CERT_EVENTOS':'Vínculo entre eventos de certificação e protocolos',
             'CERT_LIVRO_REGISTROS':'Escrituração das mesmas emissões, sem somar novamente',
             'CERT_LIVROS':'Cadastro de livros', 'CERT_INSTITUICOES':'Cadastro de instituições',
             'CERT_CURSOS_EVENTOS':'Cadastro de cursos e eventos', 'CERT_CURSOS_COTAS':'Controle de cotas, sem contar como ações ou pessoas',
             'CERT_CURSOS_COBRANCAS':'Controle financeiro, sem inferir benefício comunitário', 'CERT_LOTES':'Controle de lotes, sem somar novas emissões',
             'CERT_CUSTOM_LINKS':'Cadastro auxiliar; tokens e links privados não são publicados',
             'HISTORICO_NICE':'Histórico de alterações, sem somar novas ações', 'LOG_NICE':'Log técnico, sem somar novas ações',
             'CERT_LOG':'Log de certificação, sem somar novas emissões'}
    inventory = []
    for sheet in wb:
        data = iter(sheet.values)
        next(data, None)
        count = sum(any(v is not None and str(v).strip() for v in row) for row in data)
        role = roles.get(sheet.title, 'Backup não somado' if 'BACKUP' in sheet.title else 'Configuração e automação; valores privados não publicados')
        inventory.append(dict(sheet=sheet.title, rows=count, use=role))
    result = dict(version=1, source_file=path.name, updated_at=stamp,
                  protocol_source_check=dict(responses=len(rows('Respostas ao formulário 1')), identifiers=len(rows('CONTROLE_NICE'))),
                  source_book_records=len(book), source_book_unique_codes=len(registered),
                  book_unmatched_codes=sorted(registered-cert_codes),
                  inventory=inventory,
                  events=events, certificates=certs,
                  methodology='Deduplicação por código de certificado. Livro Digital e backup não são novas emissões. Curso somente por protocolo NICE completo e existente. Emissão não equivale a pessoa única nem ganho comunitário medido.')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = extract(args.input)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'certificate_rows':len(result['certificates']), 'event_rows':len(result['events']), 'book_records':result['source_book_records'], **result['protocol_source_check']}))
