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

SPEC = importlib.util.spec_from_file_location('publisher57', pathlib.Path(__file__).with_name('publish-campaign-v57.py'))
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
             'sourceArtifacts': [{'id': 5, 'name': 'physical-power-dist', 'size_in_bytes': 6, 'digest': 'sha256:' + 'b' * 64}]}
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
                info = {'commit': 'a' * 40, 'gameCommit': 'a' * 40, 'interfaceCommit': 'a' * 40, 'version': 'v57-physical-power',
                        'run': '4', 'levels': 51, 'edition': 'foundation', 'verified': False, 'files': rows, 'packageFilesSha256': P.sha(P.encoded(rows)),
                        'sourceInputs': inputs, 'sourceInputFiles': 1, 'sourceInputsSha256': P.sha(P.encoded(inputs)), 'rooms': [{'stableLevel': n} for n in range(1, 52)]}
                P.write(dist / 'build-info.json', info); c = {'sourceCommit': 'a' * 40, 'version': 'v57-physical-power', 'sourceRun': 4}
                self.assertEqual(len(P.validate_candidate(c, dist)), 2)
                (dist / 'game.js').write_bytes(b'changed package')
                with self.assertRaises(ValueError): P.validate_candidate(c, dist)
                (dist / 'game.js').write_bytes(b'original package'); (source / 'main.js').write_bytes(b'changed source')
                with self.assertRaises(ValueError): P.validate_candidate(c, dist)
            finally: os.chdir(before)

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

    def test_workflow_has_one_exact_trigger_one_deployer_and_no_game_build(self):
        text = pathlib.Path('.github/workflows/publish-campaign-v57.yml').read_text()
        self.assertIn('paths: [tools/campaign-v57-release.json]', text); self.assertIn('branches: [main]', text)
        self.assertEqual(text.count('pages: write'), 1); self.assertEqual(text.count('actions/deploy-pages@v4'), 1)
        self.assertIn('group: pages', text); self.assertIn('cancel-in-progress: false', text)
        for forbidden in ('workflow_dispatch', 'workflow_run', 'npm run build', 'publish-campaign-v56', 'restore-campaign-v56'):
            self.assertNotIn(forbidden, text)


if __name__ == '__main__': unittest.main()
