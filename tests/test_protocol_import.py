import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('protocol_import', Path(__file__).parents[1] / 'scripts/plan_protocol_import.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ProtocolImportTests(unittest.TestCase):
    def fixture(self):
        headers = ['ID_NICE', 'STATUS', 'PLANILHA_ORIGEM', 'ABA_ORIGEM', 'LINHA_ORIGEM', 'CURSO', 'DATA_PROTOCOLO', 'PUBLICO_ESTIMADO', 'LINK_PROTOCOLO']
        form_headers = [f'field_{i}' for i in range(39)]
        form_headers[0], form_headers[29] = 'Carimbo de data/hora', 'ID_NICE'
        first = [''] * 39
        for i, value in {0:'01/10/2026 10:00:00', 1:'Palestra', 5:'Teófilo Otoni', 6:'Cursos Presenciais', 7:'Farmácia', 8:'100', 12:'Uso responsável de medicamentos', 18:'10/10/2026', 19:'11/10/2026', 26:'https://drive.google.com/file/d/existing/view', 29:'NICE-2026-00002'}.items():
            first[i] = value
        older = list(first)
        older[0], older[8], older[29] = '20/12/2025 09:15:00', 'não informado', ''
        return {'formal':{'values':[form_headers,first,older]}, 'control':{'values':[headers,
            ['NICE-2026-00001','FINALIZADO',module.SPREADSHEET,module.SHEET,2,'Farmácia','01/10/2026 10:00:00',50,''],
            ['NICE-2026-00002','PROTOCOLADO',module.SPREADSHEET,module.SHEET,2,'Farmácia','01/10/2026 10:00:00','','']]}}

    def test_origin_deduplicates_and_existing_values_survive(self):
        p = module.plan(self.fixture())
        self.assertEqual(p['stats']['new_ids'],1)
        self.assertEqual(p['origin_map']['2'],['NICE-2026-00001','NICE-2026-00002'])
        self.assertEqual(p['rows'][0]['STATUS'],'FINALIZADO')
        self.assertEqual(p['rows'][0]['PUBLICO_ESTIMADO'],50)
        self.assertEqual(p['rows'][1]['PUBLICO_ESTIMADO'],100)
        self.assertEqual(p['added'][0]['ID_NICE'],'NICE-2025-00001')
        self.assertEqual(p['added'][0]['PUBLICO_ESTIMADO'],'')
        self.assertIn('field_26',p['added'][0][module.RAW])

    def test_repeated_import_adds_no_rows(self):
        fixture = self.fixture()
        p = module.plan(fixture)
        fixture['control']['values'] = [p['headers']] + [[r.get(h,'') for h in p['headers']] for r in p['rows']]
        for marker in p['markers']:
            fixture['formal']['values'][marker['row']-1][29] = marker['id']
        again = module.plan(fixture)
        self.assertEqual(again['stats']['new_ids'],0)
        self.assertEqual(again['stats']['total_ids'],3)

    def test_orphan_source_identifier_blocks_import(self):
        fixture = self.fixture()
        fixture['formal']['values'][2][29] = 'NICE-2025-00099'
        with self.assertRaisesRegex(AssertionError,'Source ID has no destination'):
            module.plan(fixture)

    def test_unreadable_timestamp_blocks_id_generation(self):
        fixture = self.fixture()
        fixture['formal']['values'][2][0] = 'unknown'
        with self.assertRaisesRegex(AssertionError,'Unrecognized timestamp'):
            module.plan(fixture)

    def test_contact_misplaced_in_title_is_retained_only_in_private_original(self):
        fixture = self.fixture()
        fixture['formal']['values'][2][12] = 'Evento contato@example.org'
        p = module.plan(fixture)
        self.assertEqual(p['added'][0]['TITULO_ACAO'],'Evento')
        self.assertIn('contato@example.org',p['added'][0][module.RAW])

if __name__ == '__main__':
    unittest.main()
