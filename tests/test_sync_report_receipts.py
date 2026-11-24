import importlib.util
import datetime as dt
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('sync_receipts', Path(__file__).parents[1] / 'scripts/sync_report_receipts.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
NOW = dt.datetime(2026,11,24,15,tzinfo=dt.timezone.utc)
POLICY = {'effective_from':'2026-09-01'}

def project(i=1, **changes):
    row = {'id':f'NICE-2026-{i:05}', 'status':'PROTOCOLADO','data_protocolo':'2026-09-02T15:00:00Z','prazo_relatorio':'2026-10-01T03:00:00Z'}
    row.update(changes)
    return row

class ReceiptSyncTests(unittest.TestCase):
    def test_no_policy_or_legacy_or_open_deadline_is_not_assumed_pending(self):
        calls=[]
        def forbidden(*_):
            calls.append(True)
            raise AssertionError('No query expected')
        result = module.enrich({'projects':[project()]},{},{},'api',now=NOW,fetcher=forbidden)
        self.assertNotIn('relatorio_recebido',result['projects'][0])
        result = module.enrich({'projects':[project(data_protocolo='2025-01-01'),project(2,prazo_relatorio='2026-12-01')]},{},POLICY,'api',now=NOW,fetcher=forbidden)
        self.assertEqual(result['report_details']['verified'],0)
        self.assertEqual(calls,[]);self.assertEqual(result['report_details']['pending'],0)

    def test_actual_receipt_is_whitelisted_and_cached(self):
        calls=[]
        def fetch(*args):
            calls.append(args)
            return {'relatorio_recebido':True,'data_relatorio':'2026-10-03T12:00:00Z','private_url':'do-not-publish'}
        p=project(status='FINALIZADO')
        result=module.enrich({'projects':[p]},{},POLICY,'api',now=NOW,fetcher=fetch)
        received=result['projects'][0]
        self.assertTrue(received['relatorio_recebido']);self.assertNotIn('private_url',received)
        previous={'projects':result}
        result=module.enrich({'projects':[p]},previous,POLICY,'api',now=NOW,fetcher=fetch)
        self.assertEqual(len(calls),1);self.assertEqual(result['report_details']['verified'],1)

    def test_status_change_invalidates_an_old_negative_receipt(self):
        prior=module.enrich({'projects':[project()]},{},POLICY,'api',now=NOW,fetcher=lambda *_:{'relatorio_recebido':False,'data_relatorio':''})
        current=module.enrich({'projects':[project(status='FINALIZADO')]},{'projects':prior},POLICY,'api',now=NOW,fetcher=lambda *_:{'relatorio_recebido':True,'data_relatorio':'2026-11-24T12:00:00Z'})
        self.assertTrue(current['projects'][0]['relatorio_recebido'])

    def test_failure_leaves_unknown_instead_of_false(self):
        def fail(*_):
            raise OSError('Unavailable')
        result=module.enrich({'projects':[project(status='FINALIZADO')]},{},POLICY,'api',now=NOW,fetcher=fail)
        self.assertNotIn('relatorio_recebido',result['projects'][0]);self.assertEqual(result['report_details']['pending'],1)

    def test_budget_keeps_all_projects_and_rotates_pending_queries(self):
        raw={'projects':[project(i) for i in range(1,5)]}
        first=module.enrich(raw,{},POLICY,'api',now=NOW,budget=2,fetcher=lambda *_:{'relatorio_recebido':False,'data_relatorio':''})
        self.assertEqual(len(first['projects']),4);self.assertEqual(first['report_details']['verified'],2);self.assertEqual(first['report_details']['pending'],2)
        second=module.enrich(raw,{'projects':first},POLICY,'api',now=NOW,budget=2,fetcher=lambda *_:{'relatorio_recebido':False,'data_relatorio':''})
        self.assertEqual(second['report_details']['verified'],4);self.assertEqual(second['report_details']['pending'],0)

    def test_inconsistent_date_is_not_accepted_as_absence(self):
        result=module.enrich({'projects':[project()]},{},POLICY,'api',now=NOW,fetcher=lambda *_:{'relatorio_recebido':False,'data_relatorio':'invalid'})
        self.assertNotIn('relatorio_recebido',result['projects'][0]);self.assertEqual(result['report_details']['pending'],1)

if __name__ == '__main__':
    unittest.main()
