"""Incrementally verify final-report receipt through the existing public protocol API.

No private document URLs or contacts are retained. An unavailable source leaves
receipt unknown. Administrative FINALIZADO alone is not treated as proof of receipt.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

FIELDS = ('relatorio_recebido', 'data_relatorio', 'relatorio_verificacao_status',
          'relatorio_verificado_em', 'relatorio_fingerprint', 'relatorio_tentativa_em')

def day(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        if len(value) == 10:
            parsed = dt.date.fromisoformat(value)
            return parsed.isoformat() if 1900 <= parsed.year <= 2100 else None
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo:
            parsed = parsed.astimezone(ZoneInfo('America/Sao_Paulo'))
        return parsed.date().isoformat() if 1900 <= parsed.year <= 2100 else None
    except ValueError:
        return None

def fingerprint(project):
    return json.dumps([project.get(k, '') for k in ('id','status','data_protocolo','prazo_relatorio')], separators=(',', ':'))

def fetch_protocol(api, protocol):
    url = api + '?' + urllib.parse.urlencode({'action':'protocol','id':protocol})
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.load(response)
    result = data.get('protocol')
    if data.get('ok') is not True or not isinstance(result, dict) or result.get('id') != protocol:
        raise ValueError('Invalid protocol response')
    received = result.get('relatorio_recebido')
    report_date = result.get('data_relatorio') or ''
    if not isinstance(received, bool) or (report_date and not day(report_date)) or received != bool(day(report_date)):
        raise ValueError('Receipt and date are inconsistent')
    return {'relatorio_recebido':received, 'data_relatorio':report_date}

def enrich(projects, previous, policy, api, now=None, fetcher=fetch_protocol, budget=12):
    now = now or dt.datetime.now(dt.timezone.utc)
    today = now.astimezone(ZoneInfo('America/Sao_Paulo')).date().isoformat()
    cutoff = day(policy.get('effective_from'))
    old = {p['id']:p for p in previous.get('projects', {}).get('projects', [])}
    result = dict(projects)
    result['projects'] = [dict(p) for p in projects.get('projects', [])]
    candidates, verified = [], 0
    for project in result['projects']:
        original, deadline = day(project.get('data_protocolo')), day(project.get('prazo_relatorio'))
        for key in FIELDS:
            project.pop(key, None)
        relevant = cutoff and original and original >= cutoff and project.get('status') != 'CANCELADO' and (
            (deadline and deadline < today) or project.get('status') in ('FINALIZADO','RELATORIO_RECEBIDO'))
        if not relevant:
            continue
        prior = old.get(project['id'], {})
        try:
            age = (now-dt.datetime.fromisoformat(prior['relatorio_verificado_em'].replace('Z','+00:00'))).total_seconds()
        except (KeyError, ValueError, TypeError, AttributeError):
            age = float('inf')
        if 0 <= age < 86400 and prior.get('relatorio_fingerprint') == fingerprint(project) and prior.get('relatorio_verificacao_status') == 'confirmado':
            project.update({key:prior[key] for key in FIELDS if key in prior})
            verified += 1
        else:
            candidates.append(project)
    candidates.sort(key=lambda p:(old.get(p['id'],{}).get('relatorio_tentativa_em') or '',p.get('status') not in ('FINALIZADO','RELATORIO_RECEBIDO'),p.get('prazo_relatorio') or '',p['id']))
    def verify(project):
        try:
            value = fetcher(api, project['id'])
            if not isinstance(value.get('relatorio_recebido'), bool) or (value.get('data_relatorio') and not day(value['data_relatorio'])) or value['relatorio_recebido'] != bool(day(value.get('data_relatorio'))):
                raise ValueError('Invalid receipt')
            return project, value
        except Exception:
            return project, None
    stamp = now.isoformat().replace('+00:00','Z')
    failed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for project, value in pool.map(verify, candidates[:max(0,budget)]):
            project['relatorio_tentativa_em'] = stamp
            if value is None:
                failed += 1
                continue
            project.update(relatorio_recebido=value['relatorio_recebido'], data_relatorio=value.get('data_relatorio') or '', relatorio_verificacao_status='confirmado',
                           relatorio_verificado_em=stamp, relatorio_fingerprint=fingerprint(project))
            verified += 1
    result['report_details'] = {'effective_from':cutoff,'checked_at':stamp,'verified':verified,
                               'pending':len(candidates)-min(len(candidates),max(0,budget))+failed,
                               'policy_configured':bool(cutoff)}
    result['public_fields'] = sorted(set(result.get('public_fields', [])) | set(FIELDS))
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--projects', type=Path, required=True)
    parser.add_argument('--previous', type=Path, required=True)
    parser.add_argument('--policy', type=Path, required=True)
    parser.add_argument('--api', required=True)
    args = parser.parse_args()
    projects = json.loads(args.projects.read_text())
    previous = json.loads(args.previous.read_text()) if args.previous.exists() else {}
    policy = json.loads(args.policy.read_text())
    result = enrich(projects, previous, policy, args.api)
    args.projects.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps(result['report_details']))
