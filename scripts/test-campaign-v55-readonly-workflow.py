import copy
import pathlib
import unittest
import yaml

def check(value):
    assert set(value['on']) == {'push'}
    assert value['on']['push']['branches'] == ['audit/campaign-v55-public-packet-20261013']
    assert value['permissions'] == {'contents': 'read', 'actions': 'read', 'deployments': 'read'}
    assert set(value['jobs']) == {'restore'}
    job=value['jobs']['restore'];steps=job['steps']
    assert 'environment' not in job and 'permissions' not in job
    assert all('deploy-pages' not in step.get('uses','') and 'upload-pages' not in step.get('uses','') for step in steps)
    checkouts=[step for step in steps if step.get('uses')=='actions/checkout@v4']
    assert len(checkouts)==2
    assert checkouts[0]['with']['ref']=='${{ github.sha }}'
    assert checkouts[1]['with']=={'ref':'ba5c86fd07facd9613f5e6e8efb9709bd2ef9e89','path':'source','fetch-depth':0,'persist-credentials':False}
    assert value['env']=={'GITHUB_TOKEN':'${{ github.token }}','CODEX_PRIMARY_RUNTIME_PYTHON':'/usr/bin/python3'}
    bodies='\n'.join(step.get('run','') for step in steps)
    assert 'restore-campaign-v55-public-packet.mjs restore' in bodies
    assert 'test-campaign-v55-readonly-provider.mjs' in bodies
    assert 'qa-creative-browser' not in bodies and 'puppeteer-core' not in bodies and 'npm run build' not in bodies
    assert all('GITHUB_' not in line.split('=')[0] for line in bodies.splitlines() if '=' in line)
    uploads=[step for step in steps if step.get('uses')=='actions/upload-artifact@v4']
    assert len(uploads)==1 and uploads[0]['if']=='always()'
    assert uploads[0]['with']['path']=='proof/public-verification'
    assert uploads[0]['with']['if-no-files-found']=='error'

class ReadonlyWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.value=yaml.safe_load((pathlib.Path(__file__).resolve().parent.parent/'.github/workflows/restore-campaign-v55-public-packet.yml').read_text())
    def test_exact_readonly_source_and_producer_contract(self): check(self.value)
    def test_write_replay_and_identity_mutants_rejected(self):
        def cases(v):
            yield lambda:x(v['permissions'],'pages','write')
            yield lambda:x(v['jobs']['restore'],'environment','github-pages')
            yield lambda:x(v['env'],'GITHUB_RUN_ID','38387082981')
            yield lambda:x(v['jobs']['restore']['steps'][1]['with'],'ref','main')
            yield lambda:v['jobs']['restore']['steps'].append({'uses':'actions/deploy-pages@v4'})
            yield lambda:x(v['on']['push'],'branches',['main'])
        for index in range(6):
            value=copy.deepcopy(self.value);list(cases(value))[index]()
            with self.assertRaises(AssertionError):check(value)
def x(value,key,item): value[key]=item
if __name__=='__main__':unittest.main()
