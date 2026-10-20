"""Append only an independently accepted, immutable v63 consumer package.

Every old public byte is preserved, including the old root entry. This release
is reached at /campaign-v63/. Source test SDK evidence is never shipped as the
consumer game or represented as real Yandex moderation/advertising acceptance.
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

REPO='amazin20/brainrot-portal'
BASE='https://amazin20.github.io/brainrot-portal/'
PREFIX='campaign-v63/'
URL=BASE+PREFIX
CONFIG='tools/campaign-v63-release.json'
BASELINE=(2605,690702631,'2ecbf5a2b61c5b0fd8366f833c6670672f3447a16db3fd36464088291421190e')
CATALOG_SHA='e5d36ae12354ec7fea8c86a187d5a044fdf29ecec669789b8fe85b9f12c17994'
BASELINE_DEPLOYMENT={'id':7190324410,'sha':'c5814892d6a40ffc911e0ed62df022f82990cb4a'}
BASELINE_SOURCE='8102e724cafff008faf57316fcd82f03ed6f4072'
SOURCE_BRANCH='upgrade/campaign-access-20261020'
SOURCE_WORKFLOW='.github/workflows/player-access-review.yml'
PUBLIC_WORKFLOW='.github/workflows/publish-campaign-v63.yml'
RECOVERY_KIND='byte-identical-republish-after-public-observer-failure'
ORIGINAL_CONTROLLER_PARENT='d19c595c7f177995ec93837ddbfc9806fa1a40fe'
GROUPS={'early':list(range(1,11)),'energy':list(range(11,21)),'living':list(range(21,31)),'optics':list(range(31,41)),'fracture':list(range(42,52)),'castle':[41]}
LEGACY_ROUTE_RESET_COUNTER_SCOPE='reported journey counters after legacy fixture initialization; the initial fixture reset is outside these counters; specialized drivers retain their own stricter proofs'
MAX_SAFE_INTEGER=2**53-1
MAX_SITE=800_000_000
MAX_PACKAGE=100_000_000
MAX_PROOF=2_000_000_000
def positive_safe_integer(value):return type(value) is int and 0<value<=MAX_SAFE_INTEGER

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
            headers = {'Accept-Encoding': 'identity', 'User-Agent': 'brainrot-append-v63'}
            if token:
                check(url.startswith('https://api.github.com/repos/' + REPO + '/'), 'Token outside repository API')
                headers.update(Authorization='Bearer ' + os.environ['GITHUB_TOKEN'], Accept='application/vnd.github+json')
            with urllib.request.build_opener(Redirect()).open(urllib.request.Request(url, headers=headers), timeout=90) as response:
                check(response.status == 200 and not absent, 'Expected an absent v63 namespace' if absent else 'GET did not return 200')
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


def check_legacy_route_scope(row):
    check(row.get('normalUiZeroStepStartProven') is False
      and row.get('resetCounterScope') == LEGACY_ROUTE_RESET_COUNTER_SCOPE,
      'Legacy route scope is omitted, changed or falsely claims a normal-UI zero-step start')


def check_route_reset_counters(route):
    # Ordinary Source rows expose resetCargo calls through `resets`, and
    # serialize the additional specialized `cargoResets` counter as null.
    # Null is optional metadata, never a replacement for the real counters.
    for key in ('resets', 'respawns'):
        check(type(route.get(key)) is int and route[key] == 0,
              'PUBLIC actual route counter is missing, invalid or nonzero: ' + key)
    cargo = route.get('cargoResets')
    check(cargo is None or type(cargo) is int and cargo == 0,
          'PUBLIC optional cargo reset counter is invalid or nonzero')


def validate_source_provider(c, provider):
    run, jobs, artifacts = (provider[key] for key in ('run', 'jobs', 'artifacts'))
    check(run['id'] == c['sourceRun'] and run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_sha'] == c['sourceCommit']
          and run['head_branch'] == SOURCE_BRANCH and run['path'].split('@')[0] == SOURCE_WORKFLOW
          and run['run_attempt'] == c['sourceAttempt'] and run['id'] != int(os.environ['GITHUB_RUN_ID']), 'Source run identity or terminal status differs')
    check(sorted(j['name'] for j in jobs) == sorted(c['expectedJobs'])
          and len({j['id'] for j in jobs}) == len(jobs)
          and all(positive_safe_integer(j['id']) and j['run_id'] == c['sourceRun']
                  and j['run_attempt'] == c['sourceAttempt'] and j['head_sha'] == c['sourceCommit']
                  and j['status'] == 'completed' and j['conclusion'] == 'success' for j in jobs),
          'Actual source jobs differ or failed')
    actual = [{k: a[k] for k in ('id', 'name', 'size_in_bytes', 'digest')} for a in artifacts]
    check(sorted(actual, key=lambda a: a['id']) == sorted(c['sourceArtifacts'], key=lambda a: a['id'])
          and all(not a['expired'] and a['workflow_run']['head_sha'] == c['sourceCommit'] and a['workflow_run']['id'] == run['id'] for a in artifacts), 'Actual source artifact metadata/provenance changed')
    return {'run': run, 'jobs': jobs, 'artifacts': artifacts}


def source_provider(c):
    run = api('actions/runs/' + str(c['sourceRun']))
    return validate_source_provider(c, {'run':run,
        'jobs':pages('actions/runs/' + str(run['id']) + '/attempts/' + str(c['sourceAttempt']) + '/jobs'),
        'artifacts':pages('actions/runs/' + str(run['id']) + '/artifacts')})


def recovery_config(c):
    r = c.get('recovery')
    if r is None:
        return None
    check(type(r) is dict and r.get('kind') == RECOVERY_KIND and r.get('publicationAccepted') is False,
          'Recovery must retain the original failed publication status')
    check(r['publisherCommit'] == '7feee7351bc2be2cdee708cae0e7a305bca6567c'
          and r['publisherTree'] == '8fe1f1318f5deab459fd240a16655bbfc62d738a'
          and r['runId'] == 39416100725 and r['runAttempt'] == 1
          and r['workflow'] == PUBLIC_WORKFLOW
          and r['deployment'] == {'id':7198668659,'sha':r['publisherCommit']},
          'Recovery origin is not the explicitly pinned partial v63 publication')
    check(c['controllerParent'] == r['publisherCommit'], 'Recovery controller must directly follow its original publisher')
    hex_value(r['originalConfigSha256'],64)
    expected = ['prepare','deploy','public-http','player','verify'] + ['native ('+group+')' for group in GROUPS]
    check(type(r['expectedJobs']) is list and len(r['expectedJobs']) == 11
          and sorted(row['name'] for row in r['expectedJobs']) == sorted(expected)
          and len({row['id'] for row in r['expectedJobs']}) == 11, 'Incomplete original Public job pins')
    for row in r['expectedJobs']:
        check(set(row) == {'id','name','conclusion'} and positive_safe_integer(row['id']), 'Invalid original job pin')
        check(row['conclusion'] == ('failure' if row['name'] == 'player' else 'skipped' if row['name'] == 'verify' else 'success'),
              'Recovery must retain the exact failed observer/skipped verify cohort')
    check(type(r['artifacts']) is list and len(r['artifacts']) == 11
          and len({row['id'] for row in r['artifacts']}) == len({row['name'] for row in r['artifacts']}) == 11,
          'Incomplete original artifact pins')
    wanted = {'github-pages','v63-preparation','v63-deployment-lease','v63-public-http','v63-public-player',
              *('v63-public-native-'+group for group in GROUPS)}
    check({row['name'] for row in r['artifacts']} == wanted, 'Original partial artifact membership changed')
    for row in r['artifacts']:
        check(set(row) == {'id','name','size_in_bytes','digest'} and positive_safe_integer(row['id'])
              and type(row['size_in_bytes']) is int and 0 < row['size_in_bytes'] <= MAX_PROOF,
              'Invalid original artifact pin')
        check(row['digest'].startswith('sha256:'), 'Missing original provider ZIP digest');hex_value(row['digest'][7:],64)
    for key, artifact_name, filename in [('preparation','v63-preparation','preparation.json'),('http','v63-public-http','public-http.json')]:
        pin = r[key]
        check(set(pin) == {'artifactId','path','bytes','sha256'} and pin['path'] == filename
              and positive_safe_integer(pin['bytes']) and pin['bytes'] <= 25_000_000, 'Invalid original document pin')
        hex_value(pin['sha256'],64)
        check(len([row for row in r['artifacts'] if row['id'] == pin['artifactId'] and row['name'] == artifact_name]) == 1,
              'Original document is not bound to its exact artifact')
    check(set(r['union']) == {'files','bytes','inventorySha256'} and r['union']['files'] == 2686
          and r['union']['bytes'] == 697909952
          and r['union']['inventorySha256'] == '2b94cf95c7e41a9d5d0d35cb305fb2ecb25a70e6884714c1f1460d97b767ffc8',
          'Recovery must preserve the exact complete first-publication union')
    check(r['provenance'] == {'path':PREFIX+'publication-provenance.json','bytes':12017,
          'sha256':'fe44e1a3c3aaeb6e9804d194b7c39a358f34a1c54a0fd47607d732832f0be3b8'},
          'Recovery must retain the exact original provenance bytes')
    return r


def previous_deployment(c):
    r = recovery_config(c)
    return r['deployment'] if r else c['baselineDeployment']


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
    previous = previous_deployment(c)
    if deployed:
        check(own(latest, states) and states[0]['state'] == 'success'
              and latest['id'] > previous['id'], 'New successful Pages deployment does not belong to this publisher run')
    else:
        # An environment job creates its own pending deployment before its first
        # step. Admit that exact current-run record only, then inspect baseline.
        if allow_pending and own(latest, states):
            check(states[0]['state'] in ('queued', 'pending', 'in_progress') and len(deployments) > 1, 'Current run already deployed or has no baseline')
            latest = deployments[1]; states = pages('deployments/' + str(latest['id']) + '/statuses')
        check(latest['id'] == previous['id'] and latest['sha'] == previous['sha']
              and states and states[0]['state'] == 'success', 'Accepted deployment lease changed')
    if retained:
        write(retained / 'manifest.json', {'schemaVersion': 1, 'kind': 'actual-v63-ci-deployment-api-snapshot',
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
    if recovery_config(c):
        recovered=validate_recovery_material(c,baseline(c),state['candidateFiles'],state['originalBuildInfoSha256'])
        check(state['recovery']==recovered and state['recoveryHTTP']==http_summary(recovered['unionFiles'])
              and state['unionFiles']==recovered['unionFiles'],'Recovery preparation or restored HTTP binding changed')
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


def source_receipt(c):
    pin=c['sourceAcceptance'];path=pathlib.Path(name(pin['path']))
    check(path.as_posix()=='tools/campaign-v63-root-source-acceptance.json','Wrong independent source receipt')
    check(sha(path.read_bytes())==hex_value(pin['sha256'],64),'Independent source acceptance changed')
    receipt=load(path)
    check(receipt['sourceAccepted'] is True and receipt['publicationAccepted'] is False
          and receipt['sourceCommit']==c['sourceCommit'] and receipt['sourceTree']==c['sourceTree']
          and int(receipt['run'])==c['sourceRun'] and int(receipt['runAttempt'])==c['sourceAttempt']
          and receipt['sourceReview']=={'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']}
          and receipt['baselineSourceC']==BASELINE_SOURCE,'Independent source acceptance identity mismatch')
    checks=receipt['checks'];cpu=checks['cpu'];native=checks['nativeRoutes']
    check(cpu['tests']==cpu['passed']>0 and cpu['failed']==0,'Source CPU acceptance failed')
    check(native['gameplayPassed']==native['capturesPassed']==51,'Source native routes incomplete')
    check_legacy_route_scope(native)
    for key in ('playerAccess','rewardedUI'):
        check(checks[key]['pass'] is True,'Source UI proof failed: '+key)
    platform=checks['platformChecker']
    check(platform['pass'] is True and platform['rooms']==51 and platform['liveSdkAccepted'] is False
          and platform['moderationAccepted'] is False,'Original checker review cohort is incomplete or mislabelled')
    for key in ('opticsNative','architecture'):
        check(checks[key]['pass'] is True and checks[key]['rooms']==10,'Source Optics proof failed: '+key)
    rows_valid(receipt['candidateFiles'],MAX_PACKAGE)
    check(receipt['candidateBytes']==sum(r['bytes'] for r in receipt['candidateFiles'])
          and receipt['candidateInventorySha256']==sha(encoded(receipt['candidateFiles'])),'Accepted package inventory differs')
    return receipt

def config():
    c=load(CONFIG)
    check(c['schemaVersion']==1 and c['frozen'] is True and c['publicationAccepted'] is False,'Release not frozen for independent publication')
    check(c['repository']==REPO and c['namespace']==PREFIX and c['version']=='v63-player-access-optics','Wrong release identity')
    check(c['sourceBranch']==SOURCE_BRANCH and c['sourceWorkflow']==SOURCE_WORKFLOW,'Wrong source producer')
    for key in ('sourceCommit','sourceTree','controllerParent'):hex_value(c[key],40)
    check(positive_safe_integer(c['sourceRun']) and positive_safe_integer(c['sourceAttempt']),'Unpinned source run')
    recovery = recovery_config(c)
    if recovery is None:
        check(c['controllerParent']==ORIGINAL_CONTROLLER_PARENT,'Unexpected accepted Main parent')
    jobs=c['expectedJobs'];artifacts=c['sourceArtifacts']
    check(type(jobs) is list and len(jobs)==len(set(jobs))==c['sourceContract']['jobs'] and len(jobs)>20,'Incomplete frozen source job contract')
    check(type(artifacts) is list and len(artifacts)==c['sourceContract']['artifacts']>20
          and len({a['id'] for a in artifacts})==len({a['name'] for a in artifacts})==len(artifacts),'Incomplete frozen artifact contract')
    for a in artifacts:
        check(set(a)=={'id','name','size_in_bytes','digest'} and positive_safe_integer(a['id'])
              and type(a['size_in_bytes']) is int and 0<a['size_in_bytes']<=MAX_PROOF,'Invalid provider artifact pin')
        name(a['name']);check(a['digest'].startswith('sha256:'),'Artifact has no provider digest');hex_value(a['digest'][7:],64)
    check(sum(a['size_in_bytes'] for a in artifacts)<=MAX_PROOF,'Oversized source evidence')
    check(c['baselineCatalog']=='tools/campaign-v62-public-files.json' and c['baselineCatalogSha256']==CATALOG_SHA
          and c['baselineInventorySha256']==BASELINE[2] and c['baselineDeployment']==BASELINE_DEPLOYMENT,'Changed accepted baseline pin')
    check(c['distArtifact']=='v63-dist','Wrong source consumer package artifact')
    source_receipt(c)
    return c

def baseline(c):
    check(c['baselineCatalog']=='tools/campaign-v62-public-files.json','Wrong baseline catalog')
    check(sha(pathlib.Path(c['baselineCatalog']).read_bytes())==CATALOG_SHA,'Baseline catalog raw bytes changed')
    d=load(c['baselineCatalog']);rows=d['siteFiles'];rows_valid(rows)
    check(d['publicationAccepted'] is True and d['sourceCommit']==BASELINE_SOURCE
          and (len(rows),sum(r['bytes'] for r in rows),sha(encoded(rows)))==BASELINE,'Baseline catalog was not accepted')
    check(not any(r['path'].startswith(PREFIX) for r in rows),'Namespace already in baseline')
    return rows


def http_summary(rows):
    rows_valid(rows)
    return {'files':len(rows),'bytes':sum(row['bytes'] for row in rows),
            'inventorySha256':sha(encoded(rows)),'method':'complete HTTP GET, exact length and SHA-256 for every file'}


def original_recovery_producer(r):
    return {'GITHUB_REPOSITORY':REPO,'GITHUB_SHA':r['publisherCommit'],
            'GITHUB_RUN_ID':str(r['runId']),'GITHUB_RUN_ATTEMPT':str(r['runAttempt'])}


def publication_provenance(c,state):
    r = recovery_config(c)
    original = original_recovery_producer(r) if r else state['producer']
    if r and state.get('recovery') is not None:
        check(state['recovery']['originalProducer'] == original, 'Recovery origin producer changed')
    return {'publicationAccepted':False,'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],
            'sourceReview':{'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},
            'sourceAcceptance':c['sourceAcceptance'],'sourceArtifacts':c['sourceArtifacts'],'producer':original,
            'originalBuildInfoSha256':state['originalBuildInfoSha256'],
            'originalDistInventorySha256':sha(encoded(state['candidateFiles'])),
            'scope':'New consumer namespace only; all historical public files remain exact original bytes. Test SDK/checker packages are not shipped.'}


def check_original_deployment(r,value):
    deployment,statuses = value['deployment'],value['statuses']
    check(deployment['id'] == r['deployment']['id'] and deployment['sha'] == r['publisherCommit']
          and deployment['environment'] == 'github-pages' and type(statuses) is list and statuses
          and statuses[0]['state'] == 'success', 'Original partial deployment ownership/status differs')
    run_url = 'https://github.com/'+REPO+'/actions/runs/'+str(r['runId'])
    check(any(isinstance(statuses[0].get(key),str)
              and (statuses[0][key].rstrip('/') == run_url or statuses[0][key].startswith(run_url+'/'))
              for key in ('log_url','target_url')), 'Original deployment is not owned by the pinned failed run')


def validate_recovery_provider(c,provider):
    r = recovery_config(c);check(r is not None, 'Recovery provider requires explicit recovery mode')
    check(set(provider) == {'run','commit','jobs','artifacts','deployment','statuses'}, 'Unexpected recovery provider objects')
    run,commit,jobs,artifacts = (provider[key] for key in ('run','commit','jobs','artifacts'))
    check(run['id'] == r['runId'] and run['run_attempt'] == r['runAttempt'] and run['status'] == 'completed'
          and run['conclusion'] == 'failure' and run['head_sha'] == r['publisherCommit'] and run['head_branch'] == 'main'
          and run['event'] == 'push' and run['path'].split('@')[0] == r['workflow']
          and run['repository']['full_name'] == REPO, 'Original failed Public run identity/terminal state differs')
    check(commit['sha'] == r['publisherCommit'] and commit['tree']['sha'] == r['publisherTree']
          and [row['sha'] for row in commit['parents']] == [ORIGINAL_CONTROLLER_PARENT], 'Original publisher tree/parent differs')
    check(type(jobs) is list and len(jobs) == 11
          and sorted([{key:row[key] for key in ('id','name','conclusion')} for row in jobs],key=lambda row:row['id'])
              == sorted(r['expectedJobs'],key=lambda row:row['id'])
          and all(row['status'] == 'completed' and row['run_id'] == r['runId']
                  and row['run_attempt'] == r['runAttempt'] and row['head_sha'] == r['publisherCommit'] for row in jobs),
          'Original actual job cohort differs from terminal failed-run pins')
    check(type(artifacts) is list and len(artifacts) == 11
          and sorted([{key:row[key] for key in ('id','name','size_in_bytes','digest')} for row in artifacts],key=lambda row:row['id'])
              == sorted(r['artifacts'],key=lambda row:row['id'])
          and all(row['expired'] is False and row['workflow_run']['id'] == r['runId']
                  and row['workflow_run']['head_sha'] == r['publisherCommit'] for row in artifacts),
          'Original actual artifact cohort differs from failed-run pins')
    check_original_deployment(r,provider)
    return provider


def retained_recovery_document(c,key):
    r = recovery_config(c);pin = r[key]
    artifact = next(row for row in r['artifacts'] if row['id'] == pin['artifactId'])
    base = pathlib.Path('proof/recovery');zip_name = str(artifact['id'])+'.zip'
    archive = base/zip_name;extracted = base/artifact['name']/pin['path']
    check(archive.is_file() and not archive.is_symlink() and extracted.is_file() and not extracted.is_symlink(),
          'Exact original ZIP and extracted regular document required')
    zip_bytes = archive.read_bytes()
    check(len(zip_bytes) == artifact['size_in_bytes'] and sha(zip_bytes) == artifact['digest'][7:], 'Original ZIP provider bytes changed')
    with zipfile.ZipFile(archive) as zipped:
        members = zipped.infolist();check(len(members) == 1, 'Original recovery ZIP must contain exactly one document')
        member = members[0];kind = stat.S_IFMT(member.external_attr >> 16)
        check(member.filename == member.orig_filename == pin['path'] and not member.is_dir()
              and kind in (0,stat.S_IFREG) and not member.flag_bits&1
              and member.compress_type in (zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED)
              and member.file_size == pin['bytes'], 'Unsafe, wrapped or incorrectly sized original ZIP document')
        # read() reaches EOF and executes the original ZIP CRC verification.
        body = zipped.read(member)
    check(len(body) == pin['bytes'] and sha(body) == pin['sha256'] and extracted.read_bytes() == body,
          'Original extracted document differs from pinned ZIP body')
    return load(extracted),{'artifactId':artifact['id'],'artifactName':artifact['name'],
        'path':'recovery/'+artifact['name']+'/'+pin['path'],'bytes':len(body),'sha256':sha(body),
        'zipPath':'recovery/'+zip_name,'zipBytes':len(zip_bytes),'zipSha256':sha(zip_bytes)}


def validate_recovery_material(c,old,candidate_rows,original_stamp):
    """Pure authentication of retained original objects/ZIPs and exact union.

    This performs no network, extraction, writes or acceptance. Provider JSON
    consists of parsed actual API objects, not retained original HTTP bodies.
    """
    r = recovery_config(c);check(r is not None, 'Explicit byte-identical recovery required')
    rows_valid(old);rows_valid(candidate_rows,MAX_PACKAGE);hex_value(original_stamp,64)
    root = pathlib.Path('proof/recovery');provider_path = root/'provider.json'
    check(root.is_dir() and not root.is_symlink() and provider_path.is_file() and not provider_path.is_symlink(),
          'Retained regular recovery material required')
    provider = validate_recovery_provider(c,load(provider_path))
    prior,prep_pin = retained_recovery_document(c,'preparation')
    http,http_pin = retained_recovery_document(c,'http')
    wanted = {'provider.json',str(r['preparation']['artifactId'])+'.zip',str(r['http']['artifactId'])+'.zip',
              prep_pin['artifactName']+'/'+r['preparation']['path'],http_pin['artifactName']+'/'+r['http']['path']}
    check({row['path'] for row in inventory(root)} == wanted, 'Recovery material has extra or missing files')
    expected_dirs = {prep_pin['artifactName'],http_pin['artifactName']}
    check({p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_dir()} == expected_dirs,
          'Recovery material has unexpected directories')
    origin = original_recovery_producer(r)
    check(prior['publicationAccepted'] is False and prior['producer'] == origin
          and prior['configSha256'] == r['originalConfigSha256'] and prior.get('recovery') is None,
          'Original preparation origin/configuration differs')
    validate_source_provider(c,prior['sourceProvider'])
    check(prior['baseline'] == http_summary(old) and prior['candidateFiles'] == candidate_rows
          and prior['originalBuildInfoSha256'] == original_stamp, 'Original baseline or accepted candidate changed')
    check(len(prior['sourceArtifacts']) == len(c['sourceArtifacts']), 'Original Source artifact inventory incomplete')
    for observed,pin in zip(prior['sourceArtifacts'],c['sourceArtifacts']):
        check(observed['provider'] == pin, 'Original Source artifact pin/order differs')
        rows_valid(observed['files'],MAX_PROOF)
        check(observed['inventorySha256'] == sha(encoded(observed['files'])), 'Original Source artifact inventory changed')
    check(next(row['files'] for row in prior['sourceArtifacts'] if row['provider']['name'] == c['distArtifact']) == candidate_rows,
          'Original consumer artifact differs from accepted Source')
    before = prior['deploymentBefore'];check(before['deployment']['id'] == c['baselineDeployment']['id']
          and before['deployment']['sha'] == c['baselineDeployment']['sha']
          and before['statuses'] and before['statuses'][0]['state'] == 'success','Original accepted v62 deployment lease differs')
    provenance = publication_provenance(c,{'producer':origin,'candidateFiles':candidate_rows,'originalBuildInfoSha256':original_stamp})
    provenance_bytes = json.dumps(provenance,ensure_ascii=False,indent=2,allow_nan=False).encode()+b'\n'
    provenance_row = {'path':PREFIX+'publication-provenance.json','bytes':len(provenance_bytes),'sha256':sha(provenance_bytes)}
    check(provenance_row == r['provenance'], 'Recovery would rewrite or misattribute the original publication provenance')
    expected = sorted(old+[dict(row,path=PREFIX+row['path']) for row in candidate_rows]+[provenance_row],key=lambda row:row['path'])
    rows_valid(prior['unionFiles']);check(prior['unionFiles'] == expected, 'Original public union changed historical or accepted candidate bytes')
    union = {key:value for key,value in http_summary(expected).items() if key != 'method'}
    check(union == r['union'], 'Original complete union differs from recovery pin')
    check(http['pass'] is True and http['publicationAccepted'] is False and http['producer'] == origin
          and http['union'] == http_summary(expected), 'Original successful HTTP proof differs')
    check_original_deployment(r,http['deployment'])
    retained_statuses = {row['id']:row for row in provider['statuses']}
    check(all(retained_statuses.get(row['id']) == row for row in http['deployment']['statuses']), 'Original HTTP deployment status bytes changed')
    provider_bytes = provider_path.read_bytes()
    return {'kind':RECOVERY_KIND,'publicationAccepted':False,'originalProducer':origin,
        'originalConfigSha256':r['originalConfigSha256'],'previousDeployment':r['deployment'],
        'originalPreparation':prep_pin,'originalHttp':http_pin,
        'originalProvider':{'path':'recovery/provider.json','bytes':len(provider_bytes),'sha256':sha(provider_bytes),'parsedObjectsNotRawResponseBytes':True},
        'originalProvenance':provenance_row,'union':union,'unionFiles':expected}


def acquire_recovery_material(c):
    r = recovery_config(c);root = pathlib.Path('proof/recovery');check(not root.exists(),'Use fresh recovery material')
    provider = {'run':api('actions/runs/'+str(r['runId'])),'commit':api('git/commits/'+r['publisherCommit']),
        'jobs':pages('actions/runs/'+str(r['runId'])+'/attempts/'+str(r['runAttempt'])+'/jobs'),
        'artifacts':pages('actions/runs/'+str(r['runId'])+'/artifacts'),
        'deployment':api('deployments/'+str(r['deployment']['id'])),
        'statuses':pages('deployments/'+str(r['deployment']['id'])+'/statuses')}
    validate_recovery_provider(c,provider);write(root/'provider.json',provider)
    for key in ('preparation','http'):
        pin = r[key];artifact = next(row for row in r['artifacts'] if row['id'] == pin['artifactId'])
        archive = root/(str(artifact['id'])+'.zip')
        get('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+str(artifact['id'])+'/zip',token=True,
            expected={'bytes':artifact['size_in_bytes'],'sha256':artifact['digest'][7:]},destination=archive)
        members = safe_extract(archive,root/artifact['name'],25_000_000)
        check(members == [{'path':pin['path'],'bytes':pin['bytes'],'sha256':pin['sha256']}], 'Original artifact extraction is not its single pinned document')

def prepare(c):
    check(not pathlib.Path('pages').exists() and not pathlib.Path('source-artifacts').exists(),'Preparation output already exists')
    old=baseline(c);provider=source_provider(c);before=lease(c)
    recovery = recovery_config(c)
    if recovery:
        acquire_recovery_material(c)
    else:
        for target in (PREFIX,PREFIX+'index.html',PREFIX+'build-info.json',PREFIX+'publication-provenance.json'):get(BASE+target,absent=True)
    artifacts=[]
    for a in c['sourceArtifacts']:
        archive=pathlib.Path('source-artifacts')/(str(a['id'])+'.zip')
        get('https://api.github.com/repos/'+REPO+'/actions/artifacts/'+str(a['id'])+'/zip',token=True,
            expected={'bytes':a['size_in_bytes'],'sha256':a['digest'][7:]},destination=archive)
        folder=pathlib.Path('source-artifacts')/a['name']
        members=safe_extract(archive,folder,MAX_PACKAGE if a['name']==c['distArtifact'] else MAX_PROOF)
        artifacts.append({'provider':a,'files':members,'inventorySha256':sha(encoded(members))})
    candidate=pathlib.Path('source-artifacts')/c['distArtifact'];candidate_rows=validate_candidate(c,candidate)
    original_stamp=sha((candidate/'build-info.json').read_bytes())
    state={'publicationAccepted':False,'producer':producer(),'configSha256':sha(pathlib.Path(CONFIG).read_bytes()),
           'candidateFiles':candidate_rows,'originalBuildInfoSha256':original_stamp,
           'sourceProvider':provider,'sourceArtifacts':artifacts,'deploymentBefore':before}
    if recovery:
        state['recovery']=validate_recovery_material(c,old,candidate_rows,original_stamp)
        state['recoveryHTTP']=verify_http(state['recovery']['unionFiles'],'pages')
        check(state['recoveryHTTP']==http_summary(state['recovery']['unionFiles']),'Fresh recovery HTTP restore incomplete')
        restored=http_summary(old)
    else:
        restored=verify_http(old,'pages');check(not (pathlib.Path('pages')/PREFIX).exists(),'Refuse existing namespace')
        shutil.copytree(candidate,pathlib.Path('pages')/PREFIX)
        write(pathlib.Path('pages')/PREFIX/'publication-provenance.json',publication_provenance(c,state))
    union=inventory('pages');check(len(union)==len(old)+len(candidate_rows)+1,'Append changed existing site membership')
    check([r for r in union if not r['path'].startswith(PREFIX)]==old,'Existing bytes changed during append')
    if recovery:check(union==state['recovery']['unionFiles'],'Restored recovery union changed a prior public byte')
    state.update(baseline=restored,unionFiles=union);write('proof/preparation.json',state)

def validate_public_player(c,state):
    report=load('proof/player/report.json');binding=load('proof/player/public-binding.json')
    check(report['kind']=='actual-consumer-player-access-browser-proof' and report['pass'] is True
          and report['sourceCommit']==c['sourceCommit'] and report['sourceTree']==c['sourceTree'] and report['url']==URL
          and report['stage']=='complete' and not report['errors'],'Actual PUBLIC player UI proof failed')
    check(binding['pass'] is True and binding['producer']==producer() and binding['sourceCommit']==c['sourceCommit']
          and binding['publicURL']==URL and binding['buildInfoSha256']==state['originalBuildInfoSha256'],'PUBLIC player binding differs')
    check(binding['driver']['path']=='scripts/qa-player-access-browser.mjs'
          and binding['driver']['sha256']==sha(pathlib.Path('source/scripts/qa-player-access-browser.mjs').read_bytes()),'PUBLIC UI driver changed')
    check_network(binding['network'],binding['browserStampReads'],state['candidateFiles'],state['originalBuildInfoSha256'],binding['freshPages'],entry=True)
    check(type(binding['freshPages']) is int and binding['freshPages']>8
          and {r['page'] for r in binding['browserStampReads']}==set(range(1,binding['freshPages']+1)),
          'A PUBLIC player page omitted its actual build-stamp read')
    check([r['phase'] for r in report['migration']]==['initial','settings','playing','reloaded']
          and len(report['forgedQueries'])==4 and len(report['hintCatalogue'])==51 and len(report['mobile'])==2,'PUBLIC UI cohort is incomplete')
    check(report['atlasReturn']['sameLevelAndActors'] is True and report['atlasReturn']['frozenPhysicsWhileAtlasOpen'] is True,'PUBLIC Atlas destroyed the active scene')
    check(len(binding['decodedImages'])==len(report['screenshots'])>2,'PUBLIC HTML screenshots missing')
    images={row['path']:row for row in binding['decodedImages']}
    check(len(images)==len(report['screenshots']),'Duplicate PUBLIC HTML screenshot')
    for row in report['screenshots']:
        relative=name(row['path']);image=images.get(relative);file=pathlib.Path('proof/player')/relative
        check(image and file.is_file() and not file.is_symlink(),'Missing PUBLIC screenshot file')
        raw=file.read_bytes()
        check(len(raw)==row['bytes']==image['bytes'] and sha(raw)==row['sha256']==image['sha256']
              and raw[:8]==b'\x89PNG\r\n\x1a\n' and len(raw)>24,'PUBLIC screenshot bytes changed')
        check(image['pixels']=={'width':int.from_bytes(raw[16:20],'big'),'height':int.from_bytes(raw[20:24],'big')},
              'PUBLIC screenshot dimensions differ from decoded capture')
    check(report['liveSdkAccepted'] is False and report['moderationAccepted'] is False,'PUBLIC UI falsely grants live platform acceptance')
    return {'report':{'bytes':pathlib.Path('proof/player/report.json').stat().st_size,'sha256':sha(pathlib.Path('proof/player/report.json').read_bytes())},
            'screenshots':binding['decodedImages'],'freshPages':binding['freshPages'],'migrationPhases':[r['phase'] for r in report['migration']]}

def validate_public_routes(c,state):
    observed=[];groups=[]
    for group,levels in GROUPS.items():
        root=pathlib.Path('proof')/('native-'+group);report=load(root/'report.json');binding=load(root/'public-binding.json')
        check_legacy_route_scope(binding)
        check(report['sourceCommit']==c['sourceCommit'] and report['package']['commit']==c['sourceCommit']
              and [r['level'] for r in report['rows']]==levels and report['pass'] is True and report['capturePass'] is True
              and not report['errors'] and binding['pass'] is True and binding['producer']==producer()
              and binding['publicURL']==URL and binding['buildInfoSha256']==state['originalBuildInfoSha256'],'PUBLIC route package/group binding differs')
        check(binding['freshPages']==len(levels) and len(binding['decodedImages'])==len(levels),'PUBLIC route page/image count differs')
        images={row['path']:row for row in binding['decodedImages']}
        check(set(images)=={str(level)+'-finish.jpg' for level in levels},'PUBLIC route image cohort differs')
        for relative,image in images.items():
            file=root/name(relative);check(file.is_file() and not file.is_symlink(),'PUBLIC route image is missing or special')
            raw=file.read_bytes();check(len(raw)==image['bytes'] and sha(raw)==image['sha256'],'PUBLIC route image bytes changed')
        check_network(binding['network'],binding['browserStampReads'],state['candidateFiles'],state['originalBuildInfoSha256'],len(levels))
        for row in report['rows']:
            r=row['route'];capture=row['captures']['finish'];start=row['start']
            check_route_reset_counters(r)
            check(row['pass'] is row['gameplayPassed'] is row['capturePass'] is True and not row['errors']
                  and r['pass'] is True and r['state']=='won' and r['sameCompanion'] is r['sameCargoShape'] is True
                  and r['cargoUUID']==start['cargoUUID'] and r['cargoBodyId']==start['cargoBodyId'],'PUBLIC original-companion route failed')
            check(capture['ok'] is True and capture['includesHTML'] is False and capture['frame']['state']=='won'
                  and capture['frame']['levelIndex']==row['level']-1 and capture['frame']['cargoUUID']==start['cargoUUID']
                  and capture['frame']['cargoBodyId']==start['cargoBodyId'],'PUBLIC finish pixels belong to another scene')
            if row['level']==41:
                marks=r['milestones'];ids=['freight','sluice','optics','hoist','archive','flywheel','magnet','migrant','pendulum','inertia','impulse','crown']
                check([m['name'][6:] for m in marks if m['name'].startswith('Start ')]==ids
                      and [m['name'][7:] for m in marks if m['name'].startswith('Solved ')]==ids,'PUBLIC castle omits a mechanism')
                check(len(binding['impulsePhysicalProofs'])==1 and binding['impulsePhysicalProofs'][0]['pass'] is True,'PUBLIC castle physical proof missing')
            observed.append(row['level'])
        groups.append({'group':group,'levels':levels,'reportSha256':sha((root/'report.json').read_bytes()),'bindingSha256':sha((root/'public-binding.json').read_bytes())})
    check(sorted(observed)==list(range(1,52)),'PUBLIC room union incomplete')
    return groups

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['pins','prepare','before','public','final']);args=parser.parse_args();c=config()
    if args.command=='pins':
        with open(os.environ.get('GITHUB_OUTPUT',os.devnull),'a') as out:out.write('source_commit='+c['sourceCommit']+'\nsource_run='+str(c['sourceRun'])+'\n')
        return
    if args.command=='prepare':return prepare(c)
    state=unchanged_state(c);source=source_provider(c);deployment=lease(c,deployed=args.command!='before',allow_pending=args.command=='before')
    if args.command=='before':
        old=baseline(c);canaries=[r for r in old if r['path'] in ('index.html','build-info.json','campaign-v62/build-info.json')]
        check(len(canaries)==3,'Baseline identity canaries missing');result=verify_http(canaries)
        recovered_http=None
        if recovery_config(c):
            recovered_http=verify_http(state['recovery']['unionFiles'])
            check(recovered_http==http_summary(state['unionFiles']),'Complete prior union changed before recovery deployment')
        else:
            for target in (PREFIX,PREFIX+'index.html',PREFIX+'build-info.json'):get(BASE+target,absent=True)
        packages=[a for a in pages('actions/runs/'+os.environ['GITHUB_RUN_ID']+'/artifacts') if a['name']=='github-pages']
        check(len(packages)==1 and not packages[0]['expired'] and packages[0]['digest'].startswith('sha256:'),'Actual Pages artifact missing')
        before={'publicationAccepted':False,'baseline':result,'deployment':deployment,'pagesArtifact':packages[0]}
        if recovered_http is not None:before['recoveryHTTP']=recovered_http
        write('proof/before-deploy.json',before)
    elif args.command=='public':
        result=verify_http(state['unionFiles']);check(sha(get(URL+'build-info.json'))==state['originalBuildInfoSha256'],'Public build stamp rewritten')
        write('proof/public-http.json',{'pass':True,'publicationAccepted':False,'union':result,'deployment':deployment,'producer':producer()})
    else:
        jobs=pages('actions/runs/'+os.environ['GITHUB_RUN_ID']+'/attempts/'+os.environ['GITHUB_RUN_ATTEMPT']+'/jobs')
        prior=[j for j in jobs if j['name']!='verify'];expected=['prepare','deploy','public-http','player']+['native ('+g+')' for g in GROUPS]
        check(sorted(j['name'] for j in prior)==sorted(expected) and all(j['status']=='completed' and j['conclusion']=='success' for j in prior),'Actual PUBLIC producer missing or failed')
        http=load('proof/public-http.json');check(http['pass'] is True and http['producer']==producer(),'PUBLIC HTTP proof failed')
        check(http['union']=={'files':len(state['unionFiles']),'bytes':sum(r['bytes'] for r in state['unionFiles']),'inventorySha256':sha(encoded(state['unionFiles'])),'method':'complete HTTP GET, exact length and SHA-256 for every file'},'PUBLIC union differs')
        player=validate_public_player(c,state);routes=validate_public_routes(c,state)
        source_provider(c);deployment=lease(c,deployed=True,retain_provider='proof/deployment-provider')
        result={'technicalChecksPassed':True,'publicationAccepted':False,'requiresIndependentRootAcceptance':True,
              'producer':producer(),'sourceCommit':c['sourceCommit'],'sourceTree':c['sourceTree'],'sourceReview':{'runId':c['sourceRun'],'runAttempt':c['sourceAttempt']},
              'sourceJobs':source['jobs'],'publicJobs':prior,'sourceArtifacts':c['sourceArtifacts'],'deployment':deployment,
              'originalBuildInfoSha256':state['originalBuildInfoSha256'],'originalDistInventorySha256':sha(encoded(state['candidateFiles'])),
              'unionInventorySha256':sha(encoded(state['unionFiles'])),'publicRooms':list(range(1,52)),'player':player,'routeGroups':routes,
              'nativeRouteScope':{'normalUiZeroStepStartProven':False,'resetCounterScope':LEGACY_ROUTE_RESET_COUNTER_SCOPE},
              'historicalFilesPreserved':BASELINE[0],'historicalBytesPreserved':BASELINE[1],
              'limitations':['Automated ordinary inputs and software WebGL; no human/device/live-Yandex acceptance.',
               'Legacy51 initial fixture reset is outside the reported route counters; strict zero-step native start is not claimed for that cohort.',
               'Historical media were fetched and hashed; this does not establish new recording or complete decode of those histories.',
               'Original checker results apply to a separately bound test SDK package, not real advertising fill or moderation.',
               'Final publisher job and complete provider artifacts require independent terminal review.']}
        if recovery_config(c):
            result['recovery']=state['recovery'];result['recoveryHTTP']=state['recoveryHTTP']
        write('proof/final-publication.json',result)

if __name__=='__main__':main()
