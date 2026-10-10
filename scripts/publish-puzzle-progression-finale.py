"""Append an exact-review opt-in progression without changing accepted Pages bytes."""
import argparse
import concurrent.futures
import hashlib
import html
import json
import math
import pathlib
import re
import shutil
import stat
import tarfile
import time
import urllib.parse
import urllib.request
import zipfile


BASELINE_RUN = 37923054511
BASELINE_PUBLISHER = '0a22c3b1a1456cccccca3759c336ed8a22fad857'
BASELINE_SOURCE = '8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e'
PRIOR_PILOT_SOURCE = '415b2da2cfe162fa9bf8f55803977ba2b5dd9bb6'
PRIOR_PILOT_PUBLISHER = '3b80abcfa59c6cc73b28392e6f997d32df35a51c'
PRIOR_PROGRESSION_SOURCE = '3aa725337737979ebd1fa6a4bb18b49d809e27fd'
PRIOR_PROGRESSION_REVIEW = {'runId': 37886420411, 'runAttempt': 1}
PRIOR_PROGRESSION_PUBLISHER = 'edb11aecfeb634b62addba95e2898cfca0799a79'
PRIOR_PROGRESSION_PUBLICATION_RUN = 37889948751
PRIOR_NEXT_SOURCE = 'b4ca1630ec41f4a93877233ac35b7e9c7e04a19f'
PRIOR_NEXT_REVIEW = {'runId': 37918564404, 'runAttempt': 1}
PRIOR_NEXT_PUBLISHER = '0a22c3b1a1456cccccca3759c336ed8a22fad857'
PRIOR_NEXT_PUBLICATION_RUN = 37923054511
PLAYABLE_LEVELS = [43, 44, 45, 46, 47, 48, 49, 50, 51]
BASELINE_FILES = 1507
BASELINE_BYTES = 518160875
BASELINE_ZIP_BYTES = 484450139
BASELINE_ZIP_SHA256 = 'f292d80d624421c6a0a7c59fd2125f970a1ba69555ab22d3360c50df353a414c'
LEVELS = [50, 51]
PREFIX = 'puzzle-progression-finale/'
VERSION = 'v54-puzzle-progression-finale-v1'
REVISION = 'puzzle-progression-finale-v1'
QUERY = '?edition=foundation&level=50&pilot=progression'
STORAGE_PREFIX = 'brainrot-puzzle-progression-finale-v1:'
MAX_BASELINE_BYTES = 2 * 1024 ** 3
MAX_CANDIDATE_BYTES = 100 * 1024 ** 2
MAX_SAFE_INTEGER = 2 ** 53 - 1


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_name(name):
    require(isinstance(name, str), 'A path must be text')
    while name.startswith('./'):
        name = name[2:]
    require(bool(name) and not name.startswith('/') and '\\' not in name,
            'Unsafe path: ' + repr(name))
    require(not any(ord(c) < 32 or ord(c) == 127 for c in name), 'Control character in path')
    require(all(part not in ('', '.', '..') for part in name.split('/')), 'Unsafe path: ' + name)
    require(not re.match(r'^[A-Za-z]:', name), 'Drive-qualified path: ' + name)
    return name


def integer(value, label, minimum=0):
    require(type(value) is int and minimum <= value <= MAX_SAFE_INTEGER,
            label + ' must be a finite safe integer')
    return value


def argument_integer(value, label):
    require(isinstance(value, str) and re.fullmatch(r'[1-9][0-9]*', value), label + ' must be positive')
    return integer(int(value), label, 1)


def commit(value, label):
    require(isinstance(value, str) and re.fullmatch(r'[0-9a-f]{40}', value), label + ' must be an exact commit')
    return value


def identity(args):
    return {'sourceCommit': commit(args.source, 'Source'),
            'publisherCommit': commit(args.publisher, 'Publisher'),
            'publicationRun': argument_integer(args.run, 'Publication run'),
            'sourceReview': {'runId': argument_integer(args.review_run, 'Review run'),
                             'runAttempt': argument_integer(args.review_attempt, 'Review attempt')}}


def baseline_arguments(args):
    require(argument_integer(args.baseline_run, 'Baseline run') == BASELINE_RUN, 'Baseline publication run mismatch')
    require(args.baseline_publisher == BASELINE_PUBLISHER, 'Baseline publisher mismatch')
    require(args.baseline_source == BASELINE_SOURCE, 'Baseline source mismatch')


def sha256_file(filename):
    digest = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            digest.update(chunk)
    return digest.hexdigest()


def inventory(root):
    require(root.is_dir() and not root.is_symlink(), 'Inventory root must be an ordinary directory')
    rows = []
    for filename in sorted(root.rglob('*')):
        mode = filename.lstat().st_mode
        require(stat.S_ISREG(mode) or stat.S_ISDIR(mode), 'Unexpected non-regular path: ' + str(filename))
        if stat.S_ISREG(mode):
            rows.append({'path': safe_name(filename.relative_to(root).as_posix()),
                         'bytes': integer(filename.stat().st_size, 'File size'), 'sha256': sha256_file(filename)})
    return sorted(rows, key=lambda row: row['path'])


def write_json(filename, value):
    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def read_json(filename):
    def invalid(value):
        raise ValueError('Non-finite JSON number: ' + value)
    def object_pairs(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON key: ' + key)
            result[key] = value
        return result
    with filename.open(encoding='utf-8') as stream:
        return json.load(stream, parse_constant=invalid, object_pairs_hook=object_pairs)


def prepare_baseline(args):
    archive_file, output = pathlib.Path(args.zip), pathlib.Path(args.output)
    require(archive_file.is_file() and not archive_file.is_symlink(), 'Accepted ZIP must be an ordinary file')
    require(archive_file.stat().st_size == BASELINE_ZIP_BYTES, 'Accepted baseline ZIP size mismatch')
    require(sha256_file(archive_file) == BASELINE_ZIP_SHA256, 'Accepted baseline ZIP hash mismatch')
    require(not output.exists(), 'Refuse to overwrite an existing baseline directory')
    with zipfile.ZipFile(archive_file) as archive:
        entries, types, total = [], {}, 0
        for entry in archive.infolist():
            require(entry.orig_filename == entry.filename, 'Noncanonical ZIP member name')
            name = safe_name(entry.filename.rstrip('/') if entry.is_dir() else entry.filename)
            require(name not in types, 'Duplicate ZIP entry: ' + name)
            mode = entry.external_attr >> 16
            kind = stat.S_IFMT(mode)
            require(kind in (0, stat.S_IFDIR if entry.is_dir() else stat.S_IFREG),
                    'Non-regular ZIP entry: ' + name)
            integer(entry.file_size, 'ZIP member size')
            integer(entry.compress_size, 'ZIP compressed member size')
            require(entry.file_size <= MAX_BASELINE_BYTES, 'Oversized ZIP member: ' + name)
            require(not entry.is_dir() or entry.file_size == 0, 'A ZIP directory has file bytes')
            require(not entry.flag_bits & 1, 'Encrypted baseline ZIP is unsupported')
            types[name] = 'directory' if entry.is_dir() else 'file'
            entries.append((entry, name))
            total += entry.file_size
            require(total <= MAX_BASELINE_BYTES, 'Oversized baseline ZIP')
        for name in types:
            parts = name.split('/')
            require(all(types.get('/'.join(parts[:index])) != 'file' for index in range(1, len(parts))),
                    'ZIP directory/file collision: ' + name)
        files = [(entry, name) for entry, name in entries if not entry.is_dir()]
        require(len(files) == 1 and files[0][1].endswith('.tar'), 'Accepted ZIP must contain exactly one regular TAR')
        output.mkdir(parents=True)
        entry, name = files[0]
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        written = 0
        with archive.open(entry) as source, destination.open('xb') as target:
            for chunk in iter(lambda: source.read(1048576), b''):
                written += len(chunk)
                require(written <= entry.file_size, 'ZIP member exceeds its declared size')
                target.write(chunk)
        require(written == entry.file_size, 'Truncated ZIP member')
    print(json.dumps({'pass': True, 'baselinePublicationRun': BASELINE_RUN,
                      'zipSha256': BASELINE_ZIP_SHA256, 'zipBytes': BASELINE_ZIP_BYTES,
                      'tarPath': name, 'tarBytes': written, 'tarSha256': sha256_file(destination)}))


def prepare_package(args):
    """Check the retained candidate artifact digest before safe ZIP extraction."""
    archive_file, output = pathlib.Path(args.zip), pathlib.Path(args.output)
    require(isinstance(args.digest, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', args.digest),
            'An exact candidate artifact SHA-256 digest is required')
    require(archive_file.is_file() and not archive_file.is_symlink(), 'Candidate ZIP must be an ordinary file')
    require(sha256_file(archive_file) == args.digest.removeprefix('sha256:'), 'Candidate ZIP hash mismatch')
    if args.bytes is not None:
        require(archive_file.stat().st_size == argument_integer(args.bytes, 'Candidate ZIP bytes'),
                'Candidate ZIP size mismatch')
    require(not output.exists(), 'Refuse to overwrite an existing candidate directory')
    maximum = MAX_CANDIDATE_BYTES
    if getattr(args, 'max_uncompressed_bytes', None) is not None:
        maximum = argument_integer(args.max_uncompressed_bytes, 'ZIP uncompressed byte limit')
        require(maximum <= MAX_BASELINE_BYTES, 'ZIP byte limit exceeds the absolute 2 GiB bound')
    with zipfile.ZipFile(archive_file) as archive:
        entries, types, total = [], {}, 0
        for entry in archive.infolist():
            require(entry.orig_filename == entry.filename, 'Noncanonical candidate ZIP member name')
            name = safe_name(entry.filename.rstrip('/') if entry.is_dir() else entry.filename)
            require(name not in types, 'Duplicate candidate ZIP entry: ' + name)
            mode = entry.external_attr >> 16
            require(stat.S_IFMT(mode) in (0, stat.S_IFDIR if entry.is_dir() else stat.S_IFREG),
                    'Non-regular candidate ZIP entry: ' + name)
            integer(entry.file_size, 'Candidate ZIP member size')
            integer(entry.compress_size, 'Candidate ZIP compressed member size')
            require(not entry.is_dir() or entry.file_size == 0, 'A candidate ZIP directory has file bytes')
            require(not entry.flag_bits & 1, 'Encrypted candidate ZIP is unsupported')
            types[name] = 'directory' if entry.is_dir() else 'file'
            entries.append((entry, name))
            total += entry.file_size
            require(total < maximum, 'Oversized candidate ZIP')
        require(any(kind == 'file' for kind in types.values()), 'Candidate ZIP has no files')
        for name in types:
            parts = name.split('/')
            require(all(types.get('/'.join(parts[:index])) != 'file' for index in range(1, len(parts))),
                    'Candidate ZIP directory/file collision: ' + name)
        output.mkdir(parents=True)
        for entry, name in entries:
            destination = output / name
            if entry.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            written = 0
            with archive.open(entry) as source, destination.open('xb') as target:
                for chunk in iter(lambda: source.read(1048576), b''):
                    written += len(chunk)
                    require(written <= entry.file_size, 'Candidate ZIP member exceeds its declared size')
                    target.write(chunk)
            require(written == entry.file_size, 'Truncated candidate ZIP member')
    print(json.dumps({'pass': True, 'zipSha256': args.digest.removeprefix('sha256:'),
                      'zipBytes': archive_file.stat().st_size, 'packageFiles': sum(kind == 'file' for kind in types.values()),
                      'packageBytes': total}))


def extract_baseline(archive_file, site):
    """Validate the complete TAR namespace before creating any extracted path."""
    require(not site.exists(), 'Refuse to mix an existing site with the accepted baseline')
    with tarfile.open(archive_file) as archive:
        entries, types, total, root_seen = [], {}, 0, False
        for entry in archive:
            if entry.name in ('.', './'):
                require(entry.isdir() and not root_seen, 'Invalid or duplicate TAR root')
                require(type(entry.size) is int and entry.size == 0, 'A TAR root directory has file bytes')
                root_seen = True
                continue
            require(entry.isfile() or entry.isdir(), 'Non-regular TAR entry: ' + entry.name)
            name = safe_name(entry.name.rstrip('/') if entry.isdir() else entry.name)
            require(name not in types, 'Duplicate TAR entry: ' + name)
            integer(entry.size, 'TAR file size')
            require(entry.size <= MAX_BASELINE_BYTES, 'Oversized TAR member: ' + name)
            require(not entry.isdir() or entry.size == 0, 'A TAR directory has file bytes: ' + name)
            types[name] = 'directory' if entry.isdir() else 'file'
            entries.append((entry, name))
            if entry.isfile():
                total += entry.size
                require(total <= MAX_BASELINE_BYTES, 'Oversized baseline archive')
        for name in types:
            parts = name.split('/')
            for index in range(1, len(parts)):
                parent = '/'.join(parts[:index])
                require(types.get(parent) != 'file', 'TAR directory/file collision: ' + parent)
        require(PREFIX.rstrip('/') not in types and not any(name.startswith(PREFIX) for name in types),
                'The isolated progression path already exists in the baseline')
        site.mkdir(parents=True)
        for entry, name in entries:
            destination = site / name
            if entry.isdir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            source = archive.extractfile(entry)
            require(source is not None, 'Missing TAR file data: ' + name)
            written = 0
            with source, destination.open('xb') as output:
                for chunk in iter(lambda: source.read(1048576), b''):
                    written += len(chunk)
                    require(written <= entry.size, 'TAR member exceeds its declared size: ' + name)
                    output.write(chunk)
            require(written == entry.size, 'Truncated TAR member: ' + name)


def check_baseline(rows, root=None):
    require(len(rows) == BASELINE_FILES, 'Accepted baseline file count mismatch')
    require(sum(row['bytes'] for row in rows) == BASELINE_BYTES, 'Accepted baseline byte count mismatch')
    if root is not None:
        metadata = read_json(root / 'build-info.json')
        require(metadata.get('commit') == BASELINE_SOURCE, 'Canonical baseline source mismatch')
        require(metadata.get('publisherCommit', 'missing') is None, 'Canonical baseline publisher metadata changed')
        pilot = read_json(root / 'puzzle-pilot/build-info.json')
        require(pilot.get('commit') == PRIOR_PILOT_SOURCE, 'Previously published pilot source mismatch')
        require(pilot.get('publisherCommit', 'missing') is None, 'Preserved pilot publisher metadata changed')
        pilot_status = read_json(root / 'puzzle-pilot/preview-status.json')
        require(pilot_status.get('sourceCommit') == PRIOR_PILOT_SOURCE and
                pilot_status.get('publisherCommit') == PRIOR_PILOT_PUBLISHER, 'Preserved pilot receipt mismatch')
        prior = read_json(root / 'puzzle-progression/build-info.json')
        prior_status = read_json(root / 'puzzle-progression/preview-status.json')
        check_prior_progression(prior, prior_status)
        check_prior_next(read_json(root / 'puzzle-progression-next/build-info.json'),
                         read_json(root / 'puzzle-progression-next/preview-status.json'))


def check_prior_progression(metadata, status):
    require(metadata.get('commit') == PRIOR_PROGRESSION_SOURCE and metadata.get('publisherCommit', 'missing') is None,
            'Preserved rooms 44–46 source metadata changed')
    check_review(metadata.get('sourceReview'), PRIOR_PROGRESSION_REVIEW, 'Preserved rooms 44–46 metadata')
    require(status.get('sourceCommit') == PRIOR_PROGRESSION_SOURCE and status.get('publisherCommit') == PRIOR_PROGRESSION_PUBLISHER
            and status.get('publicationRun') == PRIOR_PROGRESSION_PUBLICATION_RUN, 'Preserved rooms 44–46 receipt identity changed')
    check_review(status.get('sourceReview'), PRIOR_PROGRESSION_REVIEW, 'Preserved rooms 44–46 receipt')


def check_prior_next(metadata, status):
    require(metadata.get('commit') == PRIOR_NEXT_SOURCE and metadata.get('publisherCommit', 'missing') is None,
            'Preserved rooms 47–49 source metadata changed')
    check_review(metadata.get('sourceReview'), PRIOR_NEXT_REVIEW, 'Preserved rooms 47–49 metadata')
    require(status.get('sourceCommit') == PRIOR_NEXT_SOURCE and status.get('publisherCommit') == PRIOR_NEXT_PUBLISHER
            and status.get('publicationRun') == PRIOR_NEXT_PUBLICATION_RUN, 'Preserved rooms 47–49 receipt identity changed')
    check_review(status.get('sourceReview'), PRIOR_NEXT_REVIEW, 'Preserved rooms 47–49 receipt')


def check_mobile_touch(touch, level):
    label = 'Level ' + str(level) + ' native emulated touch'
    require(isinstance(touch, dict) and touch.get('pass') is True and touch.get('emulated') is True and
            touch.get('coarsePointer') is True and touch.get('viewport') == {'width': 390, 'height': 844},
            label + ' scope mismatch')
    movement = touch.get('movement')
    require(isinstance(movement, dict), label + ' movement missing')
    def vector(value, size):
        return (isinstance(value, list) and len(value) == size and
                all(type(item) in (int, float) and math.isfinite(item) for item in value))
    require(vector(movement.get('input'), 2) and movement['input'][0] > .3, label + ' real joystick input missing')
    require(vector(movement.get('before'), 3) and vector(movement.get('after'), 3), label + ' real player positions missing')
    distance = movement.get('distance')
    require(type(distance) in (int, float) and math.isfinite(distance) and distance > .1,
            label + ' joystick did not move the actual player')
    require(math.isclose(math.dist(movement['before'], movement['after']), distance, rel_tol=0, abs_tol=1e-8),
            label + ' distance does not match actual player positions')
    horizontal_distance = movement.get('horizontalDistance')
    require(type(horizontal_distance) in (int, float) and math.isfinite(horizontal_distance) and horizontal_distance > .1,
            label + ' joystick did not move the actual player horizontally')
    observed_horizontal = math.hypot(movement['after'][0] - movement['before'][0],
                                     movement['after'][2] - movement['before'][2])
    require(math.isclose(observed_horizontal, horizontal_distance, rel_tol=0, abs_tol=1e-8),
            label + ' horizontal distance does not match actual player XZ positions')
    require(movement.get('state') == 'playing', label + ' movement occurred outside play')
    require(type(touch.get('jumpStart')) in (int, float) and math.isfinite(touch['jumpStart']) and
            type(touch.get('jumpPeak')) in (int, float) and math.isfinite(touch['jumpPeak']) and
            touch['jumpPeak'] > touch['jumpStart'] + .2, label + ' real jump missing')
    require(all(touch.get(key) is True for key in ('sprintToggle', 'pauseResume', 'stickReleased')),
            label + ' native action did not pass')


def check_model_identity(browser, level):
    label = 'Level ' + str(level)
    route, model = browser.get('route', {}), browser.get('modelIdentity', {})
    require(model.get('pass') is True and route.get('sameCompanion') is True, label + ' original actor identity failed')
    integer(route.get('frames'), label + ' observed route frames', 1)
    require(model.get('observedFrames') == route['frames'] and type(model.get('observedFrames')) is int,
            label + ' model identity did not observe every route frame')
    integer(model.get('playerVertices'), label + ' original player vertices', 1)
    integer(model.get('bones'), label + ' original player skeleton', 1)
    integer(model.get('cargoBodyId'), label + ' original cargo body')
    require(all(isinstance(model.get(key), str) and model[key] for key in ('playerRootUuid', 'cargoUuid')),
            label + ' original model identifiers missing')
    initialization = model.get('initialization')
    require(isinstance(initialization, dict) and set(initialization) == {'resetRun', 'resetCargo', 'respawn'} and
            all(type(value) is int and value == 1 for value in initialization.values()),
            label + ' initialization must occur exactly once before the first route frame')
    require(type(model.get('routeResets')) is int and model['routeResets'] == 0 and
            type(model.get('routeRespawns')) is int and model['routeRespawns'] == 0,
            label + ' observed actor resets or respawns occurred during the route')


def check_review(value, expected, label):
    require(isinstance(value, dict) and set(value) == {'runId', 'runAttempt'}, label + ' needs an exact sourceReview')
    integer(value['runId'], label + ' run ID', 1)
    integer(value['runAttempt'], label + ' attempt', 1)
    require(value == expected, label + ' describes a stale review run or attempt')


def check_source_record(value, expected, label, level=None):
    require(isinstance(value, dict), label + ' must be an object')
    require(value.get('sourceCommit') == expected['sourceCommit'], label + ' describes stale source')
    check_review(value.get('sourceReview'), expected['sourceReview'], label)
    if level is not None:
        require(type(value.get('level')) is int and value['level'] == level, label + ' level mismatch')


def positive_number(value, label):
    require(type(value) in (int, float) and math.isfinite(value) and value > 0, label + ' must be finite and positive')


def check_candidate(candidate, expected):
    rows = inventory(candidate)
    metadata = read_json(candidate / 'build-info.json')
    require(metadata.get('commit') == expected['sourceCommit'], 'Progression source mismatch')
    require(metadata.get('publisherCommit', 'missing') is None, 'The tested source stamp must retain a null publisher')
    require(metadata.get('version') == VERSION, 'Progression version mismatch')
    check_review(metadata.get('sourceReview'), expected['sourceReview'], 'Candidate metadata')
    for key in ('gameCommit', 'interfaceCommit'):
        if key in metadata:
            require(metadata[key] == expected['sourceCommit'], 'Candidate ' + key + ' source mismatch')
    progression = metadata.get('features', {}).get('puzzleProgression', {})
    require(progression.get('optIn') is True and progression.get('levels') == LEVELS, 'Progression opt-in levels mismatch')
    require(progression.get('reviewedLevels') == LEVELS and progression.get('playableLevels') == PLAYABLE_LEVELS,
            'Fresh proof scope and playable room scope must be explicit')
    for key, value in [('revision', REVISION), ('query', QUERY), ('storagePrefix', STORAGE_PREFIX)]:
        require(progression.get(key) == value, 'Exact finale metadata ' + key + ' mismatch')
    rooms = progression.get('rooms')
    require(isinstance(rooms, list) and len(rooms) == len(LEVELS), 'Exactly two finale rooms are required')
    require([room.get('level') for room in rooms] == LEVELS, 'Progression room ordering mismatch')
    require(all(isinstance(room.get('id'), str) and room['id'] and isinstance(room.get('title'), str)
                and room['title'].strip() for room in rooms), 'Room ID and title are required')
    require(len({room['id'] for room in rooms}) == len(LEVELS), 'Room IDs must be distinct')
    reviewed_packages = []
    for room in rooms:
        level = room['level']
        label = 'Level ' + str(level)
        walkthrough = room.get('currentWalkthrough')
        check_source_record(walkthrough, expected, label + ' walkthrough')
        require(walkthrough.get('continuous') is True, label + ' walkthrough must be continuous')
        for key, suffix in [('video', 'mp4'), ('report', 'json'), ('poster', 'jpg')]:
            require(walkthrough.get(key) == f'evidence/level-{level}.{suffix}', label + ' walkthrough path mismatch')
        recording = read_json(candidate / walkthrough['report'])
        check_source_record(recording, expected, label + ' recording', level)
        reviewed_packages.append(recording.get('nativePackage'))
        require(recording.get('continuous') is True, label + ' recording is not continuous')
        require(recording.get('firstFrame', {}).get('visualFrame') == 0, label + ' recording starts after gameplay')
        require(recording.get('lastFrame', {}).get('state') == 'won', label + ' recording must reach victory')
        route = recording.get('route', {})
        require(route.get('pass') is True, label + ' route failed')
        require(route.get('level') == level, label + ' route level mismatch')
        for key in ('resets', 'respawns'):
            require(type(route.get(key)) is int and route[key] == 0, label + ' recording includes ' + key)
        integer(route.get('teleports'), label + ' ordinary portal traversals')
        require(recording.get('pixelCheck', {}).get('allNonblank') is True, label + ' recording includes blank frames')
        require(isinstance(recording.get('milestones'), list) and len(recording['milestones']) >= 3,
                label + ' recording lacks journey milestones')
        require(recording.get('decode', {}).get('pass') is True, label + ' final movie decode did not pass')
        require(recording.get('fps') == 4 and recording.get('width') == 640 and recording.get('height') == 360,
                label + ' recording capture settings mismatch')
        positive_number(recording.get('durationSeconds'), label + ' duration')
        integer(recording.get('frameCount'), label + ' frame count', 21)
        require(math.isclose(recording['frameCount'] / recording['fps'], recording['durationSeconds'], abs_tol=1e-9),
                label + ' recording duration/frame count mismatch')
        movie = candidate / walkthrough['video']
        require(recording.get('sha256') == walkthrough.get('sha256') == sha256_file(movie), label + ' movie hash mismatch')
        require(type(recording.get('bytes')) is int and recording['bytes'] > 0 and recording['bytes'] == movie.stat().st_size,
                label + ' movie size mismatch')
        require(isinstance(recording.get('method'), str) and recording['method'], label + ' capture method is required')
        for key in ('durationSeconds', 'fps', 'method'):
            require(walkthrough.get(key) == recording[key], label + ' walkthrough/report ' + key + ' mismatch')
        for image in (f'evidence/level-{level}.jpg', f'evidence/level-{level}-finish.jpg'):
            require((candidate / image).is_file() and (candidate / image).stat().st_size > 0, label + ' poster missing')
        browser = read_json(candidate / f'evidence/browser-report-{level}.json')
        check_source_record(browser, expected, label + ' browser report', level)
        require(browser.get('pass') is True, label + ' native browser review failed')
        browser_route = browser.get('route', {})
        require(browser_route.get('pass') is True and browser_route.get('level') == level,
                label + ' native route failed or used the wrong room')
        for key in ('resets', 'respawns'):
            require(type(browser_route.get(key)) is int and browser_route[key] == 0,
                    label + ' native route includes ' + key)
        integer(browser_route.get('teleports'), label + ' native ordinary portal traversals')
        require(browser_route['teleports'] == route['teleports'], label + ' native/movie portal journey differs')
        check_model_identity(browser, level)
        check_mobile_touch(browser.get('mobileTouchInput'), level)
        for key in ('originalProgressUnchanged', 'previousPilotProgressUnchanged', 'previousProgressionUnchanged', 'previousProgressionNextUnchanged', 'pauseResumePassed', 'replayPassed', 'mobileControls', 'nextRoomPassed'):
            require(browser.get(key) is True, label + ' native ' + key + ' failed')
        require(isinstance(browser.get('pixels'), list) and len(browser['pixels']) >= 3,
                label + ' native pixel review is incomplete')
        reviewed_packages.append(browser.get('nativePackage'))
    receipt = read_json(candidate / 'evidence/review-receipt.json')
    check_source_record(receipt, expected, 'Review receipt')
    require(receipt.get('pass') is True and receipt.get('requiredLevels') == LEVELS, 'Review receipt scope mismatch')
    base_package = receipt.get('basePackage')
    check_source_record(base_package, expected, 'Tested base package')
    require(base_package.get('pass') is True, 'The tested base package did not pass')
    base_files = base_package.get('files')
    checked_rows(base_files, 'Tested base package files')
    actual_base = [row for row in rows if not row['path'].startswith('evidence/')
                   and row['path'] not in ('build-info.json', 'release-manifest.json')]
    require(base_files == actual_base, 'Final game files differ from the single tested base package')
    base_digest = hashlib.sha256(json.dumps(base_files, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    require(base_package.get('filesSha256') == base_digest, 'Tested base package file digest differs')
    require(progression.get('testedGamePackageSha256') == base_digest, 'Metadata tested game package digest differs')
    require(all(reviewed == base_package for reviewed in reviewed_packages),
            'Native rooms and movies did not review the same single base package')
    cpu = receipt.get('cpu', {})
    check_source_record(cpu, expected, 'CPU review')
    require(cpu.get('pass') is True, 'CPU review did not pass')
    integer(cpu.get('testCount'), 'CPU review test count', 1605)
    require(cpu.get('passed') == cpu['testCount'] and type(cpu.get('failed')) is int and cpu['failed'] == 0
            and cpu.get('allActiveGameTests') is True, 'CPU review did not run and pass every active test')
    for field in ('cancelled', 'skipped', 'todo'):
        require(type(cpu.get(field)) is int and cpu[field] == 0, 'CPU review includes or omitted ' + field)
    require(isinstance(cpu.get('logSha256'), str) and re.fullmatch('[0-9a-f]{64}', cpu['logSha256']),
            'CPU review log hash is required')
    for kind in ('native', 'recordings'):
        proofs = receipt.get(kind)
        require(isinstance(proofs, list) and len(proofs) == len(LEVELS), 'Review receipt needs both ' + kind + ' proofs')
        require([proof.get('level') for proof in proofs] == LEVELS, 'Review receipt ' + kind + ' levels mismatch')
        for proof, room in zip(proofs, rooms):
            check_source_record(proof, expected, 'Receipt ' + kind, room['level'])
            require(proof.get('pass') is True, 'Review receipt contains failed ' + kind + ' proof')
            if kind == 'native':
                require(proof.get('report') == f'evidence/browser-report-{room["level"]}.json',
                        'Receipt native report path mismatch')
            if kind == 'recordings':
                require(proof.get('sha256') == room['currentWalkthrough']['sha256'], 'Receipt recording hash mismatch')
                recording = read_json(candidate / room['currentWalkthrough']['report'])
                require(proof.get('decode') == recording['decode'] and proof['decode'].get('pass') is True,
                        'Receipt final movie decode proof mismatch')
    require(sum(row['bytes'] for row in rows) < MAX_CANDIDATE_BYTES, 'Progression exceeds 100 MiB')
    require({row['path'] for row in rows if row['path'].lower().endswith('.mp4')} ==
            {f'evidence/level-{level}.mp4' for level in LEVELS}, 'Every progression movie must be reviewed')
    require(not any(row['path'] in ('preview-status.json', 'walkthroughs.html') for row in rows),
            'Generated publication pages must not overwrite tested candidate files')
    declared = metadata.get('files')
    checked_rows(declared, 'Stamped candidate files')
    actual = [row for row in rows if row['path'] not in ('build-info.json', 'release-manifest.json')]
    require(declared == actual, 'Candidate files differ from the exact stamped package inventory')
    inventory_digest = hashlib.sha256(json.dumps(declared, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    require(metadata.get('packageFilesSha256') == inventory_digest, 'Candidate package inventory digest differs')
    return metadata, rooms, rows


def status_record(expected, rooms):
    return {'schemaVersion': 1, **expected, 'baselinePublicationRun': BASELINE_RUN,
            'baselinePublisherCommit': BASELINE_PUBLISHER, 'baselineSourceCommit': BASELINE_SOURCE,
            'priorPilotSourceCommit': PRIOR_PILOT_SOURCE, 'priorProgressionSourceCommit': PRIOR_PROGRESSION_SOURCE,
            'priorProgressionSourceReview': PRIOR_PROGRESSION_REVIEW,
            'priorNextSourceCommit': PRIOR_NEXT_SOURCE, 'priorNextSourceReview': PRIOR_NEXT_REVIEW,
            'path': PREFIX, 'levels': LEVELS,
            'reviewedLevels': LEVELS, 'playableLevels': PLAYABLE_LEVELS, 'optIn': True,
            'query': QUERY, 'mainSiteUnchanged': True,
            'masterSpecComplete': False, 'currentVisualWalkthroughs': True,
            'rooms': [{key: room[key] for key in ('level', 'id', 'title', 'currentWalkthrough')} for room in rooms]}


def walkthrough_page(rooms):
    parts = ['<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
             '<title>Прогрессия: записи прохождений</title><style>body{background:#102632;color:#eef8fc;font:18px/1.7 system-ui;max-width:760px;margin:8vh auto;padding:24px}a{color:#70e4ed}video{width:100%;background:#000}</style>',
             '<h1>Пространственные испытания 50–51</h1><p>Полные непрерывные прохождения этой версии. Записи выполнены программным WebGL с частотой 4 кадра/с; они не показывают FPS на устройстве игрока.</p>']
    for room in rooms:
        level = room['level']
        parts.append('<h2>' + str(level) + ' · ' + html.escape(room['title']) + '</h2>')
        parts.append(f'<video controls preload="metadata" poster="evidence/level-{level}.jpg"><source src="evidence/level-{level}.mp4" type="video/mp4"></video>')
        parts.append(f'<p><a href="evidence/level-{level}.json">Отчёт о записи и исходной версии</a> · <a href="./?edition=foundation&amp;level={level}&amp;pilot=progression">Играть в комнату {level}</a></p>')
    parts.append('<p><a href="../puzzle-progression-next/walkthroughs.html">Сохранённая серия 47–49</a> · <a href="../puzzle-progression/walkthroughs.html">Сохранённая серия 44–46</a> · <a href="../puzzle-pilot/walkthroughs.html">Сохранённый пилот комнаты 43</a> · <a href="../walkthroughs.html">Архив прохождений основной игры</a></p></html>')
    return ''.join(parts)


def assemble(args):
    expected = identity(args)
    baseline_arguments(args)
    archive_dir, candidate, site, proof = map(pathlib.Path, [args.baseline, args.candidate, args.site, args.proof])
    require(not proof.is_symlink() and (not proof.exists() or proof.is_dir()), 'Publication proof must be an ordinary directory')
    require(all(not (proof / name).exists() and not (proof / name).is_symlink()
                for name in ('manifest.json', 'baseline-manifest.json')), 'Refuse to overwrite an existing publication manifest')
    candidate_path, site_path, proof_path = candidate.resolve(), site.resolve(), proof.resolve()
    require(not (site_path == candidate_path or site_path.is_relative_to(candidate_path)
                 or candidate_path.is_relative_to(site_path)), 'Candidate and site directories must be disjoint')
    require(not (site_path == proof_path or site_path.is_relative_to(proof_path)
                 or proof_path.is_relative_to(site_path)), 'Public site and private proof directories must be disjoint')
    require(not (candidate_path == proof_path or candidate_path.is_relative_to(proof_path)
                 or proof_path.is_relative_to(candidate_path)), 'Tested candidate and private proof directories must be disjoint')
    # Validate candidate links, identities and evidence before creating the site.
    inventory(candidate)
    _, rooms, candidate_rows = check_candidate(candidate, expected)
    archives = list(archive_dir.rglob('*.tar'))
    require(len(archives) == 1 and not archives[0].is_symlink(), 'Exactly one accepted Pages TAR is required')
    extract_baseline(archives[0], site)
    before = inventory(site)
    check_baseline(before, site)
    require(not (site / PREFIX.rstrip('/')).exists(), 'Refuse to overwrite any baseline progression directory')
    shutil.copytree(candidate, site / PREFIX.rstrip('/'))
    status = status_record(expected, rooms)
    write_json(site / PREFIX / 'preview-status.json', status)
    (site / PREFIX / 'walkthroughs.html').write_text(walkthrough_page(rooms), encoding='utf-8')
    after = inventory(site)
    after_map = {row['path']: row for row in after}
    require(all(after_map.get(row['path']) == row for row in before), 'An existing public file changed')
    added = [row for row in after if row['path'].startswith(PREFIX)]
    require(len(after) == len(before) + len(added), 'A file outside the progression directory was added')
    require(all(after_map[PREFIX + row['path']] == {**row, 'path': PREFIX + row['path']} for row in candidate_rows),
            'A tested candidate file changed during assembly')
    manifest = {**status, 'phase': 'published', 'preservedFiles': before, 'candidateFiles': candidate_rows,
                'progressionFiles': added, 'siteFiles': after, 'preservedBytes': BASELINE_BYTES,
                'progressionBytes': sum(row['bytes'] for row in added)}
    write_json(proof / 'manifest.json', manifest)
    write_json(proof / 'baseline-manifest.json', {**manifest, 'phase': 'preflight', 'siteFiles': before})
    print(json.dumps({'mainSiteUnchanged': True, 'preservedFiles': len(before), 'preservedBytes': BASELINE_BYTES,
                      'progressionFiles': len(added), 'progressionBytes': manifest['progressionBytes'], **expected}))


def checked_rows(value, label):
    require(isinstance(value, list), label + ' must be a file inventory')
    seen = set()
    for row in value:
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, label + ' has an invalid file row')
        name = safe_name(row['path'])
        require(name == row['path'] and name not in seen, label + ' contains a duplicate/noncanonical path: ' + name)
        seen.add(name)
        integer(row['bytes'], label + ' file size')
        require(isinstance(row['sha256'], str) and re.fullmatch('[0-9a-f]{64}', row['sha256']), label + ' has an invalid hash')
    return {row['path']: row for row in value}


def check_manifest(manifest, args, expected):
    require(isinstance(manifest, dict), 'Manifest must be an object')
    require(manifest.get('phase') == args.phase, 'Proof phase mismatch')
    for key, value in expected.items():
        require(manifest.get(key) == value, 'Stale publication proof: ' + key)
    check_review(manifest.get('sourceReview'), expected['sourceReview'], 'Manifest')
    for key, value in [('schemaVersion', 1), ('baselinePublicationRun', BASELINE_RUN),
                       ('baselinePublisherCommit', BASELINE_PUBLISHER), ('baselineSourceCommit', BASELINE_SOURCE),
                       ('priorPilotSourceCommit', PRIOR_PILOT_SOURCE), ('priorProgressionSourceCommit', PRIOR_PROGRESSION_SOURCE),
                       ('priorProgressionSourceReview', PRIOR_PROGRESSION_REVIEW),
                       ('priorNextSourceCommit', PRIOR_NEXT_SOURCE), ('priorNextSourceReview', PRIOR_NEXT_REVIEW),
                       ('path', PREFIX), ('levels', LEVELS),
                       ('reviewedLevels', LEVELS), ('playableLevels', PLAYABLE_LEVELS), ('query', QUERY),
                       ('optIn', True), ('mainSiteUnchanged', True), ('masterSpecComplete', False),
                       ('currentVisualWalkthroughs', True)]:
        require(type(manifest.get(key)) is type(value) and manifest[key] == value,
                'Manifest identity/scope mismatch: ' + key)
    preserved = checked_rows(manifest.get('preservedFiles'), 'Preserved files')
    check_baseline(list(preserved.values()))
    require(manifest.get('preservedBytes') == BASELINE_BYTES, 'Manifest baseline bytes mismatch')
    progression = checked_rows(manifest.get('progressionFiles'), 'Progression files')
    require(progression and all(name.startswith(PREFIX) for name in progression), 'Progression inventory escaped its isolated directory')
    require(not (preserved.keys() & progression.keys()), 'Progression overwrites the accepted baseline')
    require(manifest.get('progressionBytes') == sum(row['bytes'] for row in progression.values()), 'Progression byte count mismatch')
    candidate = checked_rows(manifest.get('candidateFiles'), 'Tested candidate files')
    require(candidate and all(progression.get(PREFIX + name) == {**row, 'path': PREFIX + name}
                              for name, row in candidate.items()), 'Candidate proof differs from assembled bytes')
    require(set(progression) - {PREFIX + name for name in candidate} ==
            {PREFIX + 'preview-status.json', PREFIX + 'walkthroughs.html'}, 'Unexpected generated publication file')
    rooms = manifest.get('rooms')
    require(isinstance(rooms, list) and len(rooms) == len(LEVELS) and [room.get('level') for room in rooms] == LEVELS,
            'Manifest room identity mismatch')
    for room in rooms:
        check_source_record(room.get('currentWalkthrough'), expected, 'Manifest walkthrough')
    public = checked_rows(manifest.get('siteFiles'), 'Public files')
    require(public == (preserved if args.phase == 'preflight' else {**preserved, **progression}),
            'Public inventory does not match the expected phase')
    return list(public.values())


def get_public_json(base, path):
    url = base.rstrip('/') + '/' + urllib.parse.quote(path, safe='/') + '?progression-metadata-check=' + str(time.time_ns())
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'brainrot-progression-byte-check'})
    with urllib.request.urlopen(request, timeout=90) as response:
        require(response.status == 200, 'Public metadata HTTP ' + str(response.status))
        data = response.read(2 * 1024 ** 2 + 1)
        require(len(data) <= 2 * 1024 ** 2, 'Oversized public metadata')
    # Reuse strict JSON parsing for duplicate keys and non-finite numbers.
    import io
    def invalid(value):
        raise ValueError('Non-finite public JSON number: ' + value)
    def pairs(values):
        result = {}
        for key, value in values:
            require(key not in result, 'Duplicate public JSON key: ' + key)
            result[key] = value
        return result
    return json.load(io.BytesIO(data), parse_constant=invalid, object_pairs_hook=pairs)


def check_public_metadata(args, expected, manifest):
    canonical = get_public_json(args.base, 'build-info.json')
    require(canonical.get('commit') == BASELINE_SOURCE and canonical.get('publisherCommit', 'missing') is None,
            'Current canonical public metadata changed')
    pilot = get_public_json(args.base, 'puzzle-pilot/build-info.json')
    require(pilot.get('commit') == PRIOR_PILOT_SOURCE, 'Current preserved pilot metadata changed')
    require(pilot.get('publisherCommit', 'missing') is None, 'Current preserved pilot publisher metadata changed')
    pilot_status = get_public_json(args.base, 'puzzle-pilot/preview-status.json')
    require(pilot_status.get('sourceCommit') == PRIOR_PILOT_SOURCE and
            pilot_status.get('publisherCommit') == PRIOR_PILOT_PUBLISHER, 'Current preserved pilot receipt changed')
    check_prior_progression(get_public_json(args.base, 'puzzle-progression/build-info.json'),
                            get_public_json(args.base, 'puzzle-progression/preview-status.json'))
    check_prior_next(get_public_json(args.base, 'puzzle-progression-next/build-info.json'),
                     get_public_json(args.base, 'puzzle-progression-next/preview-status.json'))
    if args.phase == 'published':
        current = get_public_json(args.base, PREFIX + 'build-info.json')
        require(current.get('commit') == expected['sourceCommit'] and current.get('publisherCommit', 'missing') is None,
                'Current progression public source metadata mismatch')
        require(current.get('version') == VERSION, 'Current progression public version mismatch')
        check_review(current.get('sourceReview'), expected['sourceReview'], 'Current public metadata')
        require(current.get('features', {}).get('puzzleProgression', {}).get('optIn') is True,
                'Current progression is not opt-in')
        status = get_public_json(args.base, PREFIX + 'preview-status.json')
        require(status == {key: manifest[key] for key in status_record(expected, manifest['rooms'])},
                'Current progression public receipt differs from publication proof')
        progression = current.get('features', {}).get('puzzleProgression', {})
        require(progression.get('levels') == LEVELS and progression.get('reviewedLevels') == LEVELS and
                progression.get('playableLevels') == PLAYABLE_LEVELS, 'Current progression public levels mismatch')
        for key, value in [('revision', REVISION), ('query', QUERY), ('storagePrefix', STORAGE_PREFIX)]:
            require(progression.get(key) == value, 'Current finale metadata ' + key + ' mismatch')
        require([{key: room.get(key) for key in ('level', 'id', 'title', 'currentWalkthrough')}
                 for room in progression.get('rooms', [])] == manifest['rooms'], 'Current public walkthrough identity mismatch')
        for level in LEVELS:
            recording = get_public_json(args.base, PREFIX + f'evidence/level-{level}.json')
            check_source_record(recording, expected, 'Current public recording', level)
            require(recording.get('sha256') == manifest['rooms'][LEVELS.index(level)]['currentWalkthrough']['sha256'],
                    'Current public recording hash identity mismatch')


def verify(args):
    expected = identity(args)
    report = {'pass': False, **expected, 'phase': args.phase, 'checked': 0,
              'mainSiteUnchanged': False, 'siteUrl': args.base,
              'scope': 'Every public byte in the exact source publication inventory for the expected phase'}
    try:
        require(urllib.parse.urlparse(args.base).scheme in ('https', 'http'), 'Verification needs an HTTP(S) site URL')
        manifest = read_json(pathlib.Path(args.manifest))
        rows = check_manifest(manifest, args, expected)
        check_public_metadata(args, expected, manifest)
        def one(row):
            for attempt in range(4):
                try:
                    url = args.base.rstrip('/') + '/' + urllib.parse.quote(row['path'], safe='/') + '?progression-byte-check=' + str(time.time_ns())
                    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'brainrot-progression-byte-check'})
                    digest, length = hashlib.sha256(), 0
                    with urllib.request.urlopen(request, timeout=90) as response:
                        require(response.status == 200, 'Public file HTTP ' + str(response.status) + ': ' + row['path'])
                        for chunk in iter(lambda: response.read(1048576), b''):
                            length += len(chunk)
                            require(length <= row['bytes'], 'Unexpected public bytes: ' + row['path'])
                            digest.update(chunk)
                    require(length == row['bytes'], 'Public size changed: ' + row['path'])
                    require(digest.hexdigest() == row['sha256'], 'Public hash changed: ' + row['path'])
                    return length
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(2 ** attempt)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            lengths = list(executor.map(one, rows))
        # Bind the final receipt again after all files, including current metadata, were checked.
        check_public_metadata(args, expected, manifest)
        report.update({'pass': True, 'checked': len(lengths), 'bytes': sum(lengths), 'mainSiteUnchanged': True})
        print(json.dumps(report))
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        write_json(pathlib.Path(args.output), report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    preparation = sub.add_parser('prepare-baseline')
    preparation.add_argument('--zip', required=True)
    preparation.add_argument('--output', required=True)
    package = sub.add_parser('prepare-package')
    package.add_argument('--zip', required=True)
    package.add_argument('--output', required=True)
    package.add_argument('--digest', required=True)
    package.add_argument('--bytes')
    package.add_argument('--max-uncompressed-bytes')
    assembly = sub.add_parser('assemble')
    for flag in ['baseline', 'candidate', 'site', 'proof', 'source', 'publisher', 'baseline-source',
                 'baseline-publisher', 'run', 'baseline-run', 'review-run', 'review-attempt']:
        assembly.add_argument('--' + flag, required=True)
    verification = sub.add_parser('verify')
    for flag in ['base', 'manifest', 'output', 'source', 'publisher', 'run', 'review-run', 'review-attempt']:
        verification.add_argument('--' + flag, required=True)
    verification.add_argument('--phase', required=True, choices=['preflight', 'published'])
    args = parser.parse_args()
    {'prepare-baseline': prepare_baseline, 'prepare-package': prepare_package,
     'assemble': assemble, 'verify': verify}[args.command](args)


if __name__ == '__main__':
    main()
