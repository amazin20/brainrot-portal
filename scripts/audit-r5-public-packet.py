"""Recover only the transport of the already recorded exact R5 PUBLIC proof."""
import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import subprocess
import time
import types
import urllib.parse
import urllib.request
import zipfile

CONFIG = pathlib.Path('tools/r5-public-packet-audit.json')
HELPER = pathlib.Path('scripts/publish-tower41-native.py')


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_helper(config):
    require(sha(HELPER.read_bytes()) == config['frozenHelperSha256'], 'Frozen validator bytes changed')
    spec = importlib.util.spec_from_file_location('frozen_r5', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    require(helper.MAX_VERIFICATION_BYTES == config['limits']['packetBytes'] == 100_000_000,
            'The original bounded packet limit must remain unchanged')
    return helper


def public_identity(config):
    return {'sourceCommit': config['sourceCommit'], 'publisherCommit': config['publisher'],
            'publicationRun': config['publicationRun'], 'sourceReview': config['sourceReview']}


def transport_identity(config):
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'Actual GitHub runner required')
    require(os.environ.get('GITHUB_REPOSITORY') == config['repository'], 'Wrong transport repository')
    require(os.environ.get('GITHUB_EVENT_NAME') == 'push', 'Only the pinned audit branch push is allowed')
    require(os.environ.get('GITHUB_REF') == 'refs/heads/' + config['branch'], 'Wrong audit branch')
    require(os.environ.get('GITHUB_RUN_ATTEMPT') == '1', 'Transport reruns require a new reviewed branch revision')
    commit = os.environ.get('GITHUB_SHA', '')
    require(re.fullmatch('[a-f0-9]{40}', commit), 'Wrong transport commit')
    require(commit not in (config['publisher'], config['sourceCommit']), 'Original SOURCE/PUBLIC cannot be relabelled as transport')
    run = os.environ.get('GITHUB_RUN_ID', '')
    require(re.fullmatch('[1-9][0-9]*', run), 'Wrong transport run')
    require(int(run) not in (config['publicationRun'], config['sourceReview']['runId']), 'Original SOURCE/PUBLIC run cannot be transport producer')
    return {'repository': config['repository'], 'branch': config['branch'], 'commit': commit,
            'runId': int(run), 'runAttempt': 1, 'runURL': 'https://github.com/' + config['repository'] + '/actions/runs/' + run,
            'scope': 'Read-only transport producer; never a new public capture or deployment'}


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        require(urllib.parse.urlparse(newurl).scheme == 'https', 'Provider redirect must remain HTTPS')
        target = super().redirect_request(request, fp, code, message, headers, newurl)
        if target is not None and urllib.parse.urlparse(request.full_url).netloc != urllib.parse.urlparse(newurl).netloc:
            target.remove_header('Authorization')
        return target


def provider_request(config, resource):
    require(os.environ.get('GITHUB_TOKEN'), 'Read-only built-in token required')
    request = urllib.request.Request('https://api.github.com/repos/' + config['repository'] + '/' + resource,
        headers={'Authorization': 'Bearer ' + os.environ['GITHUB_TOKEN'], 'Accept': 'application/vnd.github+json',
                 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'brainrot-r5-public-proof-transport'})
    return urllib.request.build_opener(SafeRedirect()).open(request, timeout=90)


def provider_json(config, resource):
    with provider_request(config, resource) as response:
        require(response.status == 200, 'Provider GET failed')
        data = response.read(25_000_001)
    require(len(data) <= 25_000_000, 'Provider metadata exceeds byte limit')
    return json.loads(data)


def job_summary(job):
    return {key: job.get(key) for key in ['id', 'name', 'head_sha', 'run_id', 'run_attempt', 'status', 'conclusion',
                                         'started_at', 'completed_at', 'steps']}


def assert_provider(config, run, jobs, artifact, public_log, main, publisher_git):
    for key in ['id', 'head_sha', 'head_branch', 'path', 'event', 'run_attempt', 'status', 'conclusion']:
        require(run.get(key) == config['run'].get(key), 'Original PUBLIC run changed: ' + key)
    require(run['repository']['full_name'] == config['repository'], 'Original repository changed')
    require(run['id'] == config['publicationRun'] and run['head_sha'] == config['publisher'] and
            run['run_attempt'] == 1 and run['status'] == 'completed' and run['conclusion'] == 'failure',
            'Original transport failure must remain honestly labelled failure')
    require(sorted(map(job_summary, jobs), key=lambda row: row['id']) ==
            sorted(map(job_summary, config['jobs']), key=lambda row: row['id']), 'Original job/step statuses changed')
    require(len(jobs) == 2, 'Wrong original job cohort')
    public_job = next(row for row in jobs if row['id'] == config['publicLog']['id'])
    failed = [step for step in public_job['steps'] if step['conclusion'] == 'failure']
    require(len(failed) == 1 and failed[0]['number'] == 17 and
            failed[0]['name'] == 'Prepare the bounded independent verification packet after successful public acceptance',
            'Failure is not the narrowly pinned packet-only failure')
    for number in range(7, 17):
        require(next(step for step in public_job['steps'] if step['number'] == number)['conclusion'] == 'success',
                'Original deploy, native proof or independent decode failed')
    pin = config['publicLog']
    require(len(public_log) == pin['bytes'] and sha(public_log) == pin['sha256'], 'Original complete public job log changed')
    require(b'ValueError: Verification packet exceeds bounded transport budget' in public_log,
            'The original failure is not the pinned transport-budget error')
    for key in ['id', 'name', 'size_in_bytes', 'digest', 'expired', 'workflow_run']:
        require(artifact.get(key) == config['artifact'].get(key), 'Original full proof artifact changed: ' + key)
    require(artifact['expired'] is False and artifact['workflow_run']['id'] == config['publicationRun'] and
            artifact['workflow_run']['head_sha'] == config['publisher'], 'Full proof has wrong PUBLIC origin')
    require(main['object']['sha'] == config['publisher'], 'Main changed while rescuing read-only transport')
    require(publisher_git['sha'] == config['publisher'] and publisher_git['tree']['sha'] == config['tree'] and
            [parent['sha'] for parent in publisher_git['parents']] == [config['parent']], 'Wrong frozen publisher tree/parent')


def latest_deployment(config):
    rows = provider_json(config, 'deployments?environment=github-pages&per_page=100')
    require(isinstance(rows, list) and rows, 'No actual Pages deployment row')
    latest = max(rows, key=lambda row: row['id'])
    statuses = provider_json(config, 'deployments/' + str(latest['id']) + '/statuses?per_page=100')
    require(isinstance(statuses, list) and statuses, 'No actual latest Pages deployment status')
    status = max(statuses, key=lambda row: row['id'])
    require(latest['sha'] == config['publisher'], 'Newer unknown Pages deployment blocks read-only checkpoint acceptance')
    run_url = 'https://github.com/' + config['repository'] + '/actions/runs/' + str(config['publicationRun'])
    require((status.get('log_url') == run_url or status.get('log_url', '').startswith(run_url + '/')) and status['state'] in ('success', 'failure', 'error', 'inactive'),
            'Latest deployment does not belong to the exact authenticated completed PUBLIC job')
    return {'deployment': latest, 'status': status, 'originalCIConclusion': 'failure',
            'scope': 'Exact already deployed bd748 PUBLIC run only; no generic failed-deployment waiver'}


def provider(config, helper, output):
    output = pathlib.Path(output)
    transport = transport_identity(config)
    run = provider_json(config, 'actions/runs/' + str(config['publicationRun']))
    jobs_response = provider_json(config, 'actions/runs/' + str(config['publicationRun']) + '/attempts/1/jobs?per_page=100')
    require(jobs_response['total_count'] == 2, 'Original jobs pagination/cohort mismatch')
    artifact = provider_json(config, 'actions/artifacts/' + str(config['artifact']['id']))
    main = provider_json(config, 'git/ref/heads/main')
    publisher_git = provider_json(config, 'git/commits/' + config['publisher'])
    logs = {}
    for job in config['jobs']:
        with provider_request(config, 'actions/jobs/' + str(job['id']) + '/logs') as response:
            logs[job['id']] = response.read(20_000_001)
        require(0 < len(logs[job['id']]) <= 20_000_000, 'Original full job log byte limit')
        pin = config['publicLog'] if job['id'] == config['publicLog']['id'] else config['assemblyLog']
        require(len(logs[job['id']]) == pin['bytes'] and sha(logs[job['id']]) == pin['sha256'], 'Original complete provider log changed')
    assert_provider(config, run, jobs_response['jobs'], artifact, logs[config['publicLog']['id']], main, publisher_git)
    actual_transport = provider_json(config, 'actions/runs/' + str(transport['runId']))
    require(actual_transport['head_sha'] == transport['commit'] and actual_transport['path'] == config['workflow'] and
            actual_transport['head_branch'] == config['branch'] and actual_transport['run_attempt'] == 1 and
            actual_transport['event'] == 'push', 'Actual audit run differs from inherited transport identity')
    actual_deployment = latest_deployment(config)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    require(head == transport['commit'] and subprocess.check_output(['git', 'rev-parse', 'HEAD^'], text=True).strip() == config['publisher'],
            'Audit checkout is not a direct child of the exact frozen publisher')
    require(subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], text=True) == '', 'Tracked audit bytes changed')
    changes = subprocess.check_output(['git', 'diff', '--name-status', config['publisher'], 'HEAD'], text=True).strip().splitlines()
    require(sorted(changes) == sorted('A\t' + name for name in [config['workflow'], 'scripts/audit-r5-public-packet.py',
        'scripts/test-audit-r5-public-packet.py', 'tools/r5-public-packet-audit.json']), 'Audit commit must add only the four read-only controller files')
    for name, value in [('original-run', run), ('original-jobs', jobs_response), ('original-artifact', artifact),
                        ('original-publisher-git', publisher_git), ('main-before', main), ('transport-run', actual_transport), ('original-latest-deployment', actual_deployment)]:
        helper.write_new_json(output / 'provider' / (name + '.json'), value)
    for job_id, data in logs.items():
        path = output / 'provider' / (str(job_id) + '.log')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return transport


def restore(config, helper, output):
    output = helper.no_symlinks(output)
    require(not output.exists(), 'Refuse to overwrite rescue inputs')
    output.mkdir(parents=True)
    transport = provider(config, helper, output)
    artifact = config['artifact']
    archive = output / 'original-full-proof.zip'
    total, digest = 0, hashlib.sha256()
    with provider_request(config, 'actions/artifacts/' + str(artifact['id']) + '/zip') as response, archive.open('xb') as target:
        require(response.status == 200, 'Full proof artifact download failed')
        for chunk in iter(lambda: response.read(1024 * 1024), b''):
            total += len(chunk)
            require(total <= artifact['size_in_bytes'] <= config['limits']['privateProofBytes'], 'Oversized original proof archive')
            digest.update(chunk)
            target.write(chunk)
    require(total == artifact['size_in_bytes'] and 'sha256:' + digest.hexdigest() == artifact['digest'], 'Original ZIP byte/hash mismatch')
    original = output / 'original-proof'
    original.mkdir()
    rows = []
    with zipfile.ZipFile(archive) as zipped:
        entries = helper.zip_entries(zipped, config['limits']['privateProofBytes'])
        for entry, name, directory in entries:
            destination = original / name
            if directory:
                destination.mkdir(parents=True, exist_ok=True)
            else:
                with zipped.open(entry) as stream:
                    helper.stream_to_file(stream, destination, entry.file_size)
                rows.append({'path': name, 'bytes': destination.stat().st_size, 'sha256': helper.sha256_file(destination)})
    rows.sort(key=lambda row: row['path'])
    helper.checked_rows(rows, 'Original full proof ZIP members', config['limits']['privateProofBytes'])
    receipt = {'kind': 'exact-R5-read-only-full-proof-restore', 'pass': True, 'publicationAccepted': False,
               **public_identity(config), 'publicationRunAttempt': 1, 'originalCIConclusion': 'failure',
               'transportProducer': transport, 'artifact': artifact, 'archiveBytes': total, 'archiveSha256': digest.hexdigest(),
               'files': rows, 'filesSha256': helper.inventory_sha256(rows), 'allMemberCRCChecked': True,
               'nestedArchivePayloadsAudited': False, 'newDeployment': False, 'newRouteCapture': False}
    helper.write_new_json(output / 'restore-receipt.json', receipt)


def closure(config, helper, original):
    binding = helper.read_json(original / 'package-binding.json')
    castle = helper.read_json(original / 'public-native/evidence.json')
    room20 = helper.read_json(original / 'public-foundation20/foundation20-native-report.json')
    names = {'manifest.json', 'package-binding.json', 'public-bytes.json', 'baseline-manifest.json', 'predeploy-public-bytes.json',
             'public-native/evidence.json', 'public-native/camera-observation.json',
             'public-foundation20/foundation20-native-report.json', 'public-foundation20/foundation20-native-camera.json',
             'public-foundation20/foundation20-telemetry.jsonl', 'public-foundation20/foundation20-native-pixels.log',
             'review-artifacts/native-foundation20/foundation20-native-report.json', 'review-artifacts/native-foundation20/binding.json',
             'review-artifacts/native-foundation20/foundation20-native-camera.json', 'review-artifacts/native-foundation20/foundation20-telemetry.jsonl'}
    for prefix, report in [('public-native/', castle), ('public-foundation20/', room20)]:
        filename = report['video']['filename']
        require(re.fullmatch('[A-Za-z0-9_-]+\\.mp4', filename), 'Unsafe actual movie basename')
        names.add(prefix + filename)
    for suffix in ['source.json', 'package.json']:
        file = helper.unique_suffix(original / 'review-artifacts/source', binding['artifacts']['source']['files'], suffix, 'Frozen source camera inputs')
        names.add(file.relative_to(original).as_posix())
    for job in binding['jobs']:
        row = job['rawLog']
        file = helper.ordinary_file(original / row['path'])
        require(file.stat().st_size == row['bytes'] and helper.sha256_file(file) == row['sha256'], 'Original frozen SOURCE provider log changed')
        names.add(row['path'])
    # Current receipt names are exact; historical cache directories are excluded.
    names.update({'github-guard-prepare.json', 'github-guard-deploy.json', 'downloaded-inputs.json', 'recovery-failed-provider.json'})
    return sorted(names)


def decode_movies(helper, curated):
    receipts = []
    for prefix, report_name in [('public-native', 'evidence.json'), ('public-foundation20', 'foundation20-native-report.json')]:
        report = helper.read_json(curated / prefix / report_name)
        video = report['video']
        movie = curated / prefix / video['filename']
        raw = subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', str(movie)], timeout=300)
        probe = json.loads(raw)
        require(len(probe['streams']) == 1, 'Movie has unexpected streams')
        stream = probe['streams'][0]
        require(stream['codec_type'] == 'video' and stream['codec_name'] == 'h264' and stream['width'] == 640 and stream['height'] == 360 and
                int(stream['nb_read_frames']) == video['frames'] and stream['avg_frame_rate'] == '4/1', 'Actual movie decoded format/frame count changed')
        require(abs(float(probe['format']['duration']) - video['durationSeconds']) < .01, 'Actual movie duration changed')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-xerror', '-i', str(movie), '-f', 'null', '-'], check=True, timeout=300)
        receipts.append({'path': prefix + '/' + video['filename'], 'sha256': helper.sha256_file(movie), 'fullyDecoded': True,
                         'frames': video['frames'], 'probe': probe})
    return receipts


def packet(config, helper, restored, output):
    restored = helper.ordinary_directory(restored)
    receipt = helper.read_json(restored / 'restore-receipt.json')
    require(receipt['pass'] is True and receipt['artifact'] == config['artifact'], 'Original restoration receipt changed')
    helper.exact_identity(receipt, public_identity(config), 'Read-only restoration')
    require(receipt['publicationRunAttempt'] == 1 and receipt['originalCIConclusion'] == 'failure' and
        receipt['transportProducer'] == transport_identity(config), 'Restored historical/transport identity changed')
    require(receipt.get('kind') == 'exact-R5-read-only-full-proof-restore' and receipt.get('allMemberCRCChecked') is True and
        receipt.get('nestedArchivePayloadsAudited') is False and receipt.get('newDeployment') is False and
        receipt.get('newRouteCapture') is False, 'Restoration scope/honesty flags changed')
    archive = helper.ordinary_file(restored / 'original-full-proof.zip')
    require(receipt.get('archiveBytes') == config['artifact']['size_in_bytes'] == archive.stat().st_size and
        receipt.get('archiveSha256') == config['artifact']['digest'][7:] == helper.sha256_file(archive), 'Authenticated original full ZIP changed')
    original = restored / 'original-proof'
    require(helper.inventory(original, config['limits']['privateProofBytes']) == receipt['files'] and
        helper.inventory_sha256(receipt['files']) == receipt['filesSha256'], 'Full restored ZIP inventory changed')
    mapping = {row['path']: row for row in receipt['files']}
    curated = helper.no_symlinks(restored / 'curated-proof')
    require(not curated.exists(), 'Refuse to overwrite curated proof')
    curated.mkdir()
    names = closure(config, helper, original)
    selected = []
    for name in names:
        require(name in mapping, 'Mandatory actual proof member missing: ' + name)
        file = helper.ordinary_file(original / name)
        require(file.stat().st_size == mapping[name]['bytes'] and helper.sha256_file(file) == mapping[name]['sha256'], 'Restored proof member changed: ' + name)
        if file.suffix != '.mp4':
            require(file.stat().st_size <= config['limits']['metadataBytes'], 'Mandatory metadata exceeds original byte limit')
        target = curated / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(file, target)
        selected.append(mapping[name])
    expected = public_identity(config)
    manifest = helper.read_json(curated / 'manifest.json')
    rows = helper.check_manifest(manifest, 'published', expected)
    require(len(rows) == config['siteFiles'] and sum(row['bytes'] for row in rows) == config['siteBytes'] and
            helper.inventory_sha256(rows) == config['siteInventorySha256'] and
            helper.sha256_file(curated / 'package-binding.json') == config['packageBindingSha256'], 'Exact1957 baseline union/binding changed')
    movies = decode_movies(helper, curated)
    helper.verify(types.SimpleNamespace(manifest=str(curated / 'manifest.json'), base='https://amazin20.github.io/brainrot-portal/',
        phase='published', output=str(curated / 'transport-current-public-bytes.json'), source=config['sourceCommit'],
        publisher=config['publisher'], run=str(config['publicationRun']), review_run=str(config['sourceReview']['runId']), review_attempt='1'))
    # The complete provider and restore inventory are small selected sidecars;
    # their original PUBLIC origin stays distinct from the audit transport run.
    shutil.copytree(restored / 'provider', curated / 'transport-provider')
    helper.write_new_json(curated / 'read-only-transport-rescue.json', {
        'kind': 'R5-public-proof-transport-rescue', 'pass': True, 'publicationAccepted': False,
        **expected, 'publicationRunAttempt': 1, 'originalCIConclusion': 'failure',
        'originalFailureScope': 'Only step17 exceeded the packet transport budget; deploy/PRE/POST/PUBLIC20/PUBLIC41/movie/save steps succeeded',
        'transportProducer': receipt['transportProducer'], 'originalArtifact': config['artifact'],
        'allOriginalZipMembers': receipt['files'], 'allOriginalZipMembersSha256': receipt['filesSha256'],
        'allOriginalMembersCRCChecked': True, 'nestedArchivePayloadsAudited': False,
        'selection': [{'path': row['path'], 'bytes': row['bytes'], 'sha256': row['sha256'], 'selected': row['path'] in names,
                       'reason': 'Actual current proof dependency or provider sidecar' if row['path'] in names else 'Historical cache, source footage, production copy or unrelated transport payload'} for row in receipt['files']],
        'decodedActualPublicMovies': movies, 'freshReadOnlyHTTPReceipt': 'transport-current-public-bytes.json',
        'freshHTTPProducer': receipt['transportProducer'], 'newDeployment': False, 'newRouteCapture': False,
        'scope': 'Transport-only receipt. Root independent acceptance remains pending; the original run conclusion is unchanged.'})
    helper.write_new_json(curated / 'transport-latest-deployment-after.json', latest_deployment(config))
    before = helper.inventory(curated, helper.MAX_VERIFICATION_BYTES)
    args = types.SimpleNamespace(proof=str(curated), output=str(output), source=config['sourceCommit'], publisher=config['publisher'],
                                 run=str(config['publicationRun']), review_run=str(config['sourceReview']['runId']), review_attempt='1')
    helper.verification_bundle(args)
    require(helper.inventory(curated, helper.MAX_VERIFICATION_BYTES) == before, 'Curated proof changed during frozen semantic acceptance')
    require(helper.inventory(original, config['limits']['privateProofBytes']) == receipt['files'], 'Full original proof changed during packet validation')
    require(sha(HELPER.read_bytes()) == config['frozenHelperSha256'], 'Frozen semantic helper changed')
    require(archive.stat().st_size == receipt['archiveBytes'] and helper.sha256_file(archive) == receipt['archiveSha256'], 'Original authenticated ZIP changed during packet verification')
    main = provider_json(config, 'git/ref/heads/main')
    require(main['object']['sha'] == config['publisher'], 'Main changed during read-only acceptance')
    print(json.dumps({'pass': True, 'packet': str(output), 'publicationAccepted': False, 'originalPublicationRun': config['publicationRun'],
                      'transportRun': receipt['transportProducer']['runId'], 'originalCIConclusion': 'failure', 'newDeployment': False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['restore', 'packet'])
    parser.add_argument('--restored', default='r5-transport')
    parser.add_argument('--output', default='r5-public-verification-packet')
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text())
    helper = load_helper(config)
    if args.command == 'restore':
        restore(config, helper, args.restored)
    else:
        packet(config, helper, args.restored, args.output)


if __name__ == '__main__':
    main()
