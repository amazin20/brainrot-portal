"""Negative controls for the publisher's trust boundaries; no network/deploy."""
import copy
import importlib.util
import io
import json
import os
import pathlib
import stat
import tempfile
import unittest
import urllib.request
import urllib.error
import zipfile
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('publisher60', pathlib.Path(__file__).with_name('publish-campaign-v60.py'))
P = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(P)


class Boundaries(unittest.TestCase):
    def archive(self, items):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as archive:
            for member, data in items:
                archive.writestr(member, data)
        stream.seek(0)
        return stream

    def test_extract_rejects_traversal_absolute_drive_null_and_duplicates(self):
        for member in ('../outside', '/outside', 'C:/outside', 'a\\outside', 'a/../outside', 'a//outside'):
            with self.subTest(member=member), tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(ValueError):
                    P.safe_extract(self.archive([(member, b'x')]), pathlib.Path(tmp) / 'out')
                self.assertFalse((pathlib.Path(tmp) / 'outside').exists())
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                P.safe_extract(self.archive([('same', b'a'), ('same', b'b')]), pathlib.Path(tmp) / 'out')

    def test_extract_rejects_symlink_file_directory_collision_and_size_overflow(self):
        link = zipfile.ZipInfo('link'); link.create_system = 3; link.external_attr = (stat.S_IFLNK | 0o777) << 16
        for items, maximum in (([(link, b'../../escape')], 100), ([('a', b'a'), ('a/b', b'b')], 100), ([('a', b'123'), ('b', b'456')], 5)):
            with self.subTest(items=items), tempfile.TemporaryDirectory() as tmp:
                with self.assertRaises(ValueError):
                    P.safe_extract(self.archive(items), pathlib.Path(tmp) / 'out', maximum)

    def test_exact_package_extraction_does_not_change_original_bytes_or_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = pathlib.Path(tmp) / 'out'; data = b'glTF\x00original-model-bytes'
            rows = P.safe_extract(self.archive([('assets/game.js', b'export const original=true;'), ('models/a.glb', data)]), target)
            self.assertEqual((target / 'models/a.glb').read_bytes(), data)
            self.assertEqual(rows[1], {'path': 'models/a.glb', 'bytes': len(data), 'sha256': P.sha(data)})
            with self.assertRaises(ValueError):
                P.safe_extract(self.archive([('new', b'x')]), target)

    def test_inventory_rejects_order_duplicates_file_parent_and_symbolic_links(self):
        row = lambda n: {'path': n, 'bytes': 1, 'sha256': 'a' * 64}
        for rows in ([row('b'), row('a')], [row('a'), row('a')], [row('a'), row('a/b')]):
            with self.assertRaises(ValueError): P.rows_valid(rows)
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp); (root / 'actual').write_bytes(b'x'); (root / 'link').symlink_to(root / 'actual')
            with self.assertRaises(ValueError): P.inventory(root)

    def test_inventory_orders_full_posix_paths_across_prefix_sibling_files_and_directories(self):
        names = ['chapter-atlas/walkthroughs/level-33.mp4', 'chapter-atlas/walkthroughs.html',
                 'chapter-atlas/walkthroughs-v53.html', 'chapter-atlas/walkthroughs/level-33.jpg',
                 'assets/main.js', 'assets-v2.json']
        self.assertNotEqual(sorted(names, key=pathlib.PurePosixPath), sorted(names),
                            'The fixture must expose component ordering versus canonical path ordering')
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            for name in reversed(names):
                target = root / name; target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(name.encode())
            expected = [{'path': name, 'bytes': len(name.encode()), 'sha256': P.sha(name.encode())}
                        for name in sorted(names)]
            self.assertEqual(P.inventory(root), expected)

    def test_inventory_preserves_real_2362_baseline_with_variable_candidate_membership(self):
        repository = pathlib.Path(__file__).resolve().parents[1]
        old = P.load(repository / 'tools/campaign-v59-public-files.json')['siteFiles']
        candidate = [{'path': name, 'bytes': 1, 'sha256': P.sha(b'x')}
                     for name in ['index.html', 'build-info.json', 'assets/main-new.js']]
        self.assertEqual(len(old), 2362)
        new = [{**row, 'path': P.PREFIX + row['path']} for row in candidate]
        provenance = {'path': P.PREFIX + 'publication-provenance.json', 'bytes': 1, 'sha256': P.sha(b'p')}
        actual_metadata = sorted(old + new + [provenance], key=lambda row: row['path'])
        self.assertEqual(len(P.rows_valid(actual_metadata)), len(old) + len(candidate) + 1)
        self.assertLess(sum(row['bytes'] for row in actual_metadata), P.MAX_SITE)
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            # Exercise every accepted path without recreating 655 MB of media.
            for row in reversed(actual_metadata):
                target = root / row['path']; target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(b'x')
            union = P.inventory(root)
            self.assertEqual([row['path'] for row in union], [row['path'] for row in actual_metadata])
            self.assertEqual(len(union), len(old) + len(candidate) + 1)
            self.assertEqual([row['path'] for row in union if not row['path'].startswith(P.PREFIX)],
                             [row['path'] for row in old])
            self.assertTrue(all(row['bytes'] == 1 and row['sha256'] == P.sha(b'x') for row in union))

    def test_signed_redirect_removes_bearer_and_rejects_plain_http(self):
        request = urllib.request.Request('https://api.github.com/repos/amazin20/brainrot-portal/actions/artifacts/1/zip', headers={'Authorization': 'Bearer private', 'Cookie': 'private=1'})
        result = P.Redirect().redirect_request(request, None, 302, '', {}, 'https://example.blob.core.windows.net/signed')
        self.assertIsNone(result.get_header('Authorization')); self.assertIsNone(result.get_header('Cookie'))
        with self.assertRaises(ValueError): P.Redirect().redirect_request(request, None, 302, '', {}, 'http://example.net/plain')

    def test_retry_uses_full_fresh_get_and_atomically_replaces_only_matching_bytes(self):
        class Response(io.BytesIO):
            status = 200
            url = P.BASE + 'file'
        class Opener:
            def __init__(self): self.calls = []
            def open(self, request, timeout):
                self.calls.append(request)
                if len(self.calls) == 1: raise urllib.error.URLError('transient')
                return Response(b'wrong!' if len(self.calls) == 2 else b'right!')
        opener = Opener()
        with tempfile.TemporaryDirectory() as tmp, patch.object(P.urllib.request, 'build_opener', return_value=opener), patch.object(P.time, 'sleep'):
            destination = pathlib.Path(tmp) / 'file'
            result = P.get(P.BASE + 'file', destination=destination, expected={'bytes': 6, 'sha256': P.sha(b'right!')})
            self.assertEqual(destination.read_bytes(), b'right!'); self.assertEqual(result['sha256'], P.sha(b'right!'))
            self.assertEqual(len(opener.calls), 3); self.assertFalse(destination.with_name('file.partial').exists())
            self.assertTrue(all(r.get_method() == 'GET' and r.get_header('Authorization') is None for r in opener.calls))

    def test_provider_refuses_wrong_source_attempt_missing_jobs_and_changed_artifact(self):
        c = {'sourceRun': 4, 'sourceAttempt': 1, 'sourceCommit': 'a' * 40, 'expectedJobs': ['build', 'native'],
             'sourceArtifacts': [{'id': 5, 'name': 'first-chapter-dist', 'size_in_bytes': 6, 'digest': 'sha256:' + 'b' * 64}]}
        run = {'id': 4, 'status': 'completed', 'conclusion': 'success', 'head_sha': 'a' * 40, 'head_branch': P.SOURCE_BRANCH, 'path': P.SOURCE_WORKFLOW, 'run_attempt': 1}
        jobs = [{'name': n, 'status': 'completed', 'conclusion': 'success'} for n in c['expectedJobs']]
        artifacts = [{**c['sourceArtifacts'][0], 'expired': False, 'workflow_run': {'head_sha': 'a' * 40, 'id': 4}}]
        def test(r, j, a):
            with patch.dict(os.environ, {'GITHUB_RUN_ID': '9'}), patch.object(P, 'api', return_value=r), patch.object(P, 'pages', side_effect=[j, a]):
                return P.source_provider(c)
        self.assertEqual(test(run, jobs, artifacts)['run']['id'], 4)
        variants = [(dict(run, run_attempt=2), jobs, artifacts), (dict(run, head_sha='0' * 40), jobs, artifacts),
                    (run, jobs[:1], artifacts), (run, [dict(jobs[0], conclusion='failure'), jobs[1]], artifacts),
                    (run, jobs, [dict(artifacts[0], digest='sha256:' + 'c' * 64)]), (run, jobs, [dict(artifacts[0], expired=True)])]
        for values in variants:
            with self.subTest(values=values), self.assertRaises(ValueError): test(*values)

    def test_candidate_refuses_rewritten_game_file_and_source_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            before = pathlib.Path.cwd(); os.chdir(tmp)
            try:
                source = pathlib.Path('source'); source.mkdir(); (source / 'main.js').write_bytes(b'original source')
                dist = pathlib.Path('dist'); dist.mkdir(); (dist / 'game.js').write_bytes(b'original package')
                rows = P.inventory(dist); inputs = [{'filename': 'main.js', 'sha256': P.sha(b'original source')}]
                info = {'commit': 'a' * 40, 'gameCommit': 'a' * 40, 'interfaceCommit': 'a' * 40, 'version': 'v60-first-chapter',
                        'run': '4', 'levels': 51, 'edition': 'foundation', 'verified': False, 'files': rows, 'packageFilesSha256': P.sha(P.encoded(rows)),
                        'sourceInputs': inputs, 'sourceInputFiles': 1, 'sourceInputsSha256': P.sha(P.encoded(inputs)),
                        'sequenceRevision': 'fifty-rooms-then-castle-v1',
                        'features': {'tower': {'level':51,'stableLevel':41,'stages':12,'checkpoints':False}, 'foundation': {'castleEndsCampaign':True}},
                        'rooms': [{'level': position+1,'stableLevel': n} for position,n in enumerate(list(range(1,41))+list(range(42,52))+[41])]}
                P.write(dist / 'build-info.json', info)
                accepted = P.inventory(dist)
                P.write('source-acceptance.json', {'candidateFiles': accepted, 'candidateBytes': sum(r['bytes'] for r in accepted),
                                                 'candidateInventorySha256': P.sha(P.encoded(accepted))})
                c = {'sourceCommit': 'a' * 40, 'version': 'v60-first-chapter', 'sourceRun': 4,
                     'sourceAcceptance': {'path': 'source-acceptance.json'}}
                self.assertEqual(len(P.validate_candidate(c, dist)), 2)
                original_info=copy.deepcopy(info)
                for mode in ['stable-order','display-number','eleven-stages','checkpoint','wrap-finale','sequence-revision']:
                    with self.subTest(mode=mode):
                        modified=copy.deepcopy(original_info)
                        if mode=='stable-order':modified['rooms']=[{'level':i,'stableLevel':i} for i in range(1,52)]
                        if mode=='display-number':modified['rooms'][-1]['level']=41
                        if mode=='eleven-stages':modified['features']['tower']['stages']=11
                        if mode=='checkpoint':modified['features']['tower']['checkpoints']=True
                        if mode=='wrap-finale':modified['features']['foundation']['castleEndsCampaign']=False
                        if mode=='sequence-revision':modified['sequenceRevision']='previous-order'
                        P.write(dist/'build-info.json',modified)
                        with self.assertRaises(ValueError):P.validate_candidate(c,dist)
                P.write(dist/'build-info.json',original_info)

                changed = dict(accepted[0], sha256='0' * 64)
                P.write('source-acceptance.json', {'candidateFiles': [changed, *accepted[1:]], 'candidateBytes': sum(r['bytes'] for r in accepted),
                                                 'candidateInventorySha256': P.sha(P.encoded(accepted))})
                with self.assertRaises(ValueError): P.validate_candidate(c, dist)
                P.write('source-acceptance.json', {'candidateFiles': accepted, 'candidateBytes': sum(r['bytes'] for r in accepted),
                                                 'candidateInventorySha256': P.sha(P.encoded(accepted))})
                (dist / 'game.js').write_bytes(b'changed package')
                with self.assertRaises(ValueError): P.validate_candidate(c, dist)
                (dist / 'game.js').write_bytes(b'original package'); (source / 'main.js').write_bytes(b'changed source')
                with self.assertRaises(ValueError): P.validate_candidate(c, dist)
            finally: os.chdir(before)

    def test_frozen_source_requires_ten_current_films_both_attacks_and_strong_castle_proofs(self):
        # Isolated synthetic receipt bytes exercise guards, never audit acceptance.
        with tempfile.TemporaryDirectory() as tmp:
            receipt_path = pathlib.Path(tmp) / 'fixture-source.json'
            routes = {'rooms': 51, 'won': 51, 'sameOriginalCompanion': 51, 'resets': 0, 'respawns': 0,
                      'gameplayPassed': 51, 'capturesPassed': 51}
            films = {'rooms': 10, 'fullyDecoded': True, 'fps': 12, 'rows': [
                {'level': n, 'frames': 121, 'durationSeconds': 121/12, 'simulationSeconds': 10,
                 'fullyDecoded': True, 'sameOriginalShape': True, 'completeRoute': True,
                 'movieBytes': 100, 'movieSha256': 'e'*64, 'telemetrySha256': 'f'*64}
                for n in range(1, 11)]}
            attacks = {'groups': 2, 'rooms': 10, 'groupResults': [
                {'group': group, 'pass': True, 'immutablePureValidator': True, 'cases': n,
                 'originalCargo': True, 'closedInventory': True} for group,n in [('early',10),('later',13)]]}
            receipt = {'sourceAccepted': True, 'publicationAccepted': False, 'sourceCommit': 'a'*40,
                'sourceTree': 'b'*40, 'run': 4, 'runAttempt': 1, 'checks': {'ordinaryRoutes': routes,
                'nativeRoutes': routes, 'cpu': {'tests': 1, 'passed': 1, 'failed': 0},
                'firstChapterContinuousNative': films, 'firstChapterAttacks': attacks,
                'currentImmutablePureValidators': {'pass': True, 'firstChapterNativePureValidator': True, 'firstChapterAttacksPureValidator': True, 'castleImpulseNativePureValidator': True,
                'impulsePhysicalProofs': [{'kind': kind, 'pass': True} for kind in ['ordinary','native']]}}}
            config = {'schemaVersion': 1, 'frozen': True, 'publicationAccepted': False, 'repository': P.REPO,
                'namespace': P.PREFIX, 'version': 'v60-first-chapter', 'sourceBranch': P.SOURCE_BRANCH,
                'sourceWorkflow': P.SOURCE_WORKFLOW, 'sourceCommit': 'a'*40, 'sourceTree': 'b'*40,
                'controllerParent': 'c'*40, 'sourceRun': 4, 'sourceAttempt': 1,
                'expectedJobs': ['fixture-'+str(i) for i in range(32)],
                'sourceArtifacts': [{'id': i+1, 'name': 'fixture-'+str(i), 'size_in_bytes': 1,
                                     'digest': 'sha256:'+'d'*64} for i in range(34)],
                'baselineCatalogSha256': P.CATALOG_SHA, 'baselineInventorySha256': P.BASELINE[2],
                'baselineDeployment': P.BASELINE_DEPLOYMENT,
                'sourceAcceptance': {'path': receipt_path.name, 'sha256': ''}, 'distArtifact': 'first-chapter-dist'}
            def validate(value):
                P.write(receipt_path, value); config['sourceAcceptance']['sha256'] = P.sha(receipt_path.read_bytes())
                before = pathlib.Path.cwd()
                try:
                    os.chdir(tmp)
                    with patch.object(P, 'load', side_effect=[config, value]): return P.config()
                finally: os.chdir(before)
            self.assertEqual(validate(receipt)['sourceRun'], 4)
            for key,bad in [('rooms',9),('fullyDecoded',False),('fps',4),('rows',films['rows'][:-1])]:
                with self.subTest(films=key):
                    changed=copy.deepcopy(receipt);changed['checks']['firstChapterContinuousNative'][key]=bad
                    with self.assertRaises(ValueError):validate(changed)
            for key,bad in [('level',2),('frames',0),('frames',True),('fullyDecoded',False),
                ('sameOriginalShape',False),('completeRoute',False),('movieBytes',40_000_001),
                ('movieSha256','bad'),('telemetrySha256','bad'),('durationSeconds',1),('simulationSeconds',1)]:
                with self.subTest(movie=key,bad=bad):
                    changed=copy.deepcopy(receipt);changed['checks']['firstChapterContinuousNative']['rows'][0][key]=bad
                    with self.assertRaises(ValueError):validate(changed)
            for key,bad in [('groups',1),('rooms',5),('groupResults',attacks['groupResults'][:1])]:
                with self.subTest(attacks=key):
                    changed=copy.deepcopy(receipt);changed['checks']['firstChapterAttacks'][key]=bad
                    with self.assertRaises(ValueError):validate(changed)
            for key,bad in [('group','later'),('pass',False),('cases',0),('cases',True),
                ('immutablePureValidator',False),('originalCargo',False),('closedInventory',False)]:
                with self.subTest(attack=key):
                    changed=copy.deepcopy(receipt);changed['checks']['firstChapterAttacks']['groupResults'][0][key]=bad
                    with self.assertRaises(ValueError):validate(changed)
            for key,bad in [('pass',False),('firstChapterNativePureValidator',False),('firstChapterAttacksPureValidator',False),('castleImpulseNativePureValidator',False),('impulsePhysicalProofs',[]),
                ('impulsePhysicalProofs',[{'kind':'ordinary','pass':True}])]:
                with self.subTest(castle=key):
                    changed=copy.deepcopy(receipt);changed['checks']['currentImmutablePureValidators'][key]=bad
                    with self.assertRaises(ValueError):validate(changed)

    def test_deployment_lease_refuses_source_main_and_unrelated_publication_moves(self):
        c = {'controllerParent': 'b' * 40, 'sourceCommit': 'c' * 40, 'sourceTree': 'd' * 40, 'baselineDeployment': P.BASELINE_DEPLOYMENT}
        env = {'GITHUB_SHA': 'a' * 40, 'GITHUB_REPOSITORY': P.REPO, 'GITHUB_REF': 'refs/heads/main', 'GITHUB_RUN_ID': '9'}
        values = [{'object': {'sha': 'a' * 40}}, {'parents': [{'sha': 'b' * 40}]}, {'object': {'sha': 'c' * 40}}, {'tree': {'sha': 'd' * 40}}]
        deployment = {**P.BASELINE_DEPLOYMENT, 'environment': 'github-pages'}
        with patch.dict(os.environ, env), patch.object(P, 'api', side_effect=values), patch.object(P, 'pages', side_effect=[[deployment], [{'state': 'success'}]]):
            self.assertEqual(P.lease(c)['deployment']['id'], P.BASELINE_DEPLOYMENT['id'])
        for index in range(4):
            changed = copy.deepcopy(values)
            if index in (0, 2): changed[index]['object']['sha'] = '0' * 40
            elif index == 1: changed[index]['parents'] = [{'sha': '0' * 40}]
            else: changed[index]['tree']['sha'] = '0' * 40
            with patch.dict(os.environ, env), patch.object(P, 'api', side_effect=changed), self.assertRaises(ValueError): P.lease(c)
        with patch.dict(os.environ, env), patch.object(P, 'api', side_effect=values), patch.object(P, 'pages', side_effect=[[dict(deployment, id=10)], [{'state': 'success'}]]), self.assertRaises(ValueError): P.lease(c)
        pending = {'id': P.BASELINE_DEPLOYMENT['id'] + 1, 'sha': 'a' * 40}
        status = {'state': 'in_progress', 'log_url': 'https://github.com/' + P.REPO + '/actions/runs/9/job/12'}
        with patch.dict(os.environ, env), patch.object(P, 'api', side_effect=values), patch.object(P, 'pages', side_effect=[[pending, deployment], [status], [{'state': 'success'}]]):
            self.assertEqual(P.lease(c, allow_pending=True)['deployment']['id'], P.BASELINE_DEPLOYMENT['id'])
        with patch.dict(os.environ, env), patch.object(P, 'api', side_effect=values), patch.object(P, 'pages', side_effect=[[pending, deployment], [dict(status, log_url='https://github.com/another/run')]]), self.assertRaises(ValueError): P.lease(c, allow_pending=True)

    def test_original_deployment_api_pages_are_retained_without_reserialization_or_truncation(self):
        bodies = [json.dumps([{'id': n} for n in range(1, 101)], indent=3).encode() + b'\n\n', b'[ ]\n']
        calls = []
        def fetch(url, *, token, response_meta):
            self.assertTrue(token); response_meta.update(url=url, status=200); calls.append(url)
            return bodies[len(calls)-1]
        with tempfile.TemporaryDirectory() as tmp, patch.object(P, 'get', side_effect=fetch):
            folder = pathlib.Path(tmp); values, resource = P.retain_api_pages('deployments?environment=github-pages', 'deployments', folder)
            self.assertEqual(len(values), 100); self.assertEqual(resource['items'], 100)
            self.assertEqual([r['items'] for r in resource['pages']], [100, 0])
            self.assertTrue(calls[0].endswith('&per_page=100&page=1')); self.assertTrue(calls[1].endswith('&per_page=100&page=2'))
            for index, raw in enumerate(bodies, 1):
                self.assertEqual((folder / ('deployments-page-' + str(index).zfill(3) + '.json')).read_bytes(), raw)
                self.assertEqual(resource['pages'][index-1]['sha256'], P.sha(raw))
            self.assertFalse((folder / 'deployments.json').exists())
        def redirected(url, *, token, response_meta):
            response_meta.update(url='https://example.invalid/substitute', status=200); return b'[]'
        with tempfile.TemporaryDirectory() as tmp, patch.object(P, 'get', side_effect=redirected), self.assertRaises(ValueError):
            P.retain_api_pages('deployments?environment=github-pages', 'deployments', pathlib.Path(tmp))

    def test_workflow_has_one_exact_trigger_one_deployer_and_no_game_build(self):
        text = pathlib.Path('.github/workflows/publish-campaign-v60.yml').read_text()
        self.assertIn('paths: [tools/campaign-v60-release.json]', text); self.assertIn('branches: [main]', text)
        self.assertEqual(text.count('pages: write'), 1); self.assertEqual(text.count('actions/deploy-pages@v4'), 1)
        self.assertIn('group: pages', text); self.assertIn('cancel-in-progress: false', text)
        self.assertIn('needs: [prepare, deploy, public-http, entry, native, attacks]', text)
        self.assertIn('matrix: {group: [early, later]}', text)
        self.assertIn("run-id: '${{ needs.prepare.outputs.source_run }}'", text)
        self.assertIn('name: first-chapter-dist, path: source/dist', text)
        for group in ['early', 'later']:
            self.assertIn('name: v60-public-attacks-' + group + ', path: proof/attacks-' + group, text)
        for forbidden in ('workflow_dispatch', 'workflow_run', 'npm run build', 'publish-campaign-v56', 'restore-campaign-v56'):
            self.assertNotIn(forbidden, text)


if __name__ == '__main__': unittest.main()
