"""Read-only contract tests for the single campaign-v55 Pages controller."""
import copy
import pathlib
import re
import unittest
import yaml

SOURCE = 'ba5c86fd07facd9613f5e6e8efb9709bd2ef9e89'
PUBLIC = 'https://amazin20.github.io/brainrot-portal/campaign-v55/'
WORKFLOW = '.github/workflows/publish-campaign-v55.yml'
GROUPS = [
    {'part': 'early', 'rooms': '1,2,3,4,5,6,7,8,9,10'},
    {'part': 'energy', 'rooms': '11,12,13,14,15,16,17,18,19,20'},
    {'part': 'living', 'rooms': '21,22,23,24,25,26,27,28,29,30'},
    {'part': 'optics', 'rooms': '31,32,33,34,35,36,37,38,39,40'},
    {'part': 'fracture', 'rooms': '42,43,44,45,46,47,48,49,50,51'},
    {'part': 'castle', 'rooms': '41'},
]
ALLOWED_TRIGGERS = {
    'tools/campaign-v55-release.json',
}


def scripts(job):
    return '\n'.join(str(step.get('run', '')) for step in job['steps'])


def assert_contract(workflow):
    assert set(workflow['on']) == {'push'}, 'Only a real main push may produce PUBLIC proof'
    push = workflow['on']['push']
    assert push['branches'] == ['main']
    assert set(push['paths']) == ALLOWED_TRIGGERS and len(push['paths']) == len(ALLOWED_TRIGGERS)
    assert workflow['concurrency'] == {'group': 'pages', 'cancel-in-progress': False}
    env = workflow['env']
    assert env['BUILD_COMMIT'] == SOURCE and env['SOURCE_REVIEW_RUN_ID'] == '38377149910'
    assert env['SOURCE_REVIEW_RUN_ATTEMPT'] == '1' and env['PUBLIC_CAMPAIGN_URL'] == PUBLIC
    assert env['GITHUB_TOKEN'] == '${{ github.token }}', 'Token authenticates; it never identifies a producer'
    jobs = workflow['jobs']
    assert list(jobs) == ['assemble', 'deploy', 'native', 'presentation', 'entry', 'verify']
    assert all('name' not in job for job in jobs.values()), 'Default API job names are authenticated'
    assert jobs['native']['strategy'] == {'fail-fast': False, 'matrix': {'include': GROUPS}}
    assert len(jobs) - 1 + len(GROUPS) == 11
    assert 'needs' not in jobs['assemble'] and jobs['deploy']['needs'] == 'assemble'
    assert all(jobs[key]['needs'] == 'deploy' for key in ['native', 'presentation', 'entry'])
    assert jobs['verify']['needs'] == ['deploy', 'native', 'presentation', 'entry']
    assert "needs.deploy.result == 'success'" in jobs['verify']['if']
    all_steps = [(key, step) for key, job in jobs.items() for step in job['steps']]
    assert [(key, step['uses']) for key, step in all_steps if step.get('uses', '').startswith('actions/deploy-pages@')] == [('deploy', 'actions/deploy-pages@v4')]
    assert [(key, step['uses']) for key, step in all_steps if step.get('uses', '').startswith('actions/upload-pages-artifact@')] == [('assemble', 'actions/upload-pages-artifact@v3')]
    assert all('name' not in step for key, step in all_steps if step.get('uses') in ['actions/upload-artifact@v4', 'actions/deploy-pages@v4']), 'Actual provider action names must retain their authenticated defaults'
    assert jobs['deploy']['permissions']['pages'] == 'write' and jobs['deploy']['permissions']['id-token'] == 'write'
    assert all(job.get('permissions', {}).get('pages') != 'write' for key, job in jobs.items() if key != 'deploy')
    for mapping in [env, *[job.get('env', {}) for job in jobs.values()], *[step.get('env', {}) for _, step in all_steps]]:
        assert all(not key.startswith('GITHUB_') or key == 'GITHUB_TOKEN' and value == '${{ github.token }}' for key, value in mapping.items()), 'Inherited GitHub identities cannot be replaced'
    for key, job in jobs.items():
        checkouts = [step for step in job['steps'] if step.get('uses') == 'actions/checkout@v4']
        assert len(checkouts) == 2
        assert checkouts[0]['with'] == {'ref': '${{ github.sha }}', 'fetch-depth': 0, 'persist-credentials': False}
        assert checkouts[1]['with'] == {'ref': SOURCE, 'path': 'source', 'fetch-depth': 0, 'persist-credentials': False}
        body = scripts(job)
        assert not re.search(r'(?m)(?:^|[;\s])(?:export\s+)?GITHUB_[A-Z_]+\s*=', body)
        assert 'PUBLIC_ORIGIN_MODE=local' not in body and 'SOURCE_STAMP' not in body
        assert 'stamp-build' not in body and 'npm run build' not in body, 'Only original SOURCE4 package bytes may be deployed'
        if key != 'assemble':
            prepared = [step for step in job['steps'] if step.get('uses') == 'actions/download-artifact@v4']
            assert len(prepared) == 1 and prepared[0]['with'] == {'name': 'campaign-v55-prepared-${{ github.run_id }}-${{ github.run_attempt }}', 'path': 'proof'}
    assembly = scripts(jobs['assemble'])
    assert 'npm install --no-save --package-lock=false puppeteer-core@24.16.0' in assembly
    assert 'node scripts/publish-campaign-v55.mjs verify-browser-module' in assembly
    assert assembly.index('verify-browser-module') < assembly.index('guard preparation')
    for command in ['guard preparation', 'download', 'verify-source', 'verify-baseline']:
        assert 'node scripts/publish-campaign-v55.mjs ' + command in assembly
    assert '--zip proof/downloads/11797406269.zip' in assembly and '--output baseline' in assembly
    assert '--source-binding proof/source-binding.json' in assembly
    assert 'test ! -e source/dist' in assembly and 'cp -a proof/review-artifacts/campaign-polish-dist source/dist' in assembly
    assert '--dist source/dist' in assembly and '--output site --proof proof' in assembly
    assert 'node --check scripts/publish-campaign-v55-run.mjs' in assembly
    assert 'node scripts/publish-campaign-v55.mjs prepare-public-input' in assembly
    assemble_steps = jobs['assemble']['steps']
    assembly_index = next(i for i, step in enumerate(assemble_steps) if ' --source-binding proof/source-binding.json ' in step.get('run', ''))
    public_input_index = next(i for i, step in enumerate(assemble_steps) if step.get('run') == 'node scripts/publish-campaign-v55.mjs prepare-public-input')
    prepared_index = next(i for i, step in enumerate(assemble_steps) if step.get('uses') == 'actions/upload-artifact@v4')
    assert assembly_index < public_input_index < prepared_index
    assert assemble_steps[prepared_index]['with']['path'] == 'proof/public-input', 'PUBLIC consumers must not download old Pages/capture caches'
    deployment = scripts(jobs['deploy'])
    assert deployment.index('--phase preflight') < deployment.index('guard deploy')
    assert '--phase published' in deployment and 'guard published' in deployment
    assert '--output proof/public-bytes.json' in deployment, 'Deploy ZIP root public-bytes.json is extracted into proof/deploy-proof by runtime'
    deploy_steps = jobs['deploy']['steps']
    actual_deploy = next(i for i, step in enumerate(deploy_steps) if step.get('uses') == 'actions/deploy-pages@v4')
    assert any('--phase preflight' in str(s.get('run', '')) for s in deploy_steps[:actual_deploy])
    assert any('--phase published' in str(s.get('run', '')) for s in deploy_steps[actual_deploy + 1:])
    for key in ['native', 'presentation', 'entry']:
        body = scripts(jobs[key])
        assert 'puppeteer-core@24.16.0' in body
        assert 'shutil.copytree(src, dst)' in body and '== 80' in body
        assert 'proof/review-artifacts/campaign-polish-dist' in body
        assert 'p.read_bytes() == (dst/p.relative_to(src)).read_bytes()' in body
        assert '--import "$GITHUB_WORKSPACE/scripts/observe-campaign-v55-browser.mjs"' in body
        assert 'PUBLIC_BROWSER_OBSERVATIONS="$GITHUB_WORKSPACE/proof/public-' in body
        assert 'PAGE_URL="$PUBLIC_CAMPAIGN_URL"' in body
        uploads = [step for step in jobs[key]['steps'] if step.get('uses') == 'actions/upload-artifact@v4']
        assert len(uploads) == 1 and uploads[0]['if'] == 'always()' and 'name' not in uploads[0]
        module_control = next(i for i, step in enumerate(jobs[key]['steps']) if step.get('run') == 'node scripts/publish-campaign-v55.mjs verify-browser-module')
        browser_install = next(i for i, step in enumerate(jobs[key]['steps']) if 'puppeteer-core@24.16.0' in step.get('run', ''))
        origin = next(i for i, step in enumerate(jobs[key]['steps']) if 'capture-origin' in step.get('run', ''))
        assert browser_install < module_control < origin
        role = 'native-${{ matrix.part }}' if key == 'native' else key
        assert uploads[0]['with']['name'] == 'campaign-v55-public-' + role + '-${{ github.run_id }}-${{ github.run_attempt }}'
        assert uploads[0]['with']['path'] == 'proof/public-' + role
    native = scripts(jobs['native'])
    for value in ['CASE=route', 'STRICT_CAPTURE=1', 'REUSE_PAGE=0', 'LEVELS="${{ matrix.rooms }}"', 'START_SERVER=0', 'ROUTE_TIMEOUT_MS=2700000', '45m node', 'scripts/qa-creative-browser.mjs']:
        assert value in native
    assert jobs['native']['timeout-minutes'] == 55
    assert 'public-$role/browser-native.json' in native
    assert jobs['presentation']['timeout-minutes'] == 60
    presentation = scripts(jobs['presentation'])
    for driver in ['qa-campaign-menu.mjs', 'qa-creative-browser.mjs', 'qa-animation-presentation.mjs', 'qa-campaign-save-isolation.mjs']:
        assert presentation.count('scripts/' + driver) == 1
    assert 'PRODUCTION=1' in presentation and 'DEMO_URL="$PUBLIC_CAMPAIGN_URL"' in presentation
    assert 'CASE=overview INSPECTION_QUALITY=balanced REUSE_PAGE=0' in presentation
    sequence = ','.join(map(str, list(range(1, 41)) + list(range(42, 52)) + [41]))
    assert 'LEVELS="' + sequence + '"' in presentation
    for part in ['menu', 'architecture', 'animation', 'storage']:
        assert 'public-presentation/payload/' + part in presentation
        assert 'public-presentation/browser-' + part + '.json' in presentation
    assert 'node scripts/publish-campaign-v55.mjs capture-origin presentation' in presentation
    assert 'node scripts/publish-campaign-v55.mjs wrap-capture presentation' in presentation
    entry = scripts(jobs['entry'])
    assert 'public-entry/browser-entry.json' in entry
    assert 'scripts/qa-campaign-v55-public-entry.mjs' in entry and 'public-entry/payload' in entry
    assert 'capture-origin entry' in entry and 'wrap-capture entry' in entry
    final = scripts(jobs['verify'])
    assert 'guard final' in final and 'verify-public-aggregate' in final
    final_uploads = [step for step in jobs['verify']['steps'] if step.get('uses') == 'actions/upload-artifact@v4']
    assert len(final_uploads) == 1 and final_uploads[0]['with']['path'] == 'proof/public-verification'
    assert final_uploads[0]['with']['name'] == 'campaign-v55-public-verification-${{ github.run_id }}-${{ github.run_attempt }}'
    assert all('download' not in str(step.get('with', {}).get('path', '')) for step in final_uploads)


class WorkflowContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[1]
        cls.workflow = yaml.safe_load((root / WORKFLOW).read_text())

    def test_complete_actual_provider_graph_and_frozen_protocols(self):
        assert_contract(self.workflow)

    def test_contract_rejects_identity_source_graph_trigger_and_payload_mutations(self):
        def duplicate_deploy(w):
            w['jobs']['entry']['steps'].append({'uses': 'actions/deploy-pages@v4'})
        def rename_deploy(w):
            next(step for step in w['jobs']['deploy']['steps'] if step.get('uses') == 'actions/deploy-pages@v4')['name'] = 'Deploy the single preserved union'
        def upload_old_caches(w):
            next(step for step in w['jobs']['assemble']['steps'] if step.get('uses') == 'actions/upload-artifact@v4')['with']['path'] = 'proof'
        def remove_observer(w):
            for step in w['jobs']['native']['steps']:
                if 'qa-creative-browser.mjs' in step.get('run', ''):
                    step['run'] = step['run'].replace('--import "$GITHUB_WORKSPACE/scripts/observe-campaign-v55-browser.mjs"', '')
        def source_substitution(w):
            for step in w['jobs']['native']['steps']:
                if 'shutil.copytree' in step.get('run', ''):
                    step['run'] = step['run'].replace('proof/review-artifacts/campaign-polish-dist', 'prior-source/dist')
        mutations = [
            lambda w: w['env'].__setitem__('GITHUB_RUN_ID', '38377149910'),
            lambda w: w['env'].__setitem__('BUILD_COMMIT', 'a' * 40),
            lambda w: w['on']['push']['paths'].append('.github/workflows/publish-puzzle-progression-finale.yml'),
            lambda w: w['on'].__setitem__('workflow_dispatch', {}),
            lambda w: w['jobs']['native']['strategy']['matrix']['include'].pop(),
            lambda w: w['jobs']['native'].__setitem__('name', 'native source fixture'),
            lambda w: w['jobs']['entry'].__setitem__('needs', 'assemble'),
            duplicate_deploy, remove_observer,
            lambda w: w['jobs']['native']['steps'].__setitem__(1, {'uses': 'actions/checkout@v4', 'with': {'ref': 'main', 'path': 'source'}}),
            lambda w: w['jobs']['verify']['steps'][-1]['with'].__setitem__('path', 'proof'),
            rename_deploy, upload_old_caches,
        ]
        for index, mutate in enumerate(mutations):
            with self.subTest(mutation=index):
                bad = copy.deepcopy(self.workflow)
                mutate(bad)
                with self.assertRaises((AssertionError, KeyError)):
                    assert_contract(bad)
        for key in ['native', 'presentation']:
            bad = copy.deepcopy(self.workflow)
            for step in bad['jobs'][key]['steps']:
                if 'REUSE_PAGE=0' in step.get('run', ''):
                    step['run'] = step['run'].replace('REUSE_PAGE=0', 'REUSE_PAGE=1')
            with self.assertRaises(AssertionError):
                assert_contract(bad)
        bad = copy.deepcopy(self.workflow)
        source_substitution(bad)
        with self.assertRaises(AssertionError):
            assert_contract(bad)


if __name__ == '__main__':
    unittest.main()
