"""Plan a one-time import from grounded Sheets reads; never sends mail or writes remotely.

Input: {formal: {values: [...]}, control: {values: [...]}}. Output contains private
source fields: keep it outside the repository. Row identity is sheet + origin row,
not title, teacher or timestamp; existing NICE IDs and statuses are preserved.
"""
import argparse
import datetime as dt
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

SPREADSHEET = '1midUEo4zaK2uyI_bJvD2NK2Efy1gYC0Ny_qHVJw_CVE'
SHEET = 'Respostas ao formulário 1'
FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSei77aFurJhdDZmmrOPZRAssw5OS9NOoT5xRGK8JwRMxxSlTg/viewform?usp=pp_url&entry.1008124819='
RAW = 'DADOS_ORIGINAIS_JSON'
DATE_FIELDS = {'DATA_PROTOCOLO', 'DATA_INICIO', 'DATA_FIM', 'PRAZO_RELATORIO', 'ULTIMA_ATUALIZACAO'}

def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFD', str(value or '')) if not unicodedata.combining(c)).lower().strip()

def date(value):
    if not value:
        return None
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
        try:
            return dt.datetime.strptime(str(value).strip(), fmt)
        except ValueError:
            pass
    return None

def serial(value):
    return (value - dt.datetime(1899, 12, 30)).total_seconds() / 86400 if value else ''

def estimate(value):
    text = str(value or '').strip().replace('.', '').replace(',', '.')
    return int(round(float(text))) if re.fullmatch(r'\d+(?:\.\d+)?', text) else ''

def public_text(value):
    # Misplaced contacts remain in the private original, not in public card fields.
    return re.sub(r'\b[^\s@]+@[^\s@]+\.[^\s@]+\b', '', str(value or '')).strip()

def modality(value):
    text = norm(value)
    online = bool(re.search(r'ead|online|on.line|remot|virtual', text))
    onsite = 'presencia' in text
    return 'Híbrido' if online and onsite else 'On-line' if online else 'Presencial' if onsite else 'Não informado'

def plan(payload, now=None):
    formal, original = payload['formal']['values'], payload['control']['values']
    assert formal[0][0] == 'Carimbo de data/hora' and formal[0][29] == 'ID_NICE', 'Unexpected source schema'
    headers = list(original[0])
    if RAW not in headers:
        headers.append(RAW)
    before = [{key: (r[i] if i < len(r) else '') for i, key in enumerate(original[0])} for r in original[1:]]
    rows = [dict(r) for r in before]
    by_origin, used, sequence = defaultdict(list), set(), defaultdict(int)
    for index, row in enumerate(rows):
        id_ = row['ID_NICE']
        assert id_ not in used, 'Duplicate destination identifier'
        used.add(id_)
        match = re.fullmatch(r'NICE-(\d{4})-(\d{5})', id_)
        assert match, 'Invalid destination identifier'
        year, n = map(int, match.groups())
        sequence[year] = max(sequence[year], n)
        if row.get('PLANILHA_ORIGEM') == SPREADSHEET and row.get('ABA_ORIGEM') == SHEET:
            by_origin[int(row['LINHA_ORIGEM'])].append(index)
    markers, origin_map, added = [], {}, []
    now = now or dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).replace(tzinfo=None)
    for source_row, raw in enumerate(formal[1:], 2):
        if not any(str(x or '').strip() for x in raw):
            continue
        v = list(raw) + [''] * max(0, len(formal[0]) - len(raw))
        stamp = date(v[0])
        assert stamp, f'Unrecognized timestamp at source row {source_row}'
        start, end = date(v[18]), date(v[19])
        end = end or start
        planned = estimate(v[8])
        audience = norm(v[9])
        internal = bool(re.search(r'academ|alun|docent|discente|estudante', audience))
        external = bool(re.search(r'comunidade|extern|publico geral|populacao', audience))
        values = dict(DATA_PROTOCOLO=serial(stamp), TIPO_ACAO=v[1], CURSO=v[7],
                      UNIDADE=v[5] if norm(v[5]) not in ('sim', 'nao') else '', AUDITORIO=v[4],
                      RESPONSAVEL=v[13], EMAIL=v[14], TITULO_ACAO=v[12] or v[1],
                      DATA_INICIO=serial(start), DATA_FIM=serial(end),
                      PRAZO_RELATORIO=serial(end + dt.timedelta(days=10)) if end else '',
                      MODALIDADE=modality(v[6]),
                      ALCANCE='Misto (interno + externo)' if internal and external else 'Interno/acadêmico' if internal else 'Externo/comunidade' if external else 'Não identificado',
                      PUBLICO_ESTIMADO=planned, PARCERIA=v[21], CERTIFICADOS=v[3], TEMA=v[12],
                      LINK_PROTOCOLO=v[26], PLANILHA_ORIGEM=SPREADSHEET, ABA_ORIGEM=SHEET,
                      LINHA_ORIGEM=source_row)
        for key in ('TIPO_ACAO', 'CURSO', 'UNIDADE', 'AUDITORIO', 'RESPONSAVEL', 'TITULO_ACAO', 'TEMA', 'PARCERIA', 'CERTIFICADOS'):
            values[key] = public_text(values[key])
        raw_json = json.dumps(dict(zip(formal[0], v)), ensure_ascii=False, separators=(',', ':'))
        assert len(raw_json) < 50000, f'Original fields exceed cell limit at source row {source_row}'
        matches = by_origin[source_row]
        if not matches:
            assert not v[29], f'Source ID has no destination at row {source_row}; reconcile before importing'
            sequence[stamp.year] += 1
            id_ = f'NICE-{stamp.year}-{sequence[stamp.year]:05}'
            assert id_ not in used
            used.add(id_)
            record = {h: '' for h in headers}
            record.update(values, ID_NICE=id_, STATUS='PROTOCOLADO', ENCERRADO='NAO',
                          LINK_FORM_RELATORIO=FORM + id_, ULTIMA_ATUALIZACAO=serial(now),
                          OBSERVACOES='Importação histórica da resposta original. Situação de execução não inferida; sem reenvio de e-mails.')
            record[RAW] = raw_json
            rows.append(record)
            added.append(record)
            by_origin[source_row].append(len(rows) - 1)
            markers.append({'row': source_row, 'id': id_, 'status': 'PROTOCOLADO', 'report_url': FORM + id_})
        else:
            for index in matches:
                record = rows[index]
                for key, value in values.items():
                    if record.get(key, '') in ('', None) and value not in ('', None):
                        record[key] = value
                record[RAW] = raw_json
        origin_map[str(source_row)] = [rows[index]['ID_NICE'] for index in by_origin[source_row]]
    assert len(used) == len(rows)
    return {'headers': headers, 'before': before, 'rows': rows, 'added': added,
            'markers': markers, 'origin_map': origin_map,
            'stats': {'source_responses': len(origin_map), 'previous_ids': len(before),
                      'new_ids': len(added), 'total_ids': len(rows),
                      'all_origins_linked': len(by_origin) == len(origin_map)}}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = plan(json.loads(args.input.read_text()))
    args.output.write_text(json.dumps(result, ensure_ascii=False))
    print(json.dumps(result['stats']))
