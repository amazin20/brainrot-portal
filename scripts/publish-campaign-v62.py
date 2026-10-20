"""Append an independently accepted immutable v62 package; never rebuild a game.

Only the new release configuration triggers this publisher. The final receipt
deliberately leaves publicationAccepted false for independent root review.
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import http.client
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

REPO = 'amazin20/brainrot-portal'
BASE = 'https://amazin20.github.io/brainrot-portal/'
PREFIX = 'campaign-v62/'
URL = BASE + PREFIX
CONFIG = 'tools/campaign-v62-release.json'
BASELINE = (2524, 683517693, '7e880fb0bcbc6d7b1625f2fc87ee9e40adc5ac4d6700a884681e49bf1a550a5f')
CATALOG_SHA = '694d6b5ec4ffb680e4c4a5981e0417157622241a84108e74c30a1afa29de1531'
BASELINE_DEPLOYMENT = {'id': 7142692882, 'sha': '08a11c3d7e91b06588d3877fb8d674e111d01476'}
SOURCE_BRANCH = 'upgrade/biosphere-20261020'
SOURCE_WORKFLOW = '.github/workflows/biosphere-review.yml'
GROUPS = {'early': list(range(1, 11)), 'energy': list(range(11, 21)),
          'living': list(range(21, 31)), 'optics': list(range(31, 41)),
          'fracture': list(range(42, 52)), 'castle': [41]}
ATTACK_GROUPS = ('early', 'later')
LEGACY_ROUTE_RESET_COUNTER_SCOPE='reported journey counters after legacy fixture initialization; the initial fixture reset is outside these counters; specialized drivers retain their own stricter proofs'
MAX_SAFE_INTEGER = 2**53-1
def positive_safe_integer(value):return type(value) is int and 0<value<=MAX_SAFE_INTEGER
MAX_SITE = 800_000_000
MAX_PACKAGE = 100_000_000
MAX_PROOF = 2_000_000_000


class ContentMismatch(ValueError):
    pass


def check(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def load(path):
    def pairs(items):
        result = {}
        for key, value in items:
            check(key not in result, 'Duplicate JSON key: ' + key)
            result[key] = value
        return result
    data = pathlib.Path(path).read_bytes()
    check(len(data) <= 25_000_000, 'Oversized metadata')
    return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: check(False, 'Nonfinite JSON'))


def write(path, value):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False).encode() + b'\n')


def hex_value(value, length):
    check(isinstance(value, str) and re.fullmatch('[0-9a-f]{' + str(length) + '}', value), 'Invalid immutable hash')
    return value


def name(value):
    check(isinstance(value, str) and value and '\\' not in value and not value.startswith('/')
          and not re.match(r'^[A-Za-z]:', value) and len(value.encode()) < 2048
          and all(ord(c) >= 32 and ord(c) != 127 for c in value)
          and all(p not in ('', '.', '..') for p in value.split('/')), 'Unsafe path: ' + repr(value))
    return value


def rows_valid(rows, limit=MAX_SITE):
    check(isinstance(rows, list) and 0 < len(rows) <= 10000, 'Invalid file inventory')
    keys, total = [], 0
    for row in rows:
        check(set(row) == {'path', 'bytes', 'sha256'}, 'Invalid inventory member')
        keys.append(name(row['path']))
        check(type(row['bytes']) is int and 0 <= row['bytes'] <= limit, 'Invalid member size')
        total += row['bytes']
        hex_value(row['sha256'], 64)
    check(keys == sorted(set(keys)) and total <= limit, 'Duplicate, unsorted or oversized inventory')
    check(not any('/'.join(k.split('/')[:i]) in keys for k in keys for i in range(1, len(k.split('/')))), 'File/directory collision')
    return {row['path']: row for row in rows}


def inventory(root):
    root = pathlib.Path(root)
    result = []
    for p in sorted(root.rglob('*')):
        check(not p.is_symlink() and (p.is_file() or p.is_dir()), 'Special inventory member')
        if p.is_file():
            result.append({'path': name(p.relative_to(root).as_posix()), 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())})
    # Path objects compare components; accepted catalogs sort complete POSIX paths.
    result.sort(key=lambda row: row['path'])
    rows_valid(result)
    return result


class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        check(urllib.parse.urlsplit(new_url).scheme == 'https', 'Insecure redirect')
        redirected = super().redirect_request(request, fp, code, message, headers, new_url)
        if urllib.parse.urlsplit(request.full_url).netloc != urllib.parse.urlsplit(new_url).netloc:
            redirected.remove_header('Authorization')
            redirected.remove_header('Cookie')
        return redirected


def get(url, *, expected=None, destination=None, token=False, limit=25_000_000, absent=False, response_meta=None):
    """Bounded idempotent GET retry; no authentication follows a signed redirect."""
    for attempt in range(5):
        tmp = None
        try:
            headers = {'Accept-Encoding': 'identity', 'User-Agent': 'brainrot-append-v62'}
            if token:
                check(url.startswith('https://api.github.com/repos/' + REPO + '/'), 'Token outside repository API')
                headers.update(Authorization='Bearer ' + os.environ['GITHUB_TOKEN'], Accept='application/vnd.github+json')
            with urllib.request.build_opener(Redirect()).open(urllib.request.Request(url, headers=headers), timeout=90) as response:
                check(response.status == 200 and not absent, 'Expected an absent v62 namespace' if absent else 'GET did not return 200')
                if response_meta is not None:
                    response_meta.update(url=response.url, status=response.status)
                if not token:
                    check(response.url.startswith(BASE), 'Public GET redirected outside the accepted site')
                digest, count, chunks = hashlib.sha256(), 0, []
                if destination:
                    destination = pathlib.Path(destination)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    tmp = destination.with_name(destination.name + '.partial')
                with (tmp.open('wb') if tmp else open(os.devnull, 'wb')) as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        count += len(chunk)
                        check(count <= (expected['bytes'] if expected else limit), 'GET exceeds exact byte budget')
                        digest.update(chunk)
                        if tmp:
                            output.write(chunk)
                        elif not expected:
                            chunks.append(chunk)
                if expected:
                    if count != expected['bytes'] or digest.hexdigest() != expected['sha256']:
                        raise ContentMismatch('GET content differs from exact accepted bytes: ' + url)
                if tmp:
                    os.replace(tmp, destination)
                return b''.join(chunks) if not destination else {'bytes': count, 'sha256': digest.hexdigest()}
        except urllib.error.HTTPError as error:
            if absent and error.code == 404:
                return None
            if error.code not in (408, 429, 500, 502, 503, 504) or attempt == 4:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError, http.client.HTTPException, ContentMismatch):
            if attempt == 4:
                raise
        finally:
            if tmp and tmp.exists():
                tmp.unlink()
        time.sleep(min(2 ** attempt, 16))


def api(endpoint):
    return json.loads(get('https://api.github.com/repos/' + REPO + '/' + endpoint, token=True))


def pages(endpoint):
    result, page = [], 1
    while True:
        values = api(endpoint + ('&' if '?' in endpoint else '?') + 'per_page=100&page=' + str(page))
        if isinstance(values, dict):
            values = values.get('jobs', values.get('artifacts'))
        check(isinstance(values, list) and page <= 100, 'Invalid paginated API collection')
        result.extend(values)
        if len(values) < 100:
            return result
        page += 1


def check_entry_preference_lifecycle(report):
    expected_completed = [0,1,6,9,10,14,19,20,22,25,28,29,40]
    expected_hints = {'1':2,'14':1,'22':2,'29':1,'40':3}
    revisions = {'16':'cable-supported-architecture-v1','22':'counterweight-dynamic-v1','32':'siphon-observatory-v1',
                 **{str(index):'spatial-progression'+str(index+1)+'-v1' for index in range(42,51)}}
    phases = ['historical-read-through','own-persisted','own-persisted','own-persisted']
    check(len(report['checks']) == 4, 'Bare entry lifecycle observation count differs')
    for index, (value, phase) in enumerate(zip(report['checks'], phases)):
        check(all(key in value for key in ['phase','ownRaw','ownPreferences','writes','dom'])
          and value['phase'] == phase and 'runtimePreferences' not in value,
          'Bare entry phase is missing or synthesizes unobserved runtime preferences')
        settings = {'quality':'low','volume':.29 if index==0 else .37,'muted':True,'tutorial':index==0}
        check(value['dom'] == {'selectedLevel':3,'completedIndices':expected_completed,'completedCount':13,
                           'totalRooms':51,'completedText':'13 из 51 пройдено','settings':settings},
          'Actual entry DOM progress or initialized settings differ')
        writes = value['writes']; check(isinstance(writes,list), 'Observed entry storage write list required')
        if index == 0:
            check(value['ownRaw'] is None and value['ownPreferences'] is None and writes == [],
              'Valid historical startup is read-through, without a fabricated private record or write')
            continue
        check(isinstance(value['ownRaw'],str) and 0 < len(value['ownRaw'].encode()) <= 1_000_000,
          'Actual persisted private JSON is required after ordinary settings')
        parsed = json.loads(value['ownRaw'])
        check(isinstance(parsed,dict) and value['ownPreferences'] == parsed,
          'Persisted preferences differ from their actual raw JSON')
        expected = dict(completed=expected_completed,hints=expected_hints,resumeLevel=3,**settings)
        check(all(parsed.get(key) == wanted for key,wanted in expected.items())
          and parsed.get('campaignRevision') == 'creative-campaign-v48' and parsed.get('roomRevisions') == revisions,
          'Persisted private progress, hints, settings or valid accepted revisions differ')
        check((bool(writes) or index==3) and all(isinstance(write,dict) and write.get('method') == 'setItem'
          and write.get('key') == 'brainrot-campaign-v62:brainrot-portal.preferences.v24' for write in writes),
          'Ordinary action did not persist, or wrote outside the exact private preference key')


def check_legacy_route_scope(row):
    check(row.get('normalUiZeroStepStartProven') is False
      and row.get('resetCounterScope') == LEGACY_ROUTE_RESET_COUNTER_SCOPE,
      'Legacy route scope is omitted, changed or falsely claims a normal-UI zero-step start')


def source_save_lifecycle_checks(receipt):
    expected = {'phases':['historical-read-through','own-persisted','own-persisted','own-persisted'],
                'initialPrivateRecord':False,'initialWrites':0,'settingsPersisted':True,'playPersisted':True,
                'reloadPersisted':True,'completed':13,'hints':5,'sourceRuntimeAndUi':True}
    value = receipt['checks'].get('savePreferenceLifecycleV62')
    check(receipt['checks'].get('saveIsolationV62') is True and value == expected
      and receipt['checks'].get('currentImmutablePureValidators',{}).get('preferenceLifecyclePureValidator') is True
      and type(value['initialWrites']) is int and type(value['completed']) is int and type(value['hints']) is int
      and value['initialPrivateRecord'] is False and all(value[key] is True for key in ['settingsPersisted','playPersisted','reloadPersisted','sourceRuntimeAndUi']),
      'Source has not independently proved actual lazy preference read-through and later private persistence')


def source_route_checks(receipt):
    for kind in ('ordinaryRoutes', 'nativeRoutes'):
        row = receipt['checks'][kind]
        check(all(row[key] == 51 for key in ('rooms', 'won', 'sameOriginalCompanion'))
          and row['resets'] == row['respawns'] == 0,
          'Incomplete original-companion source routes')
        check_legacy_route_scope(row)
    row = receipt['checks']['nativeRoutes']
    check(row['gameplayPassed'] == row['capturesPassed'] == 51, 'Source native captures incomplete')


def source_camera17_checks(receipt):
    """Require all three newly decoded original-input camera17 full routes."""
    camera = receipt['checks']['camera17ContinuousNative']
    check(type(camera['room']) is int and camera['room'] == 17
      and camera['viewports'] == ['landscape', 'portrait', 'classic']
      and camera['fullyDecoded'] is True and type(camera['fps']) is int and camera['fps'] == 12,
      'Source camera17 three-viewport cohort is incomplete')
    rows = camera['rows']
    expected = [('landscape', 640, 360), ('portrait', 390, 844), ('classic', 800, 600)]
    check(isinstance(rows, list) and len(rows) == 3, 'Source camera17 row count differs')
    for row, (viewport, width, height) in zip(rows, expected):
        check(type(row['level']) is int and row['level'] == 17 and row['viewport'] == viewport
          and type(row['width']) is int and type(row['height']) is int
          and (row['width'], row['height']) == (width, height),
          'Source camera17 viewport, dimensions or original room differ')
        check(type(row['frames']) is int and row['frames'] > 1 and row['fullyDecoded'] is True
          and row['sameOriginalShape'] is True and row['completeRoute'] is True,
          'Source camera17 complete original-cargo route is unproved')
        check(type(row['movieBytes']) is int and 0 < row['movieBytes'] <= 40_000_000
          and isinstance(row['movieSha256'], str) and re.fullmatch('[a-f0-9]{64}', row['movieSha256'])
          and isinstance(row['telemetrySha256'], str) and re.fullmatch('[a-f0-9]{64}', row['telemetrySha256']),
          'Source camera17 media bytes or immutable hashes differ')
        check(type(row['durationSeconds']) in (int, float) and type(row['simulationSeconds']) in (int, float)
          and row['durationSeconds'] == row['frames'] / 12 and row['simulationSeconds'] > 0
          and abs(row['durationSeconds'] - row['simulationSeconds']) <= 1 / 6,
          'Source camera17 movie cadence differs from actual simulation')
    check(receipt['checks']['currentImmutablePureValidators']['camera17NativePureValidator'] is True,
      'Source camera17 frozen native validator is missing')


def source_chapter_checks(receipt):
    """Require Root's current ten complete films and both immutable attack groups."""
    source_camera17_checks(receipt)
    movies = receipt['checks']['biosphereContinuousNative']
    check(movies['rooms'] == 10 and movies['fullyDecoded'] is True and movies['fps'] == 12,
          'Source biosphere recordings are incomplete')
    rows = movies['rows']
    check(isinstance(rows, list) and all(type(r['level']) is int for r in rows) and [r['level'] for r in rows] == list(range(21, 31)),
          'Source biosphere movie cohort differs')
    for row in rows:
        check(type(row['frames']) is int and row['frames'] > 1 and row['fullyDecoded'] is True
              and row['sameOriginalShape'] is True and row['completeRoute'] is True,
              'Source complete native route or original cargo is unproved')
        check(type(row['movieBytes']) is int and 0 < row['movieBytes'] <= 40_000_000,
              'Source biosphere movie exceeds its exact bound')
        hex_value(row['movieSha256'], 64); hex_value(row['telemetrySha256'], 64)
        check(type(row['durationSeconds']) in (int, float) and type(row['simulationSeconds']) in (int, float)
              and row['durationSeconds'] == row['frames'] / 12 and row['simulationSeconds'] > 0
              and abs(row['durationSeconds'] - row['simulationSeconds']) <= 1 / 6,
              'Source biosphere movie cadence differs from actual simulation')
    attacks = receipt['checks']['biosphereAttacks']
    check(attacks['groups'] == 2 and attacks['rooms'] == 10 and isinstance(attacks['groupResults'], list)
          and sorted(r['group'] for r in attacks['groupResults']) == ['early', 'later'],
          'Source biosphere attack cohort differs')
    for row in attacks['groupResults']:
        check(row['pass'] is True and row['immutablePureValidator'] is True
              and type(row['cases']) is int and row['cases'] > 0
              and row['originalCargo'] is True and row['closedInventory'] is True,
              'Source biosphere ordinary-input attacks are not independently proved')


def config():
    c = load(CONFIG)
    check(c['schemaVersion'] == 1 and c['frozen'] is True and c['publicationAccepted'] is False, 'Release not frozen for independent publication')
    check(c['repository'] == REPO and c['namespace'] == PREFIX and c['version'] == 'v62-biosphere', 'Wrong release identity')
    check(c['sourceBranch'] == SOURCE_BRANCH and c['sourceWorkflow'] == SOURCE_WORKFLOW, 'Wrong source producer')
    for key in ('sourceCommit', 'sourceTree', 'controllerParent'):
        hex_value(c[key], 40)
    check(positive_safe_integer(c['sourceRun']) and c['sourceAttempt'] == 1, 'Unpinned source run')
    check(len(c['expectedJobs']) == len(set(c['expectedJobs'])) == 35, 'Incomplete source job contract')
    check(len(c['sourceArtifacts']) == 37 and len({a['id'] for a in c['sourceArtifacts']}) == len(c['sourceArtifacts'])
          and len({a['name'] for a in c['sourceArtifacts']}) == len(c['sourceArtifacts']), 'Incomplete artifact contract')
    check(c['baselineCatalogSha256'] == CATALOG_SHA and c['baselineInventorySha256'] == BASELINE[2], 'Changed baseline pin')
    check(c['baselineDeployment'] == BASELINE_DEPLOYMENT, 'Changed accepted deployment pin')
    for a in c['sourceArtifacts']:
        check(set(a) == {'id', 'name', 'size_in_bytes', 'digest'} and positive_safe_integer(a['id'])
              and type(a['size_in_bytes']) is int and 0 < a['size_in_bytes'] <= MAX_PROOF, 'Invalid provider artifact pin')
        name(a['name']); check(a['digest'].startswith('sha256:'), 'Artifact has no provider digest'); hex_value(a['digest'][7:], 64)
    check(sum(a['size_in_bytes'] for a in c['sourceArtifacts']) <= MAX_PROOF, 'Oversized source evidence')
    receipt_path = pathlib.Path(name(c['sourceAcceptance']['path']))
    check(sha(receipt_path.read_bytes()) == hex_value(c['sourceAcceptance']['sha256'], 64), 'Independent source acceptance changed')
    receipt = load(receipt_path)
    check(receipt['sourceAccepted'] is True and receipt['publicationAccepted'] is False
          and receipt['sourceCommit'] == c['sourceCommit'] and receipt['sourceTree'] == c['sourceTree']
          and int(receipt['run']) == c['sourceRun'] and int(receipt['runAttempt']) == c['sourceAttempt'], 'Independent source acceptance identity mismatch')
    source_route_checks(receipt)
    source_save_lifecycle_checks(receipt)
    cpu = receipt['checks']['cpu']
    check(cpu['tests'] == cpu['passed'] > 0 and cpu['failed'] == 0, 'Source CPU acceptance failed')
    check(receipt['checks']['nativeRoutes']['gameplayPassed'] == receipt['checks']['nativeRoutes']['capturesPassed'] == 51, 'Source native captures incomplete')
    source_chapter_checks(receipt)
    pure = receipt['checks']['currentImmutablePureValidators']
    check(pure['pass'] is pure['biosphereNativePureValidator'] is pure['biosphereAttacksPureValidator'] is True and pure['camera17NativePureValidator'] is True and pure['castleImpulseNativePureValidator'] is True and len(pure['impulsePhysicalProofs']) == 2
          and {p['kind'] for p in pure['impulsePhysicalProofs']} == {'ordinary', 'native'}
          and all(p['pass'] is True for p in pure['impulsePhysicalProofs']), 'Source physical impulse completion is not independently proved')
    check(c['distArtifact'] == 'biosphere-dist', 'Wrong source package artifact')
    return c


def baseline(c):
    check(c['baselineCatalog'] == 'tools/campaign-v61-public-files.json', 'Wrong baseline catalog')
    check(sha(pathlib.Path(c['baselineCatalog']).read_bytes()) == CATALOG_SHA, 'Baseline catalog raw bytes changed')
    d = load(c['baselineCatalog']); rows = d['siteFiles']; rows_valid(rows)
    check(d['publicationAccepted'] is True and (len(rows), sum(r['bytes'] for r in rows), sha(encoded(rows))) == BASELINE, 'Baseline catalog was not accepted')
    check(not any(r['path'].startswith(PREFIX) for r in rows), 'Namespace already in baseline')
    return rows


def source_provider(c):
    run = api('actions/runs/' + str(c['sourceRun']))
    check(run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_sha'] == c['sourceCommit']
          and run['head_branch'] == SOURCE_BRANCH and run['path'].split('@')[0] == SOURCE_WORKFLOW
          and run['run_attempt'] == c['sourceAttempt'] and run['id'] != int(os.environ['GITHUB_RUN_ID']), 'Source run identity or terminal status differs')
    jobs = pages('actions/runs/' + str(run['id']) + '/attempts/' + str(c['sourceAttempt']) + '/jobs')
    check(sorted(j['name'] for j in jobs) == sorted(c['expectedJobs']) and all(j['status'] == 'completed' and j['conclusion'] == 'success' for j in jobs), 'Actual source jobs differ or failed')
    artifacts = pages('actions/runs/' + str(run['id']) + '/artifacts')
    actual = [{k: a[k] for k in ('id', 'name', 'size_in_bytes', 'digest')} for a in artifacts]
    check(sorted(actual, key=lambda a: a['id']) == sorted(c['sourceArtifacts'], key=lambda a: a['id'])
          and all(not a['expired'] and a['workflow_run']['head_sha'] == c['sourceCommit'] and a['workflow_run']['id'] == run['id'] for a in artifacts), 'Actual source artifact metadata/provenance changed')
    return {'run': run, 'jobs': jobs, 'artifacts': artifacts}


def lease(c, *, deployed=False, allow_pending=False, retain_provider=None):
    publisher = os.environ['GITHUB_SHA']; hex_value(publisher, 40)
    check(os.environ['GITHUB_REPOSITORY'] == REPO and os.environ['GITHUB_REF'] == 'refs/heads/main', 'Unexpected publisher origin')
    check(api('git/ref/heads/main')['object']['sha'] == publisher, 'Publisher main lease moved')
    check([p['sha'] for p in api('git/commits/' + publisher)['parents']] == [c['controllerParent']], 'Publisher is not the single accepted-parent successor')
    check(api('git/ref/heads/' + SOURCE_BRANCH)['object']['sha'] == c['sourceCommit']
          and api('git/commits/' + c['sourceCommit'])['tree']['sha'] == c['sourceTree'], 'Frozen source lease moved')
    capture_start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    retained = pathlib.Path(retain_provider) if retain_provider is not None else None
    if retained:
        check(deployed and not retained.exists(), 'Use a fresh final deployment provider directory')
        retained.mkdir(parents=True)
        deployments, deployment_resource = retain_api_pages('deployments?environment=github-pages', 'deployments', retained)
    else:
        deployments = pages('deployments?environment=github-pages')
    check(deployments, 'No Pages deployment')
    deployments.sort(key=lambda d: d['id'], reverse=True)
    latest = deployments[0]
    if retained:
        states, status_resource = retain_api_pages('deployments/' + str(latest['id']) + '/statuses', 'statuses', retained)
    else:
        states = pages('deployments/' + str(latest['id']) + '/statuses')
    check(states, 'Pages deployment has no current status')
    run_url = 'https://github.com/' + REPO + '/actions/runs/' + os.environ['GITHUB_RUN_ID']
    def own(d, statuses):
        return d['sha'] == publisher and any(s.get(k, '').rstrip('/') == run_url or s.get(k, '').startswith(run_url + '/')
                    for s in statuses[:1] for k in ('log_url', 'target_url'))
    if deployed:
        check(own(latest, states) and states[0]['state'] == 'success'
              and latest['id'] > c['baselineDeployment']['id'], 'New successful Pages deployment does not belong to this publisher run')
    else:
        # An environment job creates its own pending deployment before its first
        # step. Admit that exact current-run record only, then inspect baseline.
        if allow_pending and own(latest, states):
            check(states[0]['state'] in ('queued', 'pending', 'in_progress') and len(deployments) > 1, 'Current run already deployed or has no baseline')
            latest = deployments[1]; states = pages('deployments/' + str(latest['id']) + '/statuses')
        check(latest['id'] == c['baselineDeployment']['id'] and latest['sha'] == c['baselineDeployment']['sha']
              and states and states[0]['state'] == 'success', 'Accepted deployment lease changed')
    if retained:
        write(retained / 'manifest.json', {'schemaVersion': 1, 'kind': 'actual-v62-ci-deployment-api-snapshot',
              'publicationAccepted': False, 'producer': producer(), 'sourceCommit': c['sourceCommit'],
              'sourceTree': c['sourceTree'], 'sourceReview': {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']},
              'captureStartedAt': capture_start, 'captureCompletedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'deploymentId': latest['id'], 'resources': {'deployments': deployment_resource, 'statuses': status_resource},
              'scope': 'Original complete paginated GitHub API response bytes observed in the final CI job; no independent post-CI deployment GET is claimed.'})
        check(sum(p.stat().st_size for p in retained.iterdir()) <= 25_000_000, 'Oversized deployment provider snapshot')
    return {'deployment': latest, 'statuses': states}


def retain_api_pages(endpoint, stem, root):
    """Retain every original HTTP body; never manufacture an aggregated API body."""
    values, records = [], []
    for page in range(1, 101):
        url = 'https://api.github.com/repos/' + REPO + '/' + endpoint + ('&' if '?' in endpoint else '?') + 'per_page=100&page=' + str(page)
        started = datetime.datetime.now(datetime.timezone.utc).isoformat(); observed = {}
        raw = get(url, token=True, response_meta=observed)
        completed = datetime.datetime.now(datetime.timezone.utc).isoformat()
        check(observed == {'url': url, 'status': 200}, 'Deployment API redirected or failed')
        parsed = json.loads(raw)
        check(isinstance(parsed, list) and len(parsed) <= 100, 'Invalid deployment API page')
        relative = stem + '-page-' + str(page).zfill(3) + '.json'
        (root / relative).write_bytes(raw)
        records.append({'path': relative, 'page': page, 'requestURL': url, 'responseURL': observed['url'], 'status': 200,
                        'requestedAt': started, 'completedAt': completed, 'bytes': len(raw), 'sha256': sha(raw), 'items': len(parsed)})
        check(sum(r['bytes'] for r in records) <= 24_000_000, 'Oversized deployment API collection')
        values.extend(parsed)
        if len(parsed) < 100:
            return values, {'endpoint': endpoint, 'items': len(values), 'pages': records}
    raise ValueError('Deployment API pagination did not close')


def safe_extract(archive, output, maximum=MAX_PROOF):
    output = pathlib.Path(output); check(not output.exists(), 'Refuse extraction overwrite')
    with zipfile.ZipFile(archive) as z:
        members, seen, total = [], set(), 0
        for m in z.infolist():
            n = name(m.filename.rstrip('/')); kind = stat.S_IFMT(m.external_attr >> 16)
            check(m.orig_filename == m.filename and n not in seen and kind in (0, stat.S_IFDIR if m.is_dir() else stat.S_IFREG)
                  and not m.flag_bits & 1 and m.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'Unsafe ZIP member')
            seen.add(n); total += m.file_size
            check(len(seen) <= 20000 and total <= maximum and (not m.is_dir() or m.file_size == m.CRC == 0), 'Oversized or noncanonical ZIP')
            members.append((m, n))
        files = {n for m, n in members if not m.is_dir()}
        check(files and not any('/'.join(n.split('/')[:i]) in files for n in seen for i in range(1, len(n.split('/')))), 'ZIP file/directory collision')
        output.mkdir(parents=True)
        for m, n in members:
            p = output / n
            if m.is_dir(): p.mkdir(parents=True, exist_ok=True)
            else:
                p.parent.mkdir(parents=True, exist_ok=True)
                with z.open(m) as src, p.open('xb') as dst: shutil.copyfileobj(src, dst)
    return inventory(output)


def verify_http(rows, destination=None):
    rows_valid(rows)
    def one(r):
        return get(BASE + urllib.parse.quote(r['path'], safe='/'), expected=r,
                   destination=pathlib.Path(destination) / r['path'] if destination else None, limit=MAX_SITE)
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for _ in pool.map(one, rows): pass
    return {'files': len(rows), 'bytes': sum(r['bytes'] for r in rows), 'inventorySha256': sha(encoded(rows)), 'method': 'complete HTTP GET, exact length and SHA-256 for every file'}


def validate_candidate(c, folder):
    actual = inventory(folder); rows_valid(actual, MAX_PACKAGE); info = load(pathlib.Path(folder) / 'build-info.json')
    check(info['commit'] == info['gameCommit'] == info['interfaceCommit'] == c['sourceCommit']
          and info['version'] == c['version'] and int(info['run']) == c['sourceRun'] and info['levels'] == 51
          and info['edition'] == 'foundation' and info['verified'] is False, 'Candidate build identity differs')
    files = [r for r in actual if r['path'] != 'build-info.json']
    check(files == info['files'] and sha(encoded(files)) == info['packageFilesSha256'], 'Candidate manifest differs from actual provider package')
    inputs = info['sourceInputs']
    check(len(inputs) == info['sourceInputFiles'] and sha(encoded(inputs)) == info['sourceInputsSha256'], 'Source input manifest differs')
    check(len({i['filename'] for i in inputs}) == len(inputs), 'Duplicate source input')
    for row in inputs:
        check(sha((pathlib.Path('source') / name(row['filename'])).read_bytes()) == row['sha256'], 'Frozen source input changed: ' + row['filename'])
    sequence = list(range(1, 41)) + list(range(42, 52)) + [41]
    check([r['stableLevel'] for r in info['rooms']] == sequence
          and [r['level'] for r in info['rooms']] == list(range(1, 52))
          and info['sequenceRevision'] == 'fifty-rooms-then-castle-v1', 'Candidate castle is not the final campaign room')
    tower = info['features']['tower']
    check(tower['level'] == 51 and tower['stableLevel'] == 41 and tower['stages'] == 12 and tower['checkpoints'] is False
          and info['features']['foundation']['castleEndsCampaign'] is True, 'Candidate castle revision/finale differs')
    receipt = load(c['sourceAcceptance']['path'])
    check(actual == receipt['candidateFiles'] and sum(r['bytes'] for r in actual) == receipt['candidateBytes']
          and sha(encoded(actual)) == receipt['candidateInventorySha256'], 'Candidate differs from independent source acceptance')
    return actual


def unchanged_state(c):
    state = load('proof/preparation.json')
    check(state['configSha256'] == sha(pathlib.Path(CONFIG).read_bytes()) and state['producer'] == producer(), 'Preparation belongs to another config or publisher')
    return state


def producer():
    return {k: os.environ[k] for k in ('GITHUB_REPOSITORY', 'GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT')}


def check_network(network,stamps,rows,stamp,pages,entry=False):
    expected={URL+r['path']:r for r in rows};expected[URL]=expected[URL+'index.html'];check(network and stamps,'Missing browser response observations')
    for row in network:
        check(type(row['page']) is int and 1<=row['page']<=pages and row['url'] in expected and row['status']==200 and row['fromCache'] is False,'Wrong browser response origin/status/cache')
        check(row['bytes']==expected[row['url']]['bytes'] and row['sha256']==expected[row['url']]['sha256'],'Browser response differs from exact SOURCE package')
    for row in stamps:check(type(row['page']) is int and 1<=row['page']<=pages and row['url']==URL+'build-info.json' and row['status']==200 and row['sha256']==stamp,'Stale browser build stamp')
    if not entry:
        check(len(stamps)==pages and [r['page'] for r in stamps]==list(range(1,pages+1)),'Pages were reused or metadata reads omitted')
        check(all(any(r['page']==n and (r['url'].endswith('/index.html') or r['url'].endswith('.js')) for r in network) for n in range(1,pages+1)),'No original HTML/JS response for a fresh route page')
def check_attacks(root, source, c, producer, candidate, stamp, source_receipt, group, decode=None):
    """Authenticate a closed current ordinary-input browser attack packet."""
    root, source = pathlib.Path(root), pathlib.Path(source)
    report = load(root / 'biosphere-attacks-browser-report.json')
    binding = load(root / 'public-binding.json')
    def record(relative):
        p = root / name(relative)
        check(p.is_file() and not p.is_symlink(), 'Missing closed attack member')
        return {'path': relative, 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
    check(group in ATTACK_GROUPS and report['schemaVersion'] == 1
            and report['kind'] == 'actual-biosphere-ordinary-attacks-browser-diagnostic'
            and report['group'] == group and report['pass'] is True,
            'Wrong or failed current browser attack group')
    check(all(report[k] is False for k in ('sourceCiAccepted', 'nativeAccepted', 'publicationAccepted',
            'fullChapterAccepted', 'humanAccepted', 'allBypassesAccepted', 'humanPlaytest',
            'hardwareFPSMeasured', 'cameraAccepted', 'allRenderFramesMeasured'))
            and report['errors'] == [], 'Attack diagnostic widened its acceptance scope')
    s, origin, package = report['source'], report['controller'], report['package']
    check(s['commit'] == c['sourceCommit'] and s['tree'] == c['sourceTree']
            and s['sourceInputsSha256'] == source_receipt['sourceInputsSha256']
            and all(report[k] is True for k in ('sourceWorkingBytesUnchanged',
            'controllerWorkingBytesUnchanged', 'harnessWorkingBytesUnchanged', 'completeServedPackageVerified')),
            'Attack current frozen Source bytes differ')
    actual_run = {'runId': int(producer['GITHUB_RUN_ID']), 'runAttempt': int(producer['GITHUB_RUN_ATTEMPT'])}
    check(report['sourceReview'] == {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']}
            and report['captureRun'] == actual_run and report['providerRun'] == dict(actual_run, commit=producer['GITHUB_SHA'])
            and report['captureOrigin'] == 'https://amazin20.github.io'
            and report['capturePath'] == '/brainrot-portal/campaign-v62/', 'Attack Source review or actual Public capture origin differs')
    check(origin['commit'] == c['sourceCommit'] and origin['tree'] == c['sourceTree']
            and origin['trackedWorkingTreeClean'] is True and origin['runId'] == actual_run['runId']
            and origin['runAttempt'] == actual_run['runAttempt'], 'Attack immutable Source controller differs')
    harness = origin['files']; paths = [r['path'] for r in harness]
    check(paths == sorted(set(paths)) and sha(encoded(harness)) == origin['filesSha256'],
            'Attack controller harness inventory differs')
    frozen = load(root / 'binding.json')
    check(frozen['source'] == s and frozen['controller'] == origin and frozen['package'] == package,
            'Attack initial frozen Source binding differs')
    source_harness = frozen['sourceHarness']
    check(sha(encoded(source_harness['files'])) == source_harness['filesSha256'], 'Attack Source harness digest differs')
    for row in harness + source_harness['files']:
        p = source / name(row['path'])
        check(p.is_file() and not p.is_symlink() and p.stat().st_size == row['bytes']
                and sha(p.read_bytes()) == row['sha256'], 'Attack frozen harness differs from current Source')
    payload = [r for r in candidate if r['path'] not in ('build-info.json', 'release-manifest.json')]
    stamp_row = next(r for r in candidate if r['path'] == 'build-info.json')
    check(package['commit'] == c['sourceCommit'] and package['buildInfoSha256'] == stamp == stamp_row['sha256']
            and package['buildInfoBytes'] == stamp_row['bytes'] and package['files'] == payload
            and package['packageFilesSha256'] == sha(encoded(payload))
            and package['fileCount'] == len(payload) and package['totalBytes'] == sum(r['bytes'] for r in payload),
            'Attack served package is not the accepted exact dist')
    journeys = [r for r in payload if re.fullmatch(r'assets/LabV8Journey-[A-Za-z0-9_-]+\.js', r['path'])]
    check(len(journeys) == 1 and package['journey'] == journeys[0] and package['originalRuntimeModels'] == 14, 'Attack compiled ordinary journey or original runtime models differ')
    served = load(root / 'served-package.json')
    check(served['sourceCommit'] == c['sourceCommit'] and served['sourceTree'] == c['sourceTree']
            and served['captureOrigin'] == report['captureOrigin'] and served['capturePath'] == report['capturePath']
            and served['allHTTPFilesVerified'] is True
            and served['files'] == [dict(r, status=200) for r in payload] + [dict(stamp_row, status=200)],
            'Attack complete actual HTTP package proof differs')
    pure_name = group + '-attacks-report.json'
    cases = report['caseObservations']; count = len(cases)
    check(count > 0 and report['pureReport'] == {'filename': pure_name, 'cases': count, 'pass': True},
            'Attack ordinary-input case cohort incomplete')
    check(binding['kind'] == 'actual-v62-public-attacks-binding' and binding['pass'] is True
            and binding['publicationAccepted'] is False and binding['group'] == group
            and binding['sourceCommit'] == c['sourceCommit'] and binding['sourceTree'] == c['sourceTree']
            and binding['producer'] == producer and binding['publicURL'] == URL
            and binding['buildInfoSha256'] == stamp and binding['freshPages'] == count,
            'Attack fresh actual Public producer differs')
    driver_name = 'scripts/qa-biosphere-attacks-browser.mjs'
    check(binding['driver'] == {'path': driver_name, 'sha256': sha((source / driver_name).read_bytes())},
            'Attack driver bytes differ from immutable Source')
    for key, relative in [('sourceReport', 'biosphere-attacks-browser-report.json'),
            ('pureReport', pure_name), ('closedMediaInventory', 'closed-media-member-inventory.json')]:
        check(binding[key] == record(relative), 'Attack retained proof raw bytes differ')
    wanted = {'binding.json', 'served-package.json', 'native-browser.json', 'attack-harness.js', 'attack-harness-inputs.json', pure_name, 'biosphere-attacks-browser-report.json', 'closed-media-member-inventory.json', 'public-binding.json'}
    for i in range(1, count + 1):
        wanted.update({'case-' + str(i).zfill(2) + suffix for suffix in ('-observation.json', '-start.jpg', '-end.jpg')})
    check({r['path'] for r in inventory(root)} == wanted, 'Unexpected or missing closed attack artifact member')
    check(load(root / 'native-browser.json') == report['browser'] and re.fullmatch(r'(?:HeadlessChrome|Chrome)/\d+(?:\.\d+){3}', report['browser']['product']) and re.search(r'\b(?:HeadlessChrome|Chrome)/\d+', report['browser']['userAgent']), 'Attack actual browser witness differs')
    closed = load(root / 'closed-media-member-inventory.json')
    closed_rows = [dict(name=r['path'], bytes=r['bytes'], sha256=r['sha256'])
            for r in inventory(root) if r['path'] not in ('closed-media-member-inventory.json', 'public-binding.json')]
    check(closed['files'] == closed_rows, 'Attack closed artifact membership or bytes differ')
    descriptor = load(root / 'attack-harness-inputs.json')
    check(descriptor == report['harness'] and record('attack-harness.js')['bytes'] == descriptor['bytes']
            and record('attack-harness.js')['sha256'] == descriptor['sha256'], 'Attack compiled observer bundle differs')
    check_network(binding['network'], binding['browserStampReads'], candidate, stamp, count)
    image_names = sorted(r['filename'] for r in report['closedMedia'])
    check(len(image_names) == len(set(image_names)) == count * 2
            and image_names == sorted(p.relative_to(root).as_posix() for p in root.rglob('*.jpg')),
            'Attack genuine start/end canvas cohort differs')
    check([r['path'] for r in binding['decodedImages']] == image_names, 'Attack decoded canvas membership differs')
    images = []
    for relative in image_names:
        observed = next(r for r in binding['decodedImages'] if r['path'] == relative)
        actual = decode(root / relative) if decode else observed
        actual['path'] = relative
        check({k: actual[k] for k in ('path', 'bytes', 'sha256')} == record(relative)
                and actual['pixels'] == {'width': 640, 'height': 360}, 'Attack genuine decoded canvas bytes differ')
        images.append(actual)
    check(binding['decodedImages'] == images, 'Attack actual pixels differ from observed binding')
    for i, case in enumerate(cases):
        check(load(root / ('case-' + str(i + 1).zfill(2) + '-observation.json')) == case,
                'Attack individual case proof differs from complete report')
    return {'group': group, 'report': record('biosphere-attacks-browser-report.json'),
            'binding': record('public-binding.json'), 'cases': count, 'retainedImages': len(images)}, images


def prepare(c):
    check(not pathlib.Path('pages').exists() and not pathlib.Path('source-artifacts').exists(), 'Preparation output already exists')
    old = baseline(c); provider = source_provider(c); before = lease(c)
    for target in (PREFIX, PREFIX + 'index.html', PREFIX + 'build-info.json', PREFIX + 'publication-provenance.json'):
        get(BASE + target, absent=True)
    artifact_rows = []
    for a in c['sourceArtifacts']:
        archive = pathlib.Path('source-artifacts') / (str(a['id']) + '.zip')
        get('https://api.github.com/repos/' + REPO + '/actions/artifacts/' + str(a['id']) + '/zip', token=True,
            expected={'bytes': a['size_in_bytes'], 'sha256': a['digest'][7:]}, destination=archive)
        folder = pathlib.Path('source-artifacts') / a['name']
        members = safe_extract(archive, folder, MAX_PACKAGE if a['name'] == c['distArtifact'] else MAX_PROOF)
        artifact_rows.append({'provider': a, 'files': members, 'inventorySha256': sha(encoded(members))})
    candidate = pathlib.Path('source-artifacts') / c['distArtifact']; candidate_rows = validate_candidate(c, candidate)
    original_stamp = sha((candidate / 'build-info.json').read_bytes())
    baseline_result = verify_http(old, 'pages')
    check(not (pathlib.Path('pages') / PREFIX).exists(), 'Refuse existing namespace')
    shutil.copytree(candidate, pathlib.Path('pages') / PREFIX)
    provenance = {'publicationAccepted': False, 'sourceCommit': c['sourceCommit'], 'sourceTree': c['sourceTree'], 'sourceRun': c['sourceRun'],
                  'sourceAttempt': c['sourceAttempt'], 'sourceAcceptance': c['sourceAcceptance'], 'sourceArtifacts': c['sourceArtifacts'],
                  'producer': producer(), 'originalBuildInfoSha256': original_stamp, 'originalDistInventorySha256': sha(encoded(candidate_rows))}
    write(pathlib.Path('pages') / PREFIX / 'publication-provenance.json', provenance)
    union = inventory('pages'); check(len(union) == len(old) + len(candidate_rows) + 1, 'Append changed existing site membership')
    check([r for r in union if not r['path'].startswith(PREFIX)] == old, 'Existing bytes changed during append')
    state = {'publicationAccepted': False, 'producer': producer(), 'configSha256': sha(pathlib.Path(CONFIG).read_bytes()),
             'baseline': baseline_result, 'candidateFiles': candidate_rows, 'unionFiles': union, 'originalBuildInfoSha256': original_stamp,
             'sourceProvider': provider, 'sourceArtifacts': artifact_rows, 'deploymentBefore': before}
    write('proof/preparation.json', state)
    with open(os.environ.get('GITHUB_OUTPUT', os.devnull), 'a') as out:
        out.write('source_commit=' + c['sourceCommit'] + '\n')


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('command', choices=['pins', 'prepare', 'before', 'public', 'final']); args = parser.parse_args()
    c = config()
    if args.command == 'pins':
        with open(os.environ.get('GITHUB_OUTPUT', os.devnull), 'a') as out:
            out.write('source_commit=' + c['sourceCommit'] + '\n')
            out.write('source_run=' + str(c['sourceRun']) + '\n')
        return
    if args.command == 'prepare': return prepare(c)
    state = unchanged_state(c); source = source_provider(c)
    deployment = lease(c, deployed=args.command != 'before', allow_pending=args.command == 'before')
    if args.command == 'before':
        old = baseline(c)
        canaries = [r for r in old if r['path'] in ('index.html', 'build-info.json', 'campaign-v61/build-info.json')]
        check(len(canaries) == 3, 'Baseline identity canaries missing')
        result = verify_http(canaries)
        for target in (PREFIX, PREFIX + 'index.html', PREFIX + 'build-info.json'):
            get(BASE + target, absent=True)
        own_artifacts = pages('actions/runs/' + os.environ['GITHUB_RUN_ID'] + '/artifacts')
        package = [a for a in own_artifacts if a['name'] == 'github-pages']
        check(len(package) == 1 and not package[0]['expired'] and package[0]['digest'].startswith('sha256:'), 'Actual Pages artifact is missing')
        write('proof/before-deploy.json', {'publicationAccepted': False, 'baseline': result, 'deployment': deployment, 'pagesArtifact': package[0]})
    elif args.command == 'public':
        result = verify_http(state['unionFiles'])
        check(sha(get(BASE + PREFIX + 'build-info.json')) == state['originalBuildInfoSha256'], 'Public build stamp was rewritten')
        write('proof/public-http.json', {'pass': True, 'publicationAccepted': False, 'union': result, 'deployment': deployment, 'producer': producer()})
    else:
        jobs = pages('actions/runs/' + os.environ['GITHUB_RUN_ID'] + '/attempts/' + os.environ['GITHUB_RUN_ATTEMPT'] + '/jobs')
        expected = ['prepare', 'deploy', 'public-http', 'entry'] + ['native (' + g + ')' for g in GROUPS] + ['attacks (' + group + ')' for group in ATTACK_GROUPS]
        prior = [j for j in jobs if j['name'] != 'verify']
        check(sorted(j['name'] for j in prior) == sorted(expected) and all(j['status'] == 'completed' and j['conclusion'] == 'success' for j in prior), 'An actual PUBLIC producer is missing or failed')
        entry = load('proof/entry/report.json')
        check_entry_preference_lifecycle(entry)
        check(load('proof/public-http.json')['pass'] is True and entry['pass'] is True and entry['sourceCommit'] == c['sourceCommit']
              and entry['producer'] == producer() and entry['publicURL'] == BASE + PREFIX
              and entry['buildInfoSha256'] == state['originalBuildInfoSha256'] and len(entry['captures']) == 3
              and not entry['errors'], 'Actual HTTP or bare entry proof failed')
        observed = []
        for group, levels in GROUPS.items():
            report = load('proof/native-' + group + '/report.json'); binding = load('proof/native-' + group + '/public-binding.json')
            check_legacy_route_scope(binding)
            check(report['sourceCommit'] == c['sourceCommit'] and report['package']['commit'] == c['sourceCommit']
                  and [r['level'] for r in report['rows']] == levels and not report['errors'] and binding['pass'] is True
                  and binding['publicURL'] == BASE + PREFIX and binding['buildInfoSha256'] == state['originalBuildInfoSha256'], 'Native PUBLIC package/group binding differs')
            check(binding['producer'] == producer() and binding['freshPages'] == len(levels)
                  and len(binding['browserStampReads']) == len(levels) and len(binding['decodedImages']) == len(levels), 'Fresh native browser/page proof incomplete')
            for read in binding['browserStampReads']:
                check(read['status'] == 200 and read['url'] == BASE + PREFIX + 'build-info.json'
                      and read['sha256'] == state['originalBuildInfoSha256'], 'Actual browser fetched a different build')
            expected_network = {BASE + PREFIX + r['path']: r for r in state['candidateFiles']}
            expected_network[BASE + PREFIX] = expected_network[BASE + PREFIX + 'index.html']
            check(binding['network'], 'No actual browser response bytes')
            for response in binding['network']:
                check(response['url'] in expected_network and response['status'] == 200
                      and response['bytes'] == expected_network[response['url']]['bytes']
                      and response['sha256'] == expected_network[response['url']]['sha256'], 'Browser response differs from original dist')
            for row in report['rows']:
                route = row['route']; check(row['pass'] is True and row['gameplayPassed'] is True and row['capturePass'] is True
                    and route['pass'] is True and route['state'] == 'won' and route['sameCompanion'] is True and route['sameCargoShape'] is True
                    and route.get('resets', 0) == route.get('respawns', 0) == 0, 'PUBLIC original-companion route failed')
                observed.append(row['level'])
            expected_impulses = []
            for row in report['rows']:
                if row['level'] == 41:
                    marks = row['route']['milestones']; ids = ['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','impulse','crown']
                    check([m['name'][6:] for m in marks if m['name'].startswith('Start ')] == ids
                          and [m['name'][7:] for m in marks if m['name'].startswith('Solved ')] == ids, 'PUBLIC castle route omits or repeats a mechanism')
                    impulse = next(m['physicsProof'] for m in marks if m['name'] == 'Solved impulse')
                    check(all(impulse.get(k) is True for k in ('physicalOriginalCargoImpulse','passiveBistableCarriage','originalCargo')), 'PUBLIC castle impulse proof is missing')
                    d = impulse['impulseCell']; check(d['originalCargoBodyId'] == row['start']['cargoBodyId'], 'PUBLIC impulse uses another original cargo')
                    expected_impulses.append({'level':41,'pass':True,'originalCargoBodyId':d['originalCargoBodyId'],
                                             'originalCargoShapeId':d['originalCargoShapeId'],'worldStep':d['worldStep']})
            check(binding['impulsePhysicalProofs'] == expected_impulses, 'PUBLIC independently observed impulse binding differs')
        check(sorted(observed) == list(range(1, 52)), 'PUBLIC room union incomplete')
        receipt = load(c['sourceAcceptance']['path'])
        attacks = [check_attacks(pathlib.Path('proof') / ('attacks-' + group), pathlib.Path('source'), c, producer(), state['candidateFiles'], state['originalBuildInfoSha256'], receipt, group)[0] for group in ATTACK_GROUPS]
        source_provider(c); deployment = lease(c, deployed=True, retain_provider='proof/deployment-provider')
        write('proof/final-publication.json', {'technicalChecksPassed': True, 'publicationAccepted': False, 'requiresIndependentRootAcceptance': True,
              'producer': producer(), 'sourceCommit': c['sourceCommit'], 'sourceTree': c['sourceTree'], 'sourceReview': c['sourceRun'],
              'sourceJobs': source['jobs'], 'publicJobs': prior, 'sourceArtifacts': c['sourceArtifacts'], 'deployment': deployment,
              'originalBuildInfoSha256': state['originalBuildInfoSha256'], 'originalDistInventorySha256': sha(encoded(state['candidateFiles'])),
              'unionInventorySha256': sha(encoded(state['unionFiles'])), 'publicRooms': sorted(observed),
              'attackGroups': list(ATTACK_GROUPS), 'attackProofs': attacks,
              'nativeRouteScope': {'normalUiZeroStepStartProven': False, 'resetCounterScope': LEGACY_ROUTE_RESET_COUNTER_SCOPE},
              'limitations': ['Automated ordinary inputs and software WebGL; no human/device/live-Yandex acceptance.', 'Legacy 51-route initialization performs an initial fixture reset outside reported journey counters; normal-UI zero-step starts are not established for that cohort.', 'Finite probes do not prove absence of all bypasses.', 'Final publisher job and complete provider artifacts require independent terminal review.']})


if __name__ == '__main__':
    main()

