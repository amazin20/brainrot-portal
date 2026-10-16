"""Append an independently accepted immutable v58 package; never rebuild a game.

Only the new release configuration triggers this publisher. The final receipt
deliberately leaves publicationAccepted false for independent root review.
"""
import argparse
import concurrent.futures
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
PREFIX = 'campaign-v58/'
CONFIG = 'tools/campaign-v58-release.json'
BASELINE = (2200, 654907147, 'a6e90e3d222eed87c3fa0c616426ec108ab3071ce703904a61686ad27887d5c5')
CATALOG_SHA = '42310ad6335cb784a07d27cac43d09ee689a73911c209b145eeb7e4a1b1c0f58'
BASELINE_DEPLOYMENT = {'id': 7099871789, 'sha': '88fb7f4376e7505a1af29b6da1c61258fde6aff7'}
SOURCE_BRANCH = 'upgrade/camera-readability-20261016'
SOURCE_WORKFLOW = '.github/workflows/camera-readability-review.yml'
GROUPS = {'early': list(range(1, 11)), 'energy': list(range(11, 21)),
          'living': list(range(21, 31)), 'optics': list(range(31, 41)),
          'fracture': list(range(42, 52)), 'castle': [41]}
CAUSAL_CASES = ('room25', 'castle')
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


def get(url, *, expected=None, destination=None, token=False, limit=25_000_000, absent=False):
    """Bounded idempotent GET retry; no authentication follows a signed redirect."""
    for attempt in range(5):
        tmp = None
        try:
            headers = {'Accept-Encoding': 'identity', 'User-Agent': 'brainrot-append-v58'}
            if token:
                check(url.startswith('https://api.github.com/repos/' + REPO + '/'), 'Token outside repository API')
                headers.update(Authorization='Bearer ' + os.environ['GITHUB_TOKEN'], Accept='application/vnd.github+json')
            with urllib.request.build_opener(Redirect()).open(urllib.request.Request(url, headers=headers), timeout=90) as response:
                check(response.status == 200 and not absent, 'Expected an absent v58 namespace' if absent else 'GET did not return 200')
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


def config():
    c = load(CONFIG)
    check(c['schemaVersion'] == 1 and c['frozen'] is True and c['publicationAccepted'] is False, 'Release not frozen for independent publication')
    check(c['repository'] == REPO and c['namespace'] == PREFIX and c['version'] == 'v58-mechanism-readability', 'Wrong release identity')
    check(c['sourceBranch'] == SOURCE_BRANCH and c['sourceWorkflow'] == SOURCE_WORKFLOW, 'Wrong source producer')
    for key in ('sourceCommit', 'sourceTree', 'controllerParent'):
        hex_value(c[key], 40)
    check(type(c['sourceRun']) is int and c['sourceRun'] > 0 and c['sourceAttempt'] == 1, 'Unpinned source run')
    check(len(c['expectedJobs']) == len(set(c['expectedJobs'])) == 24, 'Incomplete source job contract')
    check(len(c['sourceArtifacts']) == 26 and len({a['id'] for a in c['sourceArtifacts']}) == len(c['sourceArtifacts'])
          and len({a['name'] for a in c['sourceArtifacts']}) == len(c['sourceArtifacts']), 'Incomplete artifact contract')
    check(c['baselineCatalogSha256'] == CATALOG_SHA and c['baselineInventorySha256'] == BASELINE[2], 'Changed baseline pin')
    check(c['baselineDeployment'] == BASELINE_DEPLOYMENT, 'Changed accepted deployment pin')
    for a in c['sourceArtifacts']:
        check(set(a) == {'id', 'name', 'size_in_bytes', 'digest'} and type(a['id']) is int and a['id'] > 0
              and type(a['size_in_bytes']) is int and 0 < a['size_in_bytes'] <= MAX_PROOF, 'Invalid provider artifact pin')
        name(a['name']); check(a['digest'].startswith('sha256:'), 'Artifact has no provider digest'); hex_value(a['digest'][7:], 64)
    check(sum(a['size_in_bytes'] for a in c['sourceArtifacts']) <= MAX_PROOF, 'Oversized source evidence')
    receipt_path = pathlib.Path(name(c['sourceAcceptance']['path']))
    check(sha(receipt_path.read_bytes()) == hex_value(c['sourceAcceptance']['sha256'], 64), 'Independent source acceptance changed')
    receipt = load(receipt_path)
    check(receipt['sourceAccepted'] is True and receipt['publicationAccepted'] is False
          and receipt['sourceCommit'] == c['sourceCommit'] and receipt['sourceTree'] == c['sourceTree']
          and int(receipt['run']) == c['sourceRun'] and int(receipt['runAttempt']) == c['sourceAttempt'], 'Independent source acceptance identity mismatch')
    for kind in ('ordinaryRoutes', 'nativeRoutes'):
        r = receipt['checks'][kind]
        check(all(r[k] == 51 for k in ('rooms', 'won', 'sameOriginalCompanion')) and r['resets'] == r['respawns'] == 0, 'Incomplete original-companion source routes')
    cpu = receipt['checks']['cpu']
    check(cpu['tests'] == cpu['passed'] > 0 and cpu['failed'] == 0, 'Source CPU acceptance failed')
    check(receipt['checks']['nativeRoutes']['gameplayPassed'] == receipt['checks']['nativeRoutes']['capturesPassed'] == 51, 'Source native captures incomplete')
    causal = receipt['checks']['mechanismCausal']
    check(causal['pass'] is True and isinstance(causal['cases'], dict) and set(causal['cases']) == set(CAUSAL_CASES)
          and all(v['pass'] is True and v['geometricVisibilityAccepted'] is True
                  and all(v[k] is False for k in ('humanAccepted', 'cameraAccepted', 'hardwareFPSMeasured'))
                  for v in causal['cases'].values()), 'Source causal readability acceptance incomplete')
    check(c['distArtifact'] == 'camera-readability-dist', 'Wrong source package artifact')
    return c


def baseline(c):
    check(c['baselineCatalog'] == 'tools/campaign-v57-public-files.json', 'Wrong baseline catalog')
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


def lease(c, *, deployed=False, allow_pending=False):
    producer = os.environ['GITHUB_SHA']; hex_value(producer, 40)
    check(os.environ['GITHUB_REPOSITORY'] == REPO and os.environ['GITHUB_REF'] == 'refs/heads/main', 'Unexpected publisher origin')
    check(api('git/ref/heads/main')['object']['sha'] == producer, 'Publisher main lease moved')
    check([p['sha'] for p in api('git/commits/' + producer)['parents']] == [c['controllerParent']], 'Publisher is not the single accepted-parent successor')
    check(api('git/ref/heads/' + SOURCE_BRANCH)['object']['sha'] == c['sourceCommit']
          and api('git/commits/' + c['sourceCommit'])['tree']['sha'] == c['sourceTree'], 'Frozen source lease moved')
    deployments = pages('deployments?environment=github-pages'); check(deployments, 'No Pages deployment')
    deployments.sort(key=lambda d: d['id'], reverse=True)
    latest = deployments[0]; states = pages('deployments/' + str(latest['id']) + '/statuses')
    check(states, 'Pages deployment has no current status')
    run_url = 'https://github.com/' + REPO + '/actions/runs/' + os.environ['GITHUB_RUN_ID']
    def own(d, statuses):
        return d['sha'] == producer and any(s.get(k, '').rstrip('/') == run_url or s.get(k, '').startswith(run_url + '/')
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
    return {'deployment': latest, 'statuses': states}


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
    check(sorted(r['stableLevel'] for r in info['rooms']) == list(range(1, 52)), 'Candidate is not the full campaign')
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


def verify_public_causal(c, state, case, root):
    """Bind the already validated source runner output to this actual publisher.

    The independent root auditor additionally decodes media and replays the
    frozen source's physical/visibility validator. This final producer never
    promotes its own result to publication acceptance.
    """
    root = pathlib.Path(root); report = load(root / 'report.json'); binding = load(root / 'public-binding.json')
    def member(relative):
        p = root / name(relative)
        check(p.is_file() and not p.is_symlink(), 'Missing causal evidence member')
        return p
    def record(relative):
        p = member(relative); return {'path': relative, 'bytes': p.stat().st_size, 'sha256': sha(p.read_bytes())}
    check(report['kind'] == 'v58-causal-readability' and report['case'] == case and case in CAUSAL_CASES
          and report['pass'] is True and report['geometricVisibilityAccepted'] is True
          and all(report[k] is False for k in ('publicationAccepted', 'humanAccepted', 'cameraAccepted', 'hardwareFPSMeasured')), 'Failed or wrong causal report')
    s = report['source']; origin = report['controller']; package = report['package']
    check(s['commit'] == c['sourceCommit'] and s['tree'] == c['sourceTree'] and report['sourceWorkingBytesUnchanged'] is True
          and report['controllerWorkingBytesUnchanged'] is True and origin['trackedWorkingTreeClean'] is True
          and s['sourceReview'] == {'runId': c['sourceRun'], 'runAttempt': c['sourceAttempt']}, 'Causal SOURCE identity differs')
    receipt = load(c['sourceAcceptance']['path'])
    check(s['sourceInputsSha256'] == receipt['sourceInputsSha256'], 'Causal source inputs differ')
    check(origin['commit'] == c['sourceCommit'] and origin['runId'] == int(os.environ['GITHUB_RUN_ID'])
          and origin['tree'] == c['sourceTree'] and origin['runAttempt'] == int(os.environ['GITHUB_RUN_ATTEMPT'])
          and origin['captureOrigin'] == {'runId': int(os.environ['GITHUB_RUN_ID']), 'runAttempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
                                         'commit': os.environ['GITHUB_SHA']}, 'Causal controller has another producer')
    harness = origin['files']; paths = [r['path'] for r in harness]
    check(len(paths) == len(set(paths)) and {'scripts/qa-v58-causal-readability.mjs', 'scripts/lib/v58-readability-proof.mjs',
          'scripts/lib/v58-readability-observer.mjs'} <= set(paths) and sha(encoded(harness)) == origin['filesSha256'], 'Incomplete causal harness binding')
    for row in harness:
        p = pathlib.Path('source') / name(row['path'])
        check(p.is_file() and not p.is_symlink() and p.stat().st_size == row['bytes'] and sha(p.read_bytes()) == row['sha256'], 'Causal harness bytes differ')
    payload = [r for r in state['candidateFiles'] if r['path'] not in ('build-info.json', 'release-manifest.json')]
    stamp = next(r for r in state['candidateFiles'] if r['path'] == 'build-info.json')
    check(package['commit'] == c['sourceCommit'] and package['buildInfoSha256'] == state['originalBuildInfoSha256'] == stamp['sha256']
          and package['buildInfoBytes'] == stamp['bytes'] and package['files'] == payload
          and package['packageFilesSha256'] == sha(encoded(payload)), 'Causal served package differs')
    check(binding['kind'] == 'actual-v58-public-causal-binding' and binding['pass'] is True and binding['publicationAccepted'] is False
          and binding['case'] == case and binding['sourceCommit'] == c['sourceCommit'] and binding['sourceTree'] == c['sourceTree']
          and binding['producer'] == producer() and binding['publicURL'] == BASE + PREFIX
          and binding['buildInfoSha256'] == stamp['sha256'] and binding['freshPages'] == 1, 'Causal public origin differs')
    driver = pathlib.Path('source/scripts/qa-v58-causal-readability.mjs')
    check(binding['driver'] == {'path': 'scripts/qa-v58-causal-readability.mjs', 'sha256': sha(driver.read_bytes())}, 'Causal runner differs from source')
    for key, relative in [('sourceReport', 'report.json'), ('telemetry', 'telemetry.jsonl'), ('closedMediaInventory', 'closed-media-inventory.json')]:
        check(binding[key] == record(relative), 'Causal retained report/telemetry inventory differs')
    frozen = load(root / 'binding.json')
    check(frozen['source'] == s and frozen['controller'] == origin and frozen['package'] == package, 'Causal initial frozen binding differs')
    served = load(root / 'served-package.json')
    check(served['sourceCommit'] == c['sourceCommit'] and served['sourceTree'] == c['sourceTree'] and served['allHTTPFilesVerified'] is True
          and served['files'] == [dict(r, status=200) for r in payload] + [dict(stamp, status=200)], 'Causal full HTTP package proof differs')
    closed = load(root / 'closed-media-inventory.json')
    closed_rows = [r for r in inventory(root) if r['path'] not in ('closed-media-inventory.json', 'public-binding.json')]
    check(closed['files'] == closed_rows and closed['filesSha256'] == sha(encoded(closed_rows)), 'Causal closed source artifact membership/bytes differ')
    expected = {BASE + PREFIX + r['path']: r for r in state['candidateFiles']}; expected[BASE + PREFIX] = expected[BASE + PREFIX + 'index.html']
    check(len(binding['browserStampReads']) == 1 and binding['browserStampReads'][0] ==
          {'page': 1, 'url': BASE + PREFIX + 'build-info.json', 'status': 200, 'sha256': stamp['sha256']}, 'Causal fresh browser stamp differs')
    check(binding['network'] and any(r['url'].endswith('/index.html') or r['url'].endswith('.js') for r in binding['network']), 'No causal page response')
    for r in binding['network']:
        check(r['page'] == 1 and r['fromCache'] is False and r['status'] == 200 and r['url'] in expected
              and r['bytes'] == expected[r['url']]['bytes'] and r['sha256'] == expected[r['url']]['sha256'], 'Causal browser response differs')
    images = binding['decodedImages']; paths = [r['path'] for r in images]
    check(paths and paths == sorted(set(paths)) and paths == sorted(p.relative_to(root).as_posix() for p in (root / 'stills').rglob('*.jpg')), 'Causal still membership differs')
    for r in images:
        check(r['path'].startswith('stills/') and {k: r[k] for k in ('path', 'bytes', 'sha256')} == record(r['path'])
              and r['pixels'] == {'width': report['capture']['width'], 'height': report['capture']['height']}, 'Causal retained image differs')
    phases = report['phases']; ids = [p['id'] for p in phases]
    check(ids and len(ids) == len(set(ids)), 'Missing/duplicate causal phases')
    check(sorted(p.relative_to(root).as_posix() for p in (root / 'clips').rglob('*.mp4')) == sorted(p['clip']['path'] for p in phases), 'Causal MP4 membership differs')
    check(paths == sorted(k['path'] for p in phases for k in p['keyframes']), 'Causal retained stills differ from phase keyframes')
    for p in phases:
        clip = p['clip']; check(clip['path'].startswith('clips/') and {k: clip[k] for k in ('path', 'bytes', 'sha256')} == record(clip['path'])
              and type(clip['frames']) is int and clip['frames'] > 0, 'Causal clip differs')
        for k in p['keyframes']:
            check({field: k[field] for field in ('path', 'bytes', 'sha256')} == record(k['path']), 'Causal phase keyframe bytes differ')
    return {'case': case, 'report': record('report.json'), 'binding': record('public-binding.json'),
            'phases': ids, 'frames': sum(p['clip']['frames'] for p in phases), 'retainedImages': len(images)}


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
        canaries = [r for r in old if r['path'] in ('index.html', 'build-info.json', 'campaign-v57/build-info.json')]
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
        expected = ['prepare', 'deploy', 'public-http', 'entry'] + ['native (' + g + ')' for g in GROUPS] + ['causal (' + case + ')' for case in CAUSAL_CASES]
        prior = [j for j in jobs if j['name'] != 'verify']
        check(sorted(j['name'] for j in prior) == sorted(expected) and all(j['status'] == 'completed' and j['conclusion'] == 'success' for j in prior), 'An actual PUBLIC producer is missing or failed')
        entry = load('proof/entry/report.json')
        check(load('proof/public-http.json')['pass'] is True and entry['pass'] is True and entry['sourceCommit'] == c['sourceCommit']
              and entry['producer'] == producer() and entry['publicURL'] == BASE + PREFIX
              and entry['buildInfoSha256'] == state['originalBuildInfoSha256'] and len(entry['captures']) == 3
              and not entry['errors'], 'Actual HTTP or bare entry proof failed')
        observed = []
        for group, levels in GROUPS.items():
            report = load('proof/native-' + group + '/report.json'); binding = load('proof/native-' + group + '/public-binding.json')
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
        check(sorted(observed) == list(range(1, 52)), 'PUBLIC room union incomplete')
        causal = [verify_public_causal(c, state, case, pathlib.Path('proof') / ('causal-' + case)) for case in CAUSAL_CASES]
        source_provider(c); lease(c, deployed=True)
        write('proof/final-publication.json', {'technicalChecksPassed': True, 'publicationAccepted': False, 'requiresIndependentRootAcceptance': True,
              'producer': producer(), 'sourceCommit': c['sourceCommit'], 'sourceTree': c['sourceTree'], 'sourceReview': c['sourceRun'],
              'sourceJobs': source['jobs'], 'publicJobs': prior, 'sourceArtifacts': c['sourceArtifacts'], 'deployment': deployment,
              'originalBuildInfoSha256': state['originalBuildInfoSha256'], 'originalDistInventorySha256': sha(encoded(state['candidateFiles'])),
              'unionInventorySha256': sha(encoded(state['unionFiles'])), 'publicRooms': sorted(observed),
              'causalCases': list(CAUSAL_CASES), 'causalProofs': causal,
              'limitations': ['Automated ordinary inputs and software WebGL; no human/device/live-Yandex acceptance.', 'Finite probes do not prove absence of all bypasses.', 'Final publisher job and complete provider artifacts require independent terminal review.']})


if __name__ == '__main__':
    main()
