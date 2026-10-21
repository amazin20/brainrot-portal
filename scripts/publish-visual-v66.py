"""Publish exact accepted v66 artifacts without rebuilding Main's game.

The only changed historical URL is the explicitly authorised root entry. Its
original bytes are also retained under the new release's history directory.
All other historical paths remain byte-identical to the accepted Pages tar.
"""
import argparse
import hashlib
import importlib.util
import os
import pathlib
import shutil
import subprocess
import tarfile

CORE = pathlib.Path(__file__).with_name('publish-campaign-v63.py')
if hashlib.sha256(CORE.read_bytes()).hexdigest() != 'e6f431fb4e568e7a9196112523da2d9bde76d7d445f6e5dfe4fa5692ca6b6e3e':
    raise ValueError('Frozen Main archive/HTTP primitives changed')
spec = importlib.util.spec_from_file_location('immutable_v63_io', CORE)
io = importlib.util.module_from_spec(spec); spec.loader.exec_module(io)
check, load, write, sha, encoded, name, rows_valid, inventory = (getattr(io, key) for key in
    ['check', 'load', 'write', 'sha', 'encoded', 'name', 'rows_valid', 'inventory'])
api, pages, get, safe_extract, verify_http, producer = (getattr(io, key) for key in
    ['api', 'pages', 'get', 'safe_extract', 'verify_http', 'producer'])

CONFIG = 'tools/campaign-v66-release.json'
PREFIX = 'campaign-v66/'
HISTORICAL_ROOT = PREFIX + 'release/history/root-index-before-v66.html'
PROVENANCE = PREFIX + 'release/provenance.json'
PUBLISHER_PATHS = {HISTORICAL_ROOT, PROVENANCE}
OUTPUT = pathlib.Path('v66-provider')
PARTS = io.GROUPS
ARTIFACT_NAMES = sorted(['v66-dist', 'v66-yandex', 'v66-yandex-review-dist', 'v66-build',
    'v66-production-startup', 'v66-review-summary'] + ['v66-unit-' + str(i) for i in range(4)] +
    [prefix + group for prefix in ['v66-checker-platform-', 'v66-visual-'] for group in PARTS])
LIMITS = [
    'This publishes exact previously accepted Source bytes; Main game/source is neither built nor replaced.',
    'Every old public file remains at its original path except the deliberately changed root index; its original bytes are retained at ' + HISTORICAL_ROOT + '.',
    'Public native smoke covers ordinary desktop/mobile entry, gate, pause and one rendered room; it is not another full51-room playthrough.',
    'Original checker WARN/N/V remain in Source evidence. No live SDK/advertising, moderation, physical-phone FPS or complete master-TZ acceptance is claimed.',
    'Human playtesting, 500 meaningful castle stages and15-minute human speedrun are outside these technical publication checks.',
]


def config():
    c = load(CONFIG)
    check(c.get('frozen') is True and c.get('repository') == io.REPO and c.get('namespace') == PREFIX
          and c.get('version') == 'v66-visual-audit' and c.get('publicationAccepted') is False,
          'Draft/incomplete or wrong v66 publication pins')
    check(c['sourceBranch'] == 'upgrade/visual-audit-20261021'
          and c['sourceWorkflow'] == '.github/workflows/visual-audit-v66-review.yml', 'Wrong frozen Source')
    for key in ['sourceCommit', 'sourceTree', 'controllerParent']: io.hex_value(c[key], 40)
    for key in ['sourceRun', 'sourceAttempt']: check(io.positive_safe_integer(c[key]), 'Unfilled Source run/attempt')
    check(len(c['expectedJobs']) == 19 and len(set(c['expectedJobs'])) == 19, 'Incomplete exact Source job contract')
    check(c['expectedArtifactNames'] == ARTIFACT_NAMES and len(c['sourceArtifacts']) == len(ARTIFACT_NAMES)
          and sorted(a['name'] for a in c['sourceArtifacts']) == ARTIFACT_NAMES
          and len({a['id'] for a in c['sourceArtifacts']}) == len(ARTIFACT_NAMES), 'Unfilled/duplicate exact Source artifact pins')
    check(c['baselineRun'] == 39549937799 and c['baselineAttempt'] == 1
          and c['baselineDeployment'] == {'id': 7218570999, 'sha': 'cfad67aa7accfb84cdea2e6d4979d0d45b7d637e'}, 'Wrong accepted deployment')
    check(c['baselineArtifact'] == {'id': 12322419316, 'name': 'github-pages', 'size_in_bytes': 634063039,
          'digest': 'sha256:ac9a2fa5cf88685c303bf9b54ca8cfd45690778a40db05ca5e2bafafec215d46'}, 'Wrong accepted Pages payload')
    check(c['rootEntryChange'] == {'path': 'index.html', 'preserveOriginalAt': HISTORICAL_ROOT,
          'newTarget': PREFIX}, 'Unexpected historical overwrite permission')
    for pin in c['sourceArtifacts']: validate_artifact_pin(pin, 100_000_000)
    return c


def validate_artifact_pin(pin, maximum):
    check(set(pin) == {'id', 'name', 'size_in_bytes', 'digest'} and io.positive_safe_integer(pin['id'])
          and type(pin['size_in_bytes']) is int and 0 < pin['size_in_bytes'] <= maximum
          and isinstance(pin['name'], str) and pin['name'] and pin['digest'].startswith('sha256:'), 'Invalid exact artifact metadata')
    io.hex_value(pin['digest'][7:], 64)


def source_provider(c):
    run = api('actions/runs/' + str(c['sourceRun']))
    jobs = pages('actions/runs/' + str(c['sourceRun']) + '/attempts/' + str(c['sourceAttempt']) + '/jobs')
    artifacts = pages('actions/runs/' + str(c['sourceRun']) + '/artifacts')
    check(run['id'] == c['sourceRun'] and run['head_sha'] == c['sourceCommit'] and run['head_branch'] == c['sourceBranch']
          and run['path'].split('@')[0] == c['sourceWorkflow'] and run['run_attempt'] == c['sourceAttempt']
          and run['status'] == 'completed' and run['conclusion'] == 'success', 'Source is not the pinned successful run')
    check(sorted(j['name'] for j in jobs) == sorted(c['expectedJobs']) and len({j['id'] for j in jobs}) == 19
          and all(j['head_sha'] == c['sourceCommit'] and j['run_id'] == c['sourceRun'] and j['run_attempt'] == c['sourceAttempt']
                  and j['status'] == 'completed' and j['conclusion'] == 'success' for j in jobs), 'Source producer job contract failed')
    actual = [{key: a[key] for key in ['id', 'name', 'size_in_bytes', 'digest']} for a in artifacts]
    check(sorted(actual, key=lambda a: a['id']) == sorted(c['sourceArtifacts'], key=lambda a: a['id'])
          and all(not a['expired'] and a['workflow_run']['id'] == c['sourceRun']
                  and a['workflow_run']['head_sha'] == c['sourceCommit'] for a in artifacts), 'Source artifact provenance/digests changed')
    return {'run': run, 'jobs': jobs, 'artifacts': artifacts}


def accepted_baseline(c):
    check(sha(pathlib.Path(c['baselineCatalog']).read_bytes()) == c['baselineCatalogSha256'] ==
          '29b2f7bf144e7ec5c5b0bde251d6f64171a8fcc0d54cfd7ede4e6ed4d38f7aae', 'Accepted v64 catalog changed')
    check(sha(pathlib.Path(c['baselineAcceptance']).read_bytes()) == c['baselineAcceptanceSha256'] ==
          '572b0798fabd2183f8f34bc354ea4914377aacb9cc5ddd65505f7cdd8112ed33', 'Accepted v64 Root receipt changed')
    catalog, receipt = load(c['baselineCatalog']), load(c['baselineAcceptance'])
    rows = catalog['siteFiles']; rows_valid(rows)
    check(catalog['sourceAccepted'] is True and catalog['publicationAccepted'] is True
          and catalog['publicationRun'] == c['baselineRun'] and catalog['publicationRunAttempt'] == c['baselineAttempt']
          and receipt['pass'] is True and receipt['publicationAccepted'] is True and receipt['deployment']['runId'] == c['baselineRun']
          and len(rows) == 2772 and sum(r['bytes'] for r in rows) == 710047525
          and sha(encoded(rows)) == '9fd5659bb60e067ee2709a60b2267f9bfce93ffc45e9d3da3eea87347080288d', 'Baseline acceptance/inventory differs')
    check(not any(r['path'].startswith(PREFIX) for r in rows), 'v66 already occurs in baseline')
    return rows


def source_receipt(c):
    pin = c['sourceAcceptance']; name(pin['path']); io.hex_value(pin['sha256'], 64)
    check(sha(pathlib.Path(pin['path']).read_bytes()) == pin['sha256'], 'Independent Root Source receipt changed')
    r = load(pin['path'])
    check(r.get('pass') is True and r.get('sourceAccepted') is True
          and r.get('publicationAccepted') is False and r['sourceCommit'] == c['sourceCommit'] and r['sourceTree'] == c['sourceTree']
          and r['sourceReview'] == {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']}, 'Source acceptance missing or wrong')
    visual = r['assistantVisualInspection']
    check(visual['reviewer'] == 'Codex' and visual['accepted'] is True and visual['coverage'] == list(range(1, 52))
          and len(visual['images']) == 51 and [image['displayNumber'] for image in visual['images']] == list(range(1, 52)), 'Assistant visual coverage missing')
    check([image['stableLevel'] for image in visual['images']] == list(range(1, 41)) + list(range(42, 52)) + [41], 'Visual image numbering differs')
    summary = visual['summaryReceipt']; name(summary['path']); io.hex_value(summary['sha256'], 64)
    check(sha(pathlib.Path(summary['path']).read_bytes()) == summary['sha256'], 'Assistant summary receipt changed')
    for image in visual['images']:
        check(image['artifact'] in ARTIFACT_NAMES and image['artifact'].startswith('v66-visual-')
              and image['path'].startswith('room-' + str(image['stableLevel']).zfill(2) + '/')
              and image['path'].endswith(('.jpg', '.png')) and type(image['bytes']) is int and image['bytes'] > 0, 'Wrong actual visual image pin')
        name(image['path']); io.hex_value(image['sha256'], 64)
    check(all(r.get(key) is False for key in ['masterTzAccepted', 'humanPlaytest', 'liveSdkAccepted',
          'moderationAccepted', 'physicalPhonePerformanceAccepted']), 'Receipt scope is overstated or omitted')
    rows_valid(r['candidateFiles'], 100_000_000)
    validate_candidate_publish_paths(r['candidateFiles'])
    check(sum(row['bytes'] for row in r['candidateFiles']) == r['candidateBytes']
          and sha(encoded(r['candidateFiles'])) == r['candidateInventorySha256'], 'Inconsistent accepted candidate inventory')
    io.hex_value(r['technicalSummarySha256'], 64)
    return r


def lease(c, deployed=False, allow_pending=False):
    p = producer()
    check(os.environ['GITHUB_REPOSITORY'] == io.REPO and os.environ['GITHUB_REF'] == 'refs/heads/main', 'Wrong publisher origin')
    check(api('git/ref/heads/main')['object']['sha'] == p['GITHUB_SHA'], 'Main lease changed')
    check([row['sha'] for row in api('git/commits/' + p['GITHUB_SHA'])['parents']] == [c['controllerParent']], 'Publisher parent differs')
    check(api('git/ref/heads/' + c['sourceBranch'])['object']['sha'] == c['sourceCommit']
          and api('git/commits/' + c['sourceCommit'])['tree']['sha'] == c['sourceTree'], 'Source branch/tree lease changed')
    deployments = sorted(pages('deployments?environment=github-pages'), key=lambda d: d['id'], reverse=True)
    check(deployments, 'Missing Pages deployment history')
    d = deployments[0]; statuses = pages('deployments/' + str(d['id']) + '/statuses')
    own_url = 'https://github.com/' + io.REPO + '/actions/runs/' + p['GITHUB_RUN_ID']
    def own(value, states):
        return value['sha'] == p['GITHUB_SHA'] and states and any(states[0].get(key, '').rstrip('/') == own_url
            or states[0].get(key, '').startswith(own_url + '/') for key in ['log_url', 'target_url'])
    if deployed:
        check(own(d, statuses) and statuses[0]['state'] == 'success' and d['id'] > c['baselineDeployment']['id'], 'Live deployment is not this successful publisher')
    else:
        if allow_pending and own(d, statuses):
            check(statuses[0]['state'] in ['queued', 'pending', 'in_progress'] and len(deployments) > 1, 'Wrong pending publisher deployment')
            d = deployments[1]; statuses = pages('deployments/' + str(d['id']) + '/statuses')
        check({'id': d['id'], 'sha': d['sha']} == c['baselineDeployment'] and statuses and statuses[0]['state'] == 'success', 'Accepted baseline deployment lease changed')
    return {'deployment': d, 'statuses': statuses}


def download_artifact(pin, folder, maximum):
    validate_artifact_pin(pin, maximum)
    archive = OUTPUT / (str(pin['id']) + '.zip')
    get('https://api.github.com/repos/' + io.REPO + '/actions/artifacts/' + str(pin['id']) + '/zip', token=True,
        destination=archive, expected={'bytes': pin['size_in_bytes'], 'sha256': pin['digest'][7:]})
    rows = safe_extract(archive, folder, maximum)
    return {'metadata': pin, 'zipSha256': pin['digest'][7:], 'files': rows, 'folder': str(folder)}


def safe_pages_tar(archive, output, expected):
    """No extractall, links, overwrite, traversal, devices or unbounded members."""
    output = pathlib.Path(output); check(not output.exists() and not output.is_symlink(), 'Pages output must be fresh')
    expected_map = rows_valid(expected)
    with tarfile.open(archive, mode='r:') as tar:
        entries, seen, total = [], set(), 0
        for member in tar.getmembers():
            raw = member.name
            if raw in ['.', './']:
                check(member.isdir(), 'Invalid tar root'); continue
            relative = raw[2:] if raw.startswith('./') else raw
            relative = name(relative.rstrip('/') if member.isdir() else relative)
            check(relative not in seen and (member.isdir() or member.isfile()) and not member.issym() and not member.islnk(), 'Unsafe or duplicate Pages tar member')
            seen.add(relative); total += member.size
            check(len(seen) <= 20000 and 0 <= member.size <= 800_000_000 and total <= 800_000_000
                  and (not member.isdir() or member.size == 0), 'Unbounded Pages tar')
            if member.isfile():
                check(relative in expected_map and member.size == expected_map[relative]['bytes'], 'Unexpected/oversized historical file')
            entries.append((member, relative))
        files = {relative for member, relative in entries if member.isfile()}
        check(files == set(expected_map) and not any('/'.join(n.split('/')[:i]) in files for n in seen for i in range(1, len(n.split('/')))), 'Historical tar coverage/file-directory collision')
        output.mkdir(parents=True)
        for member, relative in entries:
            path = output / relative
            if member.isdir(): path.mkdir(parents=True, exist_ok=True)
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as src, path.open('xb') as dst: shutil.copyfileobj(src, dst)
    actual = inventory(output); check(actual == expected, 'Historical Pages payload is not the accepted inventory')
    return {'files': len(actual), 'bytes': sum(r['bytes'] for r in actual), 'inventorySha256': sha(encoded(actual)), 'method': 'pinned accepted Pages ZIP and safe artifact.tar extraction, complete per-file SHA-256'}


def restore_baseline(c, expected):
    run = api('actions/runs/' + str(c['baselineRun']))
    check(run['id'] == c['baselineRun'] and run['run_attempt'] == c['baselineAttempt'] and run['status'] == 'completed'
          and run['conclusion'] == 'success' and run['head_sha'] == c['baselineDeployment']['sha'], 'Accepted Pages producer changed')
    pin = c['baselineArtifact']; metadata = api('actions/artifacts/' + str(pin['id']))
    check({key: metadata[key] for key in pin} == pin and not metadata['expired']
          and metadata['workflow_run']['id'] == c['baselineRun'] and metadata['workflow_run']['head_sha'] == c['baselineDeployment']['sha'], 'Historical Pages artifact expired or differs')
    record = download_artifact(pin, OUTPUT / 'accepted-pages-wrapper', 800_000_000)
    check([r['path'] for r in record['files']] == ['artifact.tar'], 'Expected the one original Pages artifact.tar wrapper')
    restored = safe_pages_tar(OUTPUT / 'accepted-pages-wrapper/artifact.tar', 'pages', expected)
    return {'artifact': record, 'restored': restored}


def candidate(c, receipt):
    source = pathlib.Path('source'); folder = OUTPUT / 'v66-dist'
    check(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip() == c['sourceCommit']
          and subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=source, text=True).strip() == c['sourceTree'], 'Source checkout differs')
    actual = inventory(folder); info = load(folder / 'build-info.json')
    validate_candidate_publish_paths(actual)
    check(not (folder / 'release').exists() and not (folder / 'release').is_symlink(), 'Candidate uses reserved publisher release namespace')
    check(actual == receipt['candidateFiles'] and info['commit'] == info['gameCommit'] == info['interfaceCommit'] == c['sourceCommit']
          and info['version'] == c['version'] and int(info['run']) == c['sourceRun'] and info['levels'] == 51 and info['verified'] is False, 'Frozen consumer stamp/inventory differs')
    check([row for row in actual if row['path'] != 'build-info.json'] == info['files']
          and sha(encoded(info['files'])) == info['packageFilesSha256'], 'Consumer manifest differs')
    check(len(info['sourceInputs']) == info['sourceInputFiles'] and len({row['filename'] for row in info['sourceInputs']}) == len(info['sourceInputs'])
          and sha(encoded(info['sourceInputs'])) == info['sourceInputsSha256'], 'Source input manifest differs')
    for row in info['sourceInputs']:
        check(sha((source / name(row['filename'])).read_bytes()) == row['sha256'], 'Source input differs: ' + row['filename'])
    check([r['stableLevel'] for r in info['rooms']] == list(range(1, 41)) + list(range(42, 52)) + [41]
          and info['features']['tower']['checkpoints'] is False, 'Level order/castle checkpoint contract differs')
    return actual, info


def validate_summary(c, receipt):
    path = OUTPUT / 'v66-review-summary/report.json'
    check(sha(path.read_bytes()) == receipt['technicalSummarySha256'], 'Root-accepted technical summary differs')
    r = load(path)
    check(r['pass'] is True and r['sourceCommit'] == c['sourceCommit'] and str(r['runId']) == str(c['sourceRun'])
          and str(r['runAttempt']) == str(c['sourceAttempt']) and r['version'] == c['version'], 'Technical summary identity failed')
    check(r['unit']['counts']['pass'] == r['unit']['counts']['tests'] > 0
          and all(r['unit']['counts'][k] == 0 for k in ['fail', 'cancelled', 'skipped', 'todo'])
          and [row['displayNumber'] for row in r['routes']] == list(range(1, 52))
          and [row['displayNumber'] for row in r['visuals']] == list(range(1, 52))
          and r['originalCheckerTotals']['FAIL'] == 0 and all(row['routePass'] for row in r['routes'])
          and all(row['nativeHUD'] and row['ordinaryStart'] and row['shadows'] for row in r['visuals']), 'Source technical coverage incomplete')
    return {'sha256': sha(path.read_bytes()), 'unit': r['unit'], 'routes': len(r['routes']), 'visuals': len(r['visuals']),
            'visualImageCount': r['visualImageCount'], 'originalCheckerTotals': r['originalCheckerTotals']}


def validate_assistant_images(receipt):
    visual = receipt['assistantVisualInspection']
    for image in visual['images']:
        path = OUTPUT / image['artifact'] / name(image['path'])
        check(path.is_file() and not path.is_symlink() and path.stat().st_size == image['bytes']
              and sha(path.read_bytes()) == image['sha256'], 'Assistant-reviewed actual image differs: ' + image['path'])
    return {'reviewer': 'Codex', 'accepted': True, 'coverage': visual['coverage'], 'actualImages': visual['images'],
            'summaryReceipt': visual['summaryReceipt'], 'humanPlaytest': False}


def redirect_bytes():
    return ('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="refresh" content="0;url=./campaign-v66/"><title>Брейнрот Портал</title>'
        '<p><a href="./campaign-v66/">Открыть игру</a></p><script>'
        'const target=new URL("./campaign-v66/",location.href);target.search=location.search;target.hash=location.hash;location.replace(target.href);'
        '</script></html>\n').encode()


def validate_union(prior, union, redirect):
    old, new = rows_valid(prior), rows_valid(union)
    check(all(new.get(path) == row for path, row in old.items() if path != 'index.html'), 'Historical public file was removed or overwritten')
    check(new.get(HISTORICAL_ROOT) == {**old['index.html'], 'path': HISTORICAL_ROOT}, 'Original root bytes were not preserved')
    check(new.get('index.html') == {'path': 'index.html', 'bytes': len(redirect), 'sha256': sha(redirect)}, 'Wrong root redirect')
    additions = [row for row in union if row['path'] not in old]
    check(additions and all(row['path'].startswith(PREFIX) for row in additions), 'Unexpected new path outside v66')
    return additions


def validate_candidate_publish_paths(rows):
    paths = rows_valid(rows, 100_000_000)
    check(all(path != 'release' and not path.startswith('release/') for path in paths),
          'Candidate collides with reserved publisher release namespace')


def validate_candidate_union(candidate_rows, union):
    """Recheck every accepted consumer file after ALL publisher writes."""
    validate_candidate_publish_paths(candidate_rows)
    rows_valid(candidate_rows, 100_000_000)
    actual = rows_valid(union)
    expected = {PREFIX + row['path']: {**row, 'path': PREFIX + row['path']} for row in candidate_rows}
    check(all(actual.get(path) == row for path, row in expected.items()),
          'Exact accepted candidate bytes changed or disappeared after publisher metadata')
    check({path for path in actual if path.startswith(PREFIX)} == set(expected) | PUBLISHER_PATHS,
          'Unexpected publisher path outside the exact candidate and reserved metadata')
    return {'files': len(candidate_rows), 'bytes': sum(row['bytes'] for row in candidate_rows),
            'inventorySha256': sha(encoded(candidate_rows)), 'method': 'every exact candidate file rehashed in final PREFIX union after metadata'}


def write_reserved_json(path, value):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as output: output.write(encoded(value) + b'\n')


def assemble_candidate(folder, candidate_rows, prior, provenance, site=pathlib.Path('pages')):
    """Local-only assembly, separately testable without any provider API."""
    folder, site = pathlib.Path(folder), pathlib.Path(site)
    validate_candidate_publish_paths(candidate_rows)
    check(not (folder / 'release').exists() and not (folder / 'release').is_symlink(), 'Candidate uses reserved publisher release namespace')
    check(inventory(folder) == candidate_rows, 'Candidate changed before copying')
    shutil.copytree(folder, site / PREFIX)
    archive = site / HISTORICAL_ROOT; archive.parent.mkdir(parents=True, exist_ok=True)
    with (site / 'index.html').open('rb') as src, archive.open('xb') as dst: shutil.copyfileobj(src, dst)
    redirect = redirect_bytes(); (site / 'index.html').write_bytes(redirect)
    write_reserved_json(site / PROVENANCE, provenance)
    union = inventory(site)
    retained = validate_candidate_union(candidate_rows, union)
    additions = validate_union(prior, union, redirect)
    return union, additions, retained


def prepare(c):
    check(all(not p.exists() and not p.is_symlink() for p in [pathlib.Path('pages'), OUTPUT, pathlib.Path('proof')]), 'Fresh isolated output paths required')
    prior = accepted_baseline(c); receipt = source_receipt(c); provider = source_provider(c); deployment = lease(c)
    write('proof/source-provider.json', provider)
    records = [download_artifact(pin, OUTPUT / pin['name'], 100_000_000) for pin in c['sourceArtifacts']]
    validation = validate_summary(c, receipt); assistant_visual = validate_assistant_images(receipt)
    candidate_rows, info = candidate(c, receipt)
    restored = restore_baseline(c, prior)
    for target in [PREFIX, PREFIX + 'index.html', PREFIX + 'build-info.json']: get(io.BASE + target, absent=True)
    provenance = {'kind': 'v66-exact-source-publication', 'publicationAccepted': False,
        'sourceCommit': c['sourceCommit'], 'sourceTree': c['sourceTree'], 'sourceReview': {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']},
        'producer': producer(), 'candidateInventorySha256': sha(encoded(candidate_rows)), 'acceptedBaseline': restored['restored'],
        'rootEntryChange': c['rootEntryChange'], 'limitations': LIMITS}
    union, additions, retained = assemble_candidate(OUTPUT / 'v66-dist', candidate_rows, prior, provenance)
    write('proof/preparation.json', {'kind': 'v66-exact-artifact-preparation', 'publicationAccepted': False, 'producer': producer(),
        'configSha256': sha(pathlib.Path(CONFIG).read_bytes()), 'sourceCommit': c['sourceCommit'], 'sourceTree': c['sourceTree'],
        'sourceReview': {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']}, 'baselineDeployment': deployment,
        'baseline': restored, 'candidateFiles': candidate_rows, 'originalBuildInfoSha256': sha((OUTPUT / 'v66-dist/build-info.json').read_bytes()),
        'unionFiles': union, 'addedFiles': additions, 'candidateRetained': retained, 'sourceArtifacts': records, 'sourceValidation': validation, 'assistantVisualInspection': assistant_visual,
        'rootEntryChange': c['rootEntryChange'], 'limitations': LIMITS})


def prepared(c):
    s = load('proof/preparation.json')
    check(s['producer'] == producer() and s['configSha256'] == sha(pathlib.Path(CONFIG).read_bytes())
          and s['sourceCommit'] == c['sourceCommit'] and s['sourceTree'] == c['sourceTree'], 'Prepared producer/config/Source changed')
    validate_union(accepted_baseline(c), s['unionFiles'], redirect_bytes())
    receipt = source_receipt(c)
    check(s['candidateFiles'] == receipt['candidateFiles'], 'Prepared candidate differs from exact Root acceptance')
    check(s['candidateRetained'] == validate_candidate_union(receipt['candidateFiles'], s['unionFiles']), 'Prepared candidate preservation proof differs')
    return s


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('command', choices=['pins', 'prepare', 'before', 'public', 'final'])
    args = parser.parse_args(); c = config()
    if args.command == 'pins':
        with open(os.environ['GITHUB_OUTPUT'], 'a') as out: out.write('source_commit=' + c['sourceCommit'] + '\nsource_run=' + str(c['sourceRun']) + '\n')
        return
    if args.command == 'prepare': prepare(c); return
    s = prepared(c); source_provider(c); source_receipt(c)
    if args.command == 'before':
        d = lease(c, allow_pending=True)
        for target in [PREFIX, PREFIX + 'index.html', PREFIX + 'build-info.json']: get(io.BASE + target, absent=True)
        write('proof/before-deploy.json', {'publicationAccepted': False, 'producer': producer(), 'deployment': d,
            'acceptedBaseline': s['baseline']['restored'], 'rootEntryChange': c['rootEntryChange']})
    elif args.command == 'public':
        d = lease(c, deployed=True); result = verify_http(s['unionFiles'])
        check(sha(get(io.BASE + PREFIX + 'build-info.json')) == s['originalBuildInfoSha256'], 'Live consumer stamp differs')
        write('proof/public-http.json', {'pass': True, 'publicationAccepted': False, 'producer': producer(), 'union': result, 'deployment': d})
    else:
        jobs = pages('actions/runs/' + os.environ['GITHUB_RUN_ID'] + '/attempts/' + os.environ['GITHUB_RUN_ATTEMPT'] + '/jobs')
        previous = [j for j in jobs if j['name'] != 'verify']
        check(sorted(j['name'] for j in previous) == ['deploy', 'native-smoke', 'prepare', 'public-http']
              and all(j['status'] == 'completed' and j['conclusion'] == 'success' for j in previous), 'Public producer job failed or absent')
        http, browser = load('proof/public-http.json'), load('proof/native/public-browser-report.json')
        check(http['pass'] is True and http['producer'] == producer() and http['union'] == {'files': len(s['unionFiles']),
            'bytes': sum(r['bytes'] for r in s['unionFiles']), 'inventorySha256': sha(encoded(s['unionFiles'])),
            'method': 'complete HTTP GET, exact length and SHA-256 for every file'}, 'Public HTTP union proof differs')
        check(browser['pass'] is True and browser['producer'] == producer() and browser['sourceCommit'] == c['sourceCommit']
              and browser['sourceTree'] == c['sourceTree'] and browser['rootRedirectObserved'] is True
              and browser['normalGuestNoQaBridge'] is True and len(browser['cases']) == 2, 'Actual ordinary public native smoke failed')
        for case in browser['cases']:
            canvas = case['gameCanvas']
            check(case['frame']['ok'] is True and case['frame']['includesHTML'] is True
                  and canvas['ok'] is True and canvas['includesHTML'] is False and canvas['selector'] == '#game canvas'
                  and canvas['bytes'] > 0 and canvas['pixels']['width'] >= 100 and canvas['pixels']['height'] >= 100
                  and all(canvas['pixels'][area]['colors'] >= 16 and canvas['pixels'][area]['maxChannelStd'] >= 3
                          and canvas['pixels'][area]['opaqueFraction'] >= .98 for area in ['whole', 'central']),
                  'Ordinary public native canvas is blank or only HTML was inspected')
            io.hex_value(canvas['sha256'], 64)
        write('proof/final-publication.json', {'kind': 'v66-public-technical-checks', 'technicalChecksPassed': True,
            'publicationAccepted': False, 'requiresIndependentRootAcceptance': True, 'producer': producer(),
            'sourceCommit': c['sourceCommit'], 'sourceTree': c['sourceTree'], 'sourceReview': s['sourceReview'],
            'publicJobs': previous, 'union': http['union'], 'deployment': lease(c, deployed=True), 'browser': browser,
            'assistantVisualInspection': s['assistantVisualInspection'],
            'historicalPathsUnchanged': 2771, 'originalRootBytesPreservedAt': HISTORICAL_ROOT,
            'masterTzAccepted': False, 'humanPlaytest': False, 'liveSdkAccepted': False, 'moderationAccepted': False,
            'physicalPhonePerformanceAccepted': False, 'limitations': LIMITS})


if __name__ == '__main__': main()
