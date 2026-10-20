import copy
import importlib.util
import json
import pathlib
import tempfile
import types
import unittest
import zipfile

SPEC = importlib.util.spec_from_file_location('public_audit', pathlib.Path(__file__).with_name('audit-public-terminal.py'))
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


def write_json(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value))


def cohort():
    commit, tree, parent = 'a' * 40, 'b' * 40, 'c' * 40
    run_id, attempt = 700, 2
    run = {'id': run_id, 'run_attempt': attempt, 'head_sha': commit, 'head_branch': 'main',
           'path': AUDIT.WORKFLOW, 'event': 'push', 'repository': {'id': 50, 'full_name': AUDIT.REPOSITORY},
           'status': 'completed', 'conclusion': 'success'}
    meta = {'sha': commit, 'tree': {'sha': tree}, 'parents': [{'sha': parent}]}
    jobs, artifacts, roles = [], [], {}
    for job_index, (name, names) in enumerate(AUDIT.EXPECTED_ROLES.items()):
        rows = [{'name': artifact, 'action': 'actions/upload-pages-artifact' if artifact == 'github-pages' else
                 'actions/upload-artifact'} for artifact in names]
        roles[name] = rows
        steps = [{'number': i + 1, 'name': 'Run ' + row['action'] + '@v4', 'status': 'completed',
                  'conclusion': 'success', 'started_at': '2026-10-20T10:00:00Z',
                  'completed_at': '2026-10-20T10:00:20Z'} for i, row in enumerate(rows)]
        jobs.append({'id': 100 + job_index, 'name': name, 'run_id': run_id, 'run_attempt': attempt,
                     'head_sha': commit, 'status': 'completed', 'conclusion': 'success', 'steps': steps})
        for row in rows:
            artifacts.append({'id': 200 + len(artifacts), 'name': row['name'], 'expired': False,
                              'digest': 'sha256:' + 'e' * 64, 'size_in_bytes': 100,
                              'created_at': '2026-10-20T10:00:10Z',
                              'workflow_run': {'id': run_id, 'head_sha': commit, 'head_branch': 'main',
                                               'repository_id': 50, 'head_repository_id': 50}})
    return run, jobs, artifacts, meta, commit, tree, [parent], run_id, attempt, roles


class PublicTerminalTests(unittest.TestCase):
    def test_recovery_is_explicit_and_keeps_failed_exposure_unaccepted(self):
        self.assertEqual('original-append', AUDIT.audit_mode({}))
        config = {'controllerParent': AUDIT.FAILED_PUBLIC_DEPLOYMENT['sha'],
                  'recovery': {'kind': AUDIT.RECOVERY_KIND, 'publicationAccepted': False,
                               'deployment': copy.deepcopy(AUDIT.FAILED_PUBLIC_DEPLOYMENT)}}
        self.assertEqual(AUDIT.RECOVERY_KIND, AUDIT.audit_mode(config))
        for mutate in [lambda c: c['recovery'].update(kind='ignore-existing-namespace'),
                       lambda c: c['recovery'].update(publicationAccepted=True),
                       lambda c: c['recovery']['deployment'].update(id=7190324410),
                       lambda c: c['recovery']['deployment'].update(sha='b' * 40),
                       lambda c: c.update(controllerParent='c' * 40),
                       lambda c: c.update(recovery=None)]:
            case = copy.deepcopy(config)
            mutate(case)
            with self.assertRaises(AssertionError):
                AUDIT.audit_mode(case)

    def test_failed_first_public_cohort_never_satisfies_fresh_terminal_gate(self):
        case = copy.deepcopy(cohort())
        case[0].update(conclusion='failure')
        case[1][3].update(conclusion='failure')
        with self.assertRaisesRegex(AssertionError, 'not terminal success'):
            AUDIT.validate_provider(*case)

    def test_output_cannot_mutate_any_immutable_input(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            arguments = {name: root / name for name in ['publisher', 'source', 'consumer', 'input']}
            for immutable in arguments.values():
                output = immutable / 'draft.json'
                with self.assertRaisesRegex(AssertionError, 'outside all immutable'):
                    AUDIT.main(types.SimpleNamespace(**arguments, output=output))
                self.assertFalse(output.exists())

    def test_real_proposal_expands_pages_and_matrix_roles(self):
        proposal = pathlib.Path(__file__).parents[1] / 'v63-public-preparation/proposed'
        if not proposal.exists():
            self.skipTest('Repository-independent unit suite: local proposal fixture not supplied')
        roles = AUDIT.workflow_roles(proposal)
        self.assertEqual(11, len(roles))
        self.assertEqual(12, sum(map(len, roles.values())))
        self.assertEqual('actions/upload-pages-artifact', roles['prepare'][0]['action'])

    def test_terminal_cohort_maps_pages_to_its_distinct_upload_action(self):
        result = AUDIT.validate_provider(*cohort())
        self.assertIn('upload-pages-artifact', result['github-pages']['step']['name'])
        self.assertEqual('prepare', result['v63-preparation']['job']['name'])

    def test_terminal_identity_mutations_rejected(self):
        for mutate in [lambda c: c[0].update(status='in_progress'),
                       lambda c: c[0].update(head_branch='other'),
                       lambda c: c[1][-1].update(conclusion='failure'),
                       lambda c: c[1][-1]['steps'][0].update(conclusion='skipped'),
                       lambda c: c[2][-1]['workflow_run'].update(id=999),
                       lambda c: c[2][-1].update(created_at='2026-10-19T00:00:00Z'),
                       lambda c: c[2][0].update(size_in_bytes=AUDIT.PAGE_LIMIT + 1),
                       lambda c: c[2][-1].update(expired=True),
                       lambda c: c[1].pop()]:
            case = copy.deepcopy(cohort())
            mutate(case)
            with self.assertRaises(AssertionError):
                AUDIT.validate_provider(*case)

    def test_jobs_complete_pagination_and_no_aliases(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = pathlib.Path(temporary)
            write_json(folder / 'page-001.json', {'total_count': 2, 'jobs': [{'id': 1}]})
            write_json(folder / 'page-002.json', {'total_count': 2, 'jobs': [{'id': 2}]})
            self.assertEqual(2, len(AUDIT.pages(folder, 'jobs')[0]))
            write_json(folder / 'page-002.json', {'total_count': 2, 'jobs': [{'id': 1}]})
            with self.assertRaisesRegex(AssertionError, 'Duplicate'):
                AUDIT.pages(folder, 'jobs')
            (folder / 'page-002.json').rename(folder / 'alias.json')
            with self.assertRaisesRegex(AssertionError, 'Extra'):
                AUDIT.pages(folder, 'jobs')

    def test_json_duplicate_nonfinite_and_unsafe_members_fail(self):
        with tempfile.TemporaryDirectory() as temporary:
            file = pathlib.Path(temporary) / 'value.json'
            for value in ['{"id":1,"id":2}', '{"size":1e999}', '{"size":NaN}']:
                file.write_text(value)
                with self.assertRaises(AssertionError):
                    AUDIT.load(file)
        for name in ['../a', '/a', 'a//b', 'a\\b', 'a/./b', 'C:/a', 'a/\x00b']:
            with self.assertRaises(AssertionError):
                AUDIT.safe_name(name)

    def test_raw_logs_bind_all_producers_and_pages_metadata(self):
        case = cohort()
        run, jobs, artifacts, _, commit, _, _, run_id, _, _ = case
        mapping = AUDIT.validate_provider(*case)
        with tempfile.TemporaryDirectory() as temporary:
            provider = pathlib.Path(temporary)
            (provider / 'logs').mkdir()
            for job in jobs:
                text = 'Checked out ' + commit + '\n'
                for artifact in artifacts:
                    if mapping[artifact['name']]['job']['id'] != job['id']:
                        continue
                    text += ('SHA256 digest of uploaded artifact zip is ' + artifact['digest'][7:] + '\n' +
                             f"Artifact {artifact['name']} has been successfully uploaded! Final size is {artifact['size_in_bytes']} bytes. Artifact ID is {artifact['id']}\n" +
                             f"Artifact download URL: https://github.com/{AUDIT.REPOSITORY}/actions/runs/{run_id}/artifacts/{artifact['id']}\n")
                (provider / 'logs' / (str(job['id']) + '.log')).write_text(text)
            self.assertEqual(11, len(AUDIT.validate_logs(provider, jobs, artifacts, mapping, commit, run_id)[1]))
            file = provider / 'logs' / '100.log'
            file.write_text(file.read_text().replace('Artifact github-pages has', 'Artifact invented-pages has'))
            with self.assertRaisesRegex(AssertionError, 'name/bytes'):
                AUDIT.validate_logs(provider, jobs, artifacts, mapping, commit, run_id)

    def test_zip_crc_exact_closure_and_common_root(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            archive, extracted = root / 'artifact.zip', root / 'extracted'
            extracted.mkdir()
            (extracted / 'report.json').write_bytes(b'{"pass":true}')
            with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as zipped:
                zipped.writestr('common/report.json', (extracted / 'report.json').read_bytes())
            pin = {'id': 1, 'name': 'small', 'size_in_bytes': archive.stat().st_size,
                   'digest': 'sha256:' + AUDIT.file_sha(archive)}
            self.assertEqual(1, AUDIT.verified_zip(archive, extracted, pin)['files'])
            (extracted / 'extra').write_bytes(b'x')
            with self.assertRaisesRegex(AssertionError, 'closure'):
                AUDIT.verified_zip(archive, extracted, pin)
            (extracted / 'extra').unlink()
            data = archive.read_bytes().replace(b'{"pass":true}', b'{"pass":fail}')
            archive.write_bytes(data)
            pin['digest'] = 'sha256:' + AUDIT.file_sha(archive)
            with self.assertRaises(zipfile.BadZipFile):
                AUDIT.verified_zip(archive, extracted, pin)

    def test_zip_path_traversal_even_when_provider_hash_matches(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            archive, extracted = root / 'artifact.zip', root / 'extracted'
            extracted.mkdir()
            (extracted / 'report').write_text('x')
            with zipfile.ZipFile(archive, 'w') as zipped:
                zipped.writestr('../report', 'x')
            pin = {'id': 1, 'name': 'small', 'size_in_bytes': archive.stat().st_size,
                   'digest': 'sha256:' + AUDIT.file_sha(archive)}
            with self.assertRaisesRegex(AssertionError, 'Noncanonical'):
                AUDIT.verified_zip(archive, extracted, pin)

    def test_pages_zip_and_extraction_explicitly_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            (root / 'archives').mkdir()
            (root / 'evidence').mkdir()
            artifacts = []
            for index, name in enumerate(['github-pages', 'small']):
                artifacts.append({'id': index + 1, 'name': name, 'size_in_bytes': 1, 'digest': 'sha256:' + 'e' * 64})
            # The check rejects a provided Pages ZIP before attempting to read it.
            (root / 'archives/1.zip').write_bytes(b'x')
            (root / 'archives/2.zip').write_bytes(b'x')
            (root / 'evidence/small').mkdir()
            with self.assertRaisesRegex(AssertionError, 'not downloaded'):
                AUDIT.artifact_scope(root, artifacts)


if __name__ == '__main__':
    unittest.main()
