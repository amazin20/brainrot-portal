"""Offline, read-only draft audit of one terminal v63 Public Actions attempt.

Root supplies original provider JSON, all eleven raw job logs, eleven small
provider ZIPs and their extracted directories. The large github-pages artifact
is metadata-only: neither its ZIP nor its extracted payload is accepted here.
No network request, publication, deployment, or acceptance receipt is issued.
"""
import argparse
import datetime as dt
import hashlib
import itertools
import json
import math
import pathlib
import re
import stat
import subprocess
import sys
import zipfile

import yaml

REPOSITORY = 'amazin20/brainrot-portal'
WORKFLOW = '.github/workflows/publish-campaign-v63.yml'
CONFIG = 'tools/campaign-v63-release.json'
SMALL_LIMIT = 250_000_000
TOTAL_LIMIT = 2_000_000_000
PAGE_LIMIT = 850_000_000
GROUPS = ['early', 'energy', 'living', 'optics', 'fracture', 'castle']
RECOVERY_KIND = 'byte-identical-republish-after-public-observer-failure'
FAILED_PUBLIC_DEPLOYMENT = {'id': 7198668659, 'sha': '7feee7351bc2be2cdee708cae0e7a305bca6567c'}
EXPECTED_ROLES = {
    'prepare': ['github-pages', 'v63-preparation'],
    'deploy': ['v63-deployment-lease'],
    'public-http': ['v63-public-http'],
    'player': ['v63-public-player'],
    **{'native (' + group + ')': ['v63-public-native-' + group] for group in GROUPS},
    'verify': ['v63-final-public-proof'],
}
WORKFLOW_GET_REJECTION = ('HTTPError: 400: GitHub Fetch URL is not an allowed public GitHub repository '
                          'or search endpoint. (Response: None)')


def require(value, message):
    if not value:
        raise AssertionError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def file_sha(file):
    digest = hashlib.sha256()
    with pathlib.Path(file).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def regular(file, maximum=TOTAL_LIMIT):
    file = pathlib.Path(file)
    require(file.is_file() and not file.is_symlink() and 0 < file.stat().st_size <= maximum,
            'Missing, linked, empty or oversized regular file: ' + str(file))
    return file


def load(file):
    file = regular(file, 50_000_000)
    def pairs(rows):
        value = {}
        for key, item in rows:
            require(key not in value, 'Duplicate JSON key: ' + key)
            value[key] = item
        return value
    def invalid(value):
        raise AssertionError('Nonfinite JSON value: ' + value)
    def finite(value):
        result = float(value)
        require(math.isfinite(result), 'Nonfinite JSON numeric literal')
        return result
    return json.loads(file.read_text(encoding='utf-8-sig'), object_pairs_hook=pairs,
                      parse_constant=invalid, parse_float=finite)


def git(directory, *args):
    return subprocess.check_output(['git', '-C', str(directory), *args]).decode().strip()


def safe_name(value):
    require(isinstance(value, str) and value and not value.startswith('/') and '\\' not in value
            and not re.match(r'^[A-Za-z]:', value), 'Unsafe member path: ' + repr(value))
    require(all(piece not in ('', '.', '..') for piece in value.split('/')) and
            all(ord(char) >= 32 and ord(char) != 127 for char in value), 'Noncanonical member path')
    require(len(value.encode()) <= 2048 and len(value.split('/')) <= 64, 'Oversized member path')
    return value


def inventory(directory, maximum=SMALL_LIMIT):
    directory = pathlib.Path(directory)
    require(directory.is_dir() and not directory.is_symlink(), 'Regular evidence directory required')
    rows = []
    total = 0
    for file in sorted(directory.rglob('*')):
        require(not file.is_symlink(), 'Symlink in evidence: ' + str(file))
        if file.is_dir():
            continue
        require(file.is_file(), 'Special evidence member')
        total += file.stat().st_size
        require(total <= maximum, 'Evidence byte budget exceeded')
        rows.append({'path': safe_name(file.relative_to(directory).as_posix()),
                     'bytes': file.stat().st_size, 'sha256': file_sha(file)})
    require(0 < len(rows) <= 20000, 'Invalid evidence member count')
    return rows


def verified_zip(archive, directory, pin):
    archive = regular(archive, SMALL_LIMIT)
    directory = pathlib.Path(directory)
    require(archive.stat().st_size == pin['size_in_bytes'] and
            'sha256:' + file_sha(archive) == pin['digest'], 'Provider ZIP size/digest differs: ' + pin['name'])
    actual = inventory(directory)
    rows, seen, directories = [], set(), set()
    total = 0
    with zipfile.ZipFile(archive) as zipped:
        members = zipped.infolist()
        require(0 < len(members) <= 20000, 'ZIP member limit')
        for member in members:
            name = safe_name(member.filename.rstrip('/') if member.is_dir() else member.filename)
            require(name not in seen, 'Duplicate ZIP path')
            seen.add(name)
            require(stat.S_IFMT(member.external_attr >> 16) in (0, stat.S_IFREG, stat.S_IFDIR)
                    and not member.flag_bits & 1, 'Special/encrypted ZIP member')
            require(0 <= member.file_size <= SMALL_LIMIT and (not member.is_dir() or member.file_size == 0),
                    'Invalid ZIP member size')
            total += member.file_size
            require(total <= SMALL_LIMIT, 'ZIP decompression byte budget')
        names = [member.filename for member in members if not member.is_dir()]
        roots = {name.split('/')[0] for name in names}
        common = next(iter(roots)) if len(roots) == 1 and all('/' in name for name in names) else None
        for member in members:
            name = member.filename.rstrip('/')
            if common:
                require(name == common and member.is_dir() or name.startswith(common + '/'),
                        'Entry outside the common ZIP root')
                if name == common:
                    continue
                name = name[len(common) + 1:]
            safe_name(name)
            if member.is_dir():
                directories.add(name)
                continue
            digest, size = hashlib.sha256(), 0
            # Reading each member through EOF invokes zipfile's actual CRC32 check.
            with zipped.open(member) as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    size += len(block)
                    require(size <= member.file_size, 'Expanded ZIP member exceeds declaration')
                    digest.update(block)
            require(size == member.file_size, 'Truncated ZIP member')
            rows.append({'path': name, 'bytes': size, 'sha256': digest.hexdigest()})
    rows.sort(key=lambda row: row['path'])
    require(rows == actual, 'Extracted artifact closure differs: ' + pin['name'])
    paths = {row['path'] for row in rows}
    parents = {'/'.join(name.split('/')[:index]) for name in paths for index in range(1, len(name.split('/')))}
    require(not paths & parents, 'ZIP file/directory collision')
    actual_dirs = {file.relative_to(directory).as_posix() for file in directory.rglob('*') if file.is_dir()}
    require(actual_dirs == directories | parents, 'Extra/missing extracted directory')
    return {'artifactId': pin['id'], 'artifactName': pin['name'], 'zipBytes': archive.stat().st_size,
            'zipSha256': file_sha(archive), 'files': len(rows), 'bytes': sum(row['bytes'] for row in rows),
            'inventorySha256': sha(encoded(rows))}


def pages(folder, field):
    folder = pathlib.Path(folder)
    require(folder.is_dir() and not folder.is_symlink(), 'Regular provider page directory required')
    files = sorted(folder.glob('page-*.json'))
    require({file.name for file in folder.iterdir()} == {file.name for file in files}, 'Extra provider page member')
    require(files and [file.name for file in files] == [f'page-{index:03}.json' for index in range(1, len(files) + 1)],
            'Missing/nonsequential ' + field + ' provider pages')
    rows, count = [], None
    for file in files:
        value = load(file)
        require(isinstance(value, dict) and isinstance(value.get(field), list), 'Raw provider page required')
        require(type(value.get('total_count')) is int and value['total_count'] > 0, 'Actual positive total_count required')
        if count is None:
            count = value['total_count']
        require(count == value['total_count'] and value[field], 'Inconsistent/empty provider page')
        rows += value[field]
    require(len(rows) == count and all(type(row.get('id')) is int and row['id'] > 0 for row in rows),
            'Incomplete/invalid ' + field + ' pagination')
    require(len({row['id'] for row in rows}) == len(rows), 'Duplicate provider IDs')
    return rows, files


def workflow_roles(publisher):
    document = yaml.safe_load((pathlib.Path(publisher) / WORKFLOW).read_text())
    roles = {}
    for job_id, job in document['jobs'].items():
        matrix = job.get('strategy', {}).get('matrix')
        require(not matrix or 'exclude' not in matrix, 'Unsupported matrix exclusion')
        if not matrix:
            variants = [{}]
        elif set(matrix) == {'include'}:
            variants = matrix['include']
        else:
            require('include' not in matrix, 'Unsupported mixed matrix')
            keys = list(matrix)
            variants = [dict(zip(keys, items)) for items in itertools.product(*(matrix[key] for key in keys))]
        def expand(value, variant):
            value = str(value)
            for key, item in variant.items():
                value = value.replace('${{ matrix.' + key + ' }}', str(item))
            require('${{' not in value, 'Unresolved workflow expression')
            return value
        for variant in variants:
            name = expand(job['name'], variant) if 'name' in job else job_id + (
                ' (' + ', '.join(map(str, variant.values())) + ')' if variant else '')
            uploads = []
            for step in job['steps']:
                action = str(step.get('uses', ''))
                if action.startswith('actions/upload-artifact@') or action.startswith('actions/upload-pages-artifact@'):
                    uploads.append({'name': expand(step['with']['name'], variant),
                                    'action': action.split('@')[0]})
            require(uploads and name not in roles, 'Missing/duplicate workflow producer role')
            roles[name] = uploads
    require({name: [row['name'] for row in rows] for name, rows in roles.items()} == EXPECTED_ROLES,
            'Frozen Public workflow differs from the explicitly audited eleven-job/twelve-artifact topology')
    return roles


def instant(value):
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timezone required in actual provider timestamp')
    return result


def audit_mode(config):
    """Recovery is an explicitly pinned retry, never an automatic baseline fallback."""
    if 'recovery' not in config:
        return 'original-append'
    value = config['recovery']
    require(isinstance(value, dict) and value.get('kind') == RECOVERY_KIND and
            value.get('publicationAccepted') is False, 'Explicit unaccepted frozen recovery mode required')
    require(value.get('deployment') == FAILED_PUBLIC_DEPLOYMENT and
            config.get('controllerParent') == FAILED_PUBLIC_DEPLOYMENT['sha'],
            'Recovery must use the exact first failed publisher parent and successful first-exposure deployment')
    return RECOVERY_KIND


def workflow_record(publisher, provider, run, commit):
    require(type(run.get('workflow_id')) is int and run['workflow_id'] > 0 and
            run.get('workflow_url') == f"https://api.github.com/repos/{REPOSITORY}/actions/workflows/{run['workflow_id']}",
            'Wrong actual run workflow ID/URL')
    file = regular(publisher / WORKFLOW, 1_000_000)
    require(file.read_bytes() == subprocess.check_output(['git', '-C', str(publisher), 'show', commit + ':' + WORKFLOW]),
            'Publisher workflow differs from exact Git tree')
    bound = {'path': WORKFLOW, 'bytes': file.stat().st_size, 'sha256': file_sha(file),
             'gitBlob': git(publisher, 'rev-parse', commit + ':' + WORKFLOW)}
    actual, marker = provider / 'workflow.json', provider / 'workflow-metadata-unavailable.json'
    require(not actual.is_symlink() and not marker.is_symlink() and actual.exists() != marker.exists(),
            'Require actual workflow metadata OR an explicit original capability rejection')
    if actual.exists():
        value = load(actual)
        require(value['id'] == run['workflow_id'] and value['path'] == WORKFLOW and value['state'] == 'active',
                'Wrong actual workflow metadata')
        return {'independentWorkflowMetadataGet': True, 'workflowDefinitionFromExactGitTree': True,
                'workflowId': run['workflow_id'], 'workflowUrl': run['workflow_url'], 'publisherWorkflow': bound}, actual
    value = load(marker)
    require(set(value) == {'schemaVersion', 'kind', 'requestedUrl', 'tool', 'actualToolResponse', 'publisherWorkflow',
                          'independentWorkflowMetadataGet', 'workflowDefinitionFromExactGitTree'},
            'Unexpected workflow capability marker fields')
    require(value.get('schemaVersion') == 1 and value.get('kind') == 'workflow-metadata-get-unavailable' and
            value.get('requestedUrl') == run['workflow_url'] and value.get('tool') == 'mcp__codex_apps__github_fetch',
            'Actual workflow metadata capability rejection required')
    response = value.get('actualToolResponse', {})
    require(response.get('isError') is True and response.get('structuredContent', {}).get('error_code') == 'INVALID_ARGUMENT'
            and response['structuredContent'].get('error') == WORKFLOW_GET_REJECTION and
            response.get('content') == [{'type': 'text', 'text': WORKFLOW_GET_REJECTION}],
            'Original exact workflow tool rejection required')
    require(value.get('publisherWorkflow') == bound and value.get('independentWorkflowMetadataGet') is False and
            value.get('workflowDefinitionFromExactGitTree') is True, 'Workflow capability marker Git binding differs')
    return {'independentWorkflowMetadataGet': False, 'workflowDefinitionFromExactGitTree': True,
            'workflowId': run['workflow_id'], 'workflowUrl': run['workflow_url'], 'publisherWorkflow': bound,
            'capabilityRejection': {'path': 'provider/' + marker.name, 'bytes': marker.stat().st_size,
                                    'sha256': file_sha(marker), 'actualToolResponseSha256': sha(encoded(response))},
            'limitation': 'Provider tool rejected independent workflow metadata; workflow state was not independently fetched.'}, marker


def validate_provider(run, jobs, artifacts, meta, commit, tree, parents, run_id, attempt, roles):
    require(run['id'] == run_id and run['run_attempt'] == attempt and run['head_sha'] == commit and
            run['head_branch'] == 'main' and run['path'] == WORKFLOW and run['event'] == 'push', 'Wrong Public run identity')
    require(run['repository']['full_name'] == REPOSITORY and type(run['repository']['id']) is int and
            run['status'] == 'completed' and run['conclusion'] == 'success', 'Public run is not terminal success')
    require(meta['sha'] == commit and meta['tree']['sha'] == tree and
            [parent['sha'] for parent in meta['parents']] == parents, 'Actual provider commit/tree/parents differ')
    require(len(jobs) == 11 and {job['name'] for job in jobs} == set(roles), 'Incomplete/extra Public job cohort')
    expected = {row['name'] for rows in roles.values() for row in rows}
    require(len(artifacts) == 12 and {artifact['name'] for artifact in artifacts} == expected,
            'Incomplete/extra Public artifact cohort')
    mapping = {}
    for job in jobs:
        require(job['run_id'] == run_id and job['run_attempt'] == attempt and job['head_sha'] == commit and
                job['status'] == 'completed' and job['conclusion'] == 'success', 'Wrong/failed/unfinished Public job')
        steps = job['steps']
        require(steps and len({step['number'] for step in steps}) == len(steps) and
                all(step['status'] == 'completed' and step['conclusion'] == 'success' for step in steps),
                'Public job contains missing, failed, skipped or unfinished steps')
        uploads = [step for step in steps if 'actions/upload-artifact@' in step['name'] or
                   'actions/upload-pages-artifact@' in step['name']]
        require(len(uploads) == len(roles[job['name']]), 'Wrong successful artifact upload step count')
        for role in roles[job['name']]:
            candidates = [step for step in uploads if role['action'] + '@' in step['name']]
            require(len(candidates) == 1, 'Ambiguous/missing matching upload action')
            mapping[role['name']] = {'job': job, 'step': candidates[0]}
    for artifact in artifacts:
        limit = PAGE_LIMIT if artifact['name'] == 'github-pages' else SMALL_LIMIT
        require(artifact['expired'] is False and re.fullmatch(r'sha256:[a-f0-9]{64}', artifact['digest']) and
                type(artifact['id']) is int and artifact['id'] > 0 and type(artifact['size_in_bytes']) is int and
                0 < artifact['size_in_bytes'] <= limit, 'Expired/invalid/budget-exceeding artifact metadata')
        producer = artifact['workflow_run']
        require(producer['id'] == run_id and producer['head_sha'] == commit and producer['head_branch'] == 'main' and
                producer['repository_id'] == run['repository']['id'] and
                producer['head_repository_id'] == run['repository']['id'], 'Wrong actual artifact producer')
        created, step = instant(artifact['created_at']), mapping[artifact['name']]['step']
        require(instant(step['started_at']) - dt.timedelta(seconds=2) <= created <=
                instant(step['completed_at']) + dt.timedelta(seconds=2), 'Artifact creation outside its upload action')
    return mapping


def validate_logs(provider, jobs, artifacts, mapping, commit, run_id):
    folder = provider / 'logs'
    require(folder.is_dir() and not folder.is_symlink(), 'Regular raw-log directory required')
    require({file.name for file in folder.iterdir()} == {str(job['id']) + '.log' for job in jobs},
            'Missing, aliased or extra raw job logs')
    pins, logs = [], {}
    pattern = re.compile(r'Artifact (\S+) has been successfully uploaded! Final size is (\d+) bytes\. Artifact ID is (\d+)')
    by_id = {artifact['id']: artifact for artifact in artifacts}
    for job in jobs:
        file = regular(folder / (str(job['id']) + '.log'), 50_000_000)
        text = file.read_text(encoding='utf-8-sig')
        require(commit in text, 'Exact publisher checkout SHA absent from raw job log')
        events = list(pattern.finditer(text))
        wanted = [artifact for artifact in artifacts if mapping[artifact['name']]['job']['id'] == job['id']]
        require(len(events) == len(wanted) and {int(event[3]) for event in events} == {artifact['id'] for artifact in wanted},
                'Actual producer log artifact IDs/count differ')
        for event in events:
            artifact = by_id[int(event[3])]
            require(event[1] == artifact['name'] and int(event[2]) == artifact['size_in_bytes'],
                    'Actual upload name/bytes differ')
            require('SHA256 digest of uploaded artifact zip is ' + artifact['digest'][7:] in
                    text[max(0, event.start() - 2500):event.start()], 'Actual upload digest differs')
            require(f"Artifact download URL: https://github.com/{REPOSITORY}/actions/runs/{run_id}/artifacts/{artifact['id']}" in
                    text[event.end():event.end() + 1500], 'Actual upload download link absent')
        pins.append({'jobId': job['id'], 'jobName': job['name'], 'bytes': file.stat().st_size, 'sha256': file_sha(file)})
        logs[job['name']] = text
    return logs, pins


def artifact_scope(root, artifacts):
    pages_artifacts = [row for row in artifacts if row['name'] == 'github-pages']
    require(len(pages_artifacts) == 1, 'Exactly one metadata-only Pages artifact required')
    small = [row for row in artifacts if row['name'] != 'github-pages']
    archive_dir, evidence = root / 'archives', root / 'evidence'
    require(archive_dir.is_dir() and not archive_dir.is_symlink() and evidence.is_dir() and not evidence.is_symlink(),
            'Regular archive/evidence directories required')
    require({file.name for file in archive_dir.iterdir()} == {str(row['id']) + '.zip' for row in small},
            'Expected eleven small ZIPs only; github-pages must remain not downloaded')
    require({file.name for file in evidence.iterdir()} == {row['name'] for row in small},
            'Expected eleven extracted small artifacts only; Pages payload must remain not read')
    require(sum(row['size_in_bytes'] for row in small) <= TOTAL_LIMIT, 'Combined small ZIP byte budget')
    archives = [verified_zip(archive_dir / (str(row['id']) + '.zip'), evidence / row['name'], row)
                for row in sorted(small, key=lambda item: item['name'])]
    require(sum(row['bytes'] for row in archives) <= TOTAL_LIMIT, 'Combined extracted byte budget')
    page = pages_artifacts[0]
    excluded = {'artifactId': page['id'], 'artifactName': page['name'], 'providerZipBytes': page['size_in_bytes'],
                'providerDigest': page['digest'], 'metadataOnlyNotDownloaded': True, 'bytesNotRead': True,
                'zipDigestIndependentlyRecomputed': False, 'archiveCRCOrInventoryVerified': False,
                'scope': 'Provider metadata and raw successful upload event only; no Pages ZIP payload was downloaded or read.'}
    return archives, excluded


def main(args):
    publisher, source, consumer, root = (getattr(args, key).resolve() for key in ['publisher', 'source', 'consumer', 'input'])
    output = args.output.resolve()
    require(all(output != directory and directory not in output.parents for directory in (publisher, source, consumer, root)),
            'Audit output must be outside all immutable publisher, Source, consumer and provider input directories')
    require(not args.output.is_symlink() and not output.exists(), 'Fresh regular audit output path required')
    require(re.fullmatch(r'[a-f0-9]{40}', args.commit) and args.run > 0 and args.attempt > 0,
            'Exact Public commit and positive run/attempt required')
    require(git(publisher, 'rev-parse', 'HEAD') == args.commit and
            not git(publisher, 'status', '--porcelain', '--untracked-files=no'), 'Publisher checkout is not the exact clean commit')
    require(not git(publisher, 'status', '--porcelain', '--untracked-files=all', '--', '.github', 'scripts', 'tools'),
            'Untracked publisher/controller files')
    tree = git(publisher, 'rev-parse', 'HEAD^{tree}')
    parents = re.findall(r'^parent ([a-f0-9]{40})$', git(publisher, 'cat-file', 'commit', args.commit), re.M)
    config_file = regular(publisher / CONFIG, 2_000_000)
    config = load(config_file)
    require(config.get('frozen') is True and config.get('publicationAccepted') is False,
            'Only actual frozen publisher config with no public acceptance is auditable')
    mode = audit_mode(config)
    require(parents == [config['controllerParent']], 'Publisher parent differs from frozen controller parent')
    require(git(source, 'rev-parse', 'HEAD') == config['sourceCommit'] and
            git(source, 'rev-parse', 'HEAD^{tree}') == config['sourceTree'] and
            not git(source, 'status', '--porcelain', '--untracked-files=no'), 'Source checkout is not exact clean frozen Source')
    require(not git(source, 'status', '--porcelain', '--untracked-files=all', '--', 'src', 'public', 'index.html',
                    'vite.config.js', 'package.json', 'package-lock.json', 'scripts', '.github'), 'Untracked Source controller/production input')
    require(consumer.is_dir() and not consumer.is_symlink(), 'Explicit accepted Source consumer dist required')
    provider = root / 'provider'
    run, meta = load(provider / 'run.json'), load(provider / 'commit.json')
    workflow, workflow_file = workflow_record(publisher, provider, run, args.commit)
    require({file.name for file in provider.iterdir()} == {'run.json', 'commit.json', workflow_file.name, 'jobs', 'artifacts', 'logs'},
            'Missing/extra raw provider evidence')
    jobs, job_files = pages(provider / 'jobs', 'jobs')
    artifacts, artifact_files = pages(provider / 'artifacts', 'artifacts')
    roles = workflow_roles(publisher)
    mapping = validate_provider(run, jobs, artifacts, meta, args.commit, tree, parents, args.run, args.attempt, roles)
    logs, log_pins = validate_logs(provider, jobs, artifacts, mapping, args.commit, args.run)
    archives, excluded = artifact_scope(root, artifacts)
    context = {'publisher': str(publisher), 'source': str(source), 'consumer': {'directory': str(consumer)},
               'input': str(root), 'evidence': str(root / 'evidence'), 'config': config,
               'commit': args.commit, 'tree': tree, 'runId': args.run, 'runAttempt': args.attempt}
    helper = pathlib.Path(__file__).with_name('audit-public-proof.mjs')
    regular(helper, 2_000_000)
    process = subprocess.run(['node', str(helper), '--context'], input=json.dumps(context), text=True, capture_output=True)
    require(process.returncode == 0, 'Immutable Public proof validators rejected evidence:\n' + process.stderr[-14000:])
    checks = json.loads(process.stdout)
    require(checks.get('pass') is True and checks.get('sourceAccepted') is False and checks.get('publicationAccepted') is False,
            'Proof helper must pass only as an unaccepted draft')
    native_groups = {'early': list(range(1, 11)), 'energy': list(range(11, 21)),
                     'living': list(range(21, 31)), 'optics': list(range(31, 41)),
                     'fracture': list(range(42, 52)), 'castle': [41]}
    for group, levels in native_groups.items():
        value = logs['native (' + group + ')']
        for level in levels:
            require(f'ROUTE PASS room {level}: ' in value and f'PASS WebGL route room {level}: ' in value,
                    'Actual native route/capture completion absent from producer stdout: ' + str(level))
    provider_files = [provider / 'run.json', provider / 'commit.json', workflow_file] + job_files + artifact_files
    code = []
    for file in sorted(pathlib.Path(__file__).parent.iterdir()):
        if file.suffix in ('.py', '.mjs', '.md'):
            regular(file, 2_000_000)
            code.append({'path': file.name, 'bytes': file.stat().st_size, 'sha256': file_sha(file)})
    result = {'schemaVersion': 1, 'kind': 'draft-v63-public-terminal-evidence-audit',
              'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'pass': True,
              'sourceAccepted': False, 'publicationAccepted': False,
              'auditMode': mode,
              'publisherCommit': args.commit, 'publisherTree': tree,
              'publicReview': {'runId': args.run, 'runAttempt': args.attempt},
              'sourceCommit': config['sourceCommit'], 'sourceTree': config['sourceTree'],
              'sourceReview': {'runId': config['sourceRun'], 'runAttempt': config['sourceAttempt']},
              'config': {'path': CONFIG, 'bytes': config_file.stat().st_size, 'sha256': file_sha(config_file)},
              'checks': {**checks, 'provider': {'jobs': 11, 'artifacts': 12, 'rawJobLogs': 11,
                                               'downloadedArchives': 11, **workflow}},
              'publicArtifacts': archives, 'metadataOnlyArtifacts': [excluded], 'publicLogs': log_pins,
              'publicProvider': [{'path': file.relative_to(root).as_posix(), 'bytes': file.stat().st_size,
                                  'sha256': file_sha(file)} for file in provider_files],
              'auditorFiles': code, 'auditorInventorySha256': sha(encoded(code)),
              'limitations': ['Draft internal audit only. Root must independently review actual provider bytes before any acceptance.',
                              'github-pages ZIP was not downloaded: its metadata and upload log are bound, but archive bytes/CRC/union inventory are not independently recomputed from it.',
                              'Historical2605 and the complete new union are revalidated from frozen baseline/catalog and actual CI HTTP proof, not a new post-CI HTTP GET.',
                              'Deployment API snapshot is the canonical original CI snapshot; no independent post-CI deployment lookup or current-live-state claim.',
                              'Scripted software WebGL routes do not establish human discovery, physical-device performance, live ads or moderation.']}
    require(not output.exists(), 'Fresh output path required; never overwrite an acceptance receipt')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'pass': True, 'sourceAccepted': False, 'publicationAccepted': False,
                      'jobs': 11, 'artifacts': 12, 'verifiedSmallArchives': 11, 'pagesMetadataOnly': True,
                      'output': str(output)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['publisher', 'source', 'consumer', 'input', 'output']:
        parser.add_argument('--' + name, type=pathlib.Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--run', type=int, required=True)
    parser.add_argument('--attempt', type=int, required=True)
    try:
        main(parser.parse_args())
    except (AssertionError, KeyError, ValueError, TypeError, OSError, subprocess.SubprocessError, zipfile.BadZipFile) as error:
        print('PUBLIC AUDIT REJECTED: ' + str(error), file=sys.stderr)
        sys.exit(1)
