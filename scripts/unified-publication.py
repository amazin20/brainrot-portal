#!/usr/bin/env python3
"""Deliver one accepted package; preserve the existing public evidence verbatim."""
import argparse
import concurrent.futures
import hashlib
import html
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
import zipfile

CONFIG = Path('docs/accepted-unified-review.json')
TARGET = Path('docs/unified-publication-target.json')
BASELINE = Path('proof/baseline-accepted.json')
PUBLIC = 'https://amazin20.github.io/brainrot-portal/'


def recording_stem(record, source):
    assert re.fullmatch('[a-f0-9]{40}', source)
    assert re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*', record['id'])
    return 'v54-' + source[:7] + '-level-' + record['id']


def historical_prefix(target, source):
    assert re.fullmatch('[a-f0-9]{40}', source)
    template = target['baseline']['archivePrefixTemplate']
    assert template.count('{sourceShort}') == 1
    return safe(template.replace('{sourceShort}', source[:7]))


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(data)
    return digest.hexdigest()


def safe(name):
    assert isinstance(name, str) and name and not name.startswith('/') and '\\' not in name, name
    assert all(p not in ('', '.', '..') for p in name.split('/')), name
    return name


def inventory(root):
    root = Path(root)
    rows = []
    for path in root.rglob('*'):
        assert not path.is_symlink(), path
        if path.is_file():
            rows.append({'path': safe(path.relative_to(root).as_posix()), 'bytes': path.stat().st_size, 'sha256': sha(path)})
    return sorted(rows, key=lambda row: row['path'])


def extract(archive, target, limit=500_000_000):
    target = Path(target)
    assert not target.exists(), ('Refusing existing extraction destination', str(target))
    seen = set()
    total = 0
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            if entry.is_dir():
                continue
            name = safe(entry.filename)
            assert name not in seen, name
            seen.add(name)
            assert (entry.external_attr >> 16) & 0o170000 in (0, 0o100000), name
            total += entry.file_size
            assert total <= limit, ('Oversized archive', total)
            path = target / name
            path.parent.mkdir(parents=True, exist_ok=True)
            with source.open(entry) as stream, path.open('wb') as output:
                shutil.copyfileobj(stream, output)
    assert seen, 'Empty archive'


def fetch_inventory(rows, base, destination=None):
    names = set()
    for row in rows:
        name = safe(row['path'])
        assert name not in names, name
        names.add(name)
        assert isinstance(row['bytes'], int) and row['bytes'] >= 0
        assert re.fullmatch('[a-f0-9]{64}', row['sha256'])

    def one(row):
        name = row['path']
        output = Path(destination) / name if destination else None
        for attempt in range(4):
            temp = None
            try:
                url = base.rstrip('/') + '/' + urllib.parse.quote(name, safe='/') + '?v54-check=' + str(time.time_ns())
                request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'brainrot-v54-byte-verification'})
                if output:
                    output.parent.mkdir(parents=True, exist_ok=True)
                    temp = output.with_name(output.name + '.download')
                digest = hashlib.sha256()
                size = 0
                with urllib.request.urlopen(request, timeout=90) as response:
                    assert response.status == 200, (name, response.status)
                    stream = temp.open('wb') if temp else None
                    try:
                        for data in iter(lambda: response.read(1024 * 1024), b''):
                            size += len(data)
                            assert size <= row['bytes'], ('Unexpected extra bytes', name)
                            digest.update(data)
                            if stream:
                                stream.write(data)
                    finally:
                        if stream:
                            stream.close()
                assert size == row['bytes'] and digest.hexdigest() == row['sha256'], ('Public bytes changed', name)
                if output:
                    temp.replace(output)
                return size
            except Exception:
                if temp:
                    temp.unlink(missing_ok=True)
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        sizes = list(executor.map(one, rows))
    return {'pass': True, 'checked': len(rows), 'bytes': sum(sizes), 'streams': 6}


def adopt_baseline(args):
    target = read(TARGET)['baseline']
    pin = target['proofArtifact']
    proof, inputs = Path(args.proof), Path(args.inputs)
    gate = read(proof / 'baseline-artifact.json')
    assert gate['publicationRun'] == target['publicationRun']
    assert gate['publisherCommit'] == target['publisherCommit']
    assert gate['publicationConclusion'] == 'success' and gate['runAttempt'] == 1
    assert gate['artifact'] == pin
    archive = inputs / 'zips/baseline-publication.zip'
    assert archive.stat().st_size == pin['sizeBytes']
    assert 'sha256:' + sha(archive) == pin['digest']
    expanded = inputs / 'baseline-publication'
    extract(archive, expanded)
    manifest_path = unique(expanded, 'manifest.json')
    manifest = read(manifest_path)
    assert manifest['gameCommit'] == manifest['interfaceCommit'] == target['sourceCommit']
    assert manifest['publisherCommit'] == target['publisherCommit']
    assert manifest['publicationRun'] == target['publicationRun']
    assert manifest['reviewConclusion'] == 'success'
    assert len(manifest['siteFiles']) == target['expectedSiteFiles']
    assert sha(manifest_path) == target['manifestSha256']
    # This conclusion comes from the checked successful publication API run,
    # not from the earlier assemble-stage receipt contained in the artifact.
    accepted = {**manifest, 'publicationConclusion': gate['publicationConclusion'],
                'baselineArtifact': pin, 'baselineManifestSha256': sha(manifest_path)}
    write(BASELINE, accepted)
    print(json.dumps({'pass': True, 'sourceCommit': target['sourceCommit'],
                      'siteFiles': len(manifest['siteFiles']), 'manifestSha256': sha(manifest_path)}))


def unique(root, basename):
    found = list(Path(root).rglob(basename))
    assert len(found) == 1, (str(root), basename, len(found))
    return found[0]


def verify_recording(root, source, level, fps, alternative, proof):
    candidates = []
    for path in Path(root).rglob('*.json'):
        value = read(path)
        if isinstance(value, dict) and 'frameCount' in value and 'video' in value:
            candidates.append((path, value))
    assert len(candidates) == 1, ('Recording evidence count', len(candidates))
    path, data = candidates[0]
    assert data['sourceCommit'] == source and data['level'] == level and data['fps'] == fps
    assert data.get('alternative', '') == alternative and data['continuous'] is True
    route = data['route']
    assert route['pass'] is True and route['resets'] == route['respawns'] == 0
    assert data['firstFrame']['visualFrame'] == 0 and data['lastFrame']['state'] == 'won'
    assert data['firstFrame']['cargoBodyId'] == data['lastFrame']['cargoBodyId']
    frames = data['frameCount']
    assert frames > fps * 5 and data['lastFrame']['visualFrame'] == (frames - 1) * (60 // fps)
    assert math.isclose(data['durationSeconds'], frames / fps, abs_tol=1e-8)
    pixels = data['pixelCheck']
    assert pixels['frames'] == frames and pixels['allNonblank'] is True and pixels['minimumLuminanceRange'] > 12
    movie = path.parent / safe(data['video'])
    assert movie.stat().st_size == data['bytes'] and sha(movie) == data['sha256']
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames,duration', '-show_entries', 'format=duration,size', '-of', 'json', str(movie)]))
    stream = probe['streams'][0]
    assert stream['codec_name'] == 'h264' and stream['width'] == data['width'] and stream['height'] == data['height']
    assert int(stream['nb_frames']) == frames and abs(float(probe['format']['duration']) - frames / fps) < .1
    numerator, denominator = map(int, stream['avg_frame_rate'].split('/'))
    assert numerator / denominator == fps
    signal_path = Path(proof) / ('encoded-' + root.name + '.txt')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(movie), '-vf', 'scale=160:90,signalstats,metadata=mode=print:file=' + str(signal_path), '-f', 'null', '-'], check=True, timeout=180)
    text = signal_path.read_text()
    minima = list(map(int, re.findall(r'lavfi\.signalstats\.YMIN=(\d+)', text)))
    maxima = list(map(int, re.findall(r'lavfi\.signalstats\.YMAX=(\d+)', text)))
    assert len(minima) == len(maxima) == frames and all(high - low > 12 for low, high in zip(minima, maxima))
    return path, data, probe


def gallery(source, recordings):
    generation = source[:7]
    archive_prefix = historical_prefix(read(TARGET), source)
    sections = []
    for target, path, data, stem in recordings:
        key, title = html.escape(target['id']), html.escape(target['title'])
        seconds, fps = data['durationSeconds'], data['fps']
        sections.append(f'<section><h2>{data["level"]} · {title}</h2><video data-recording="{key}" controls preload="metadata" poster="walkthroughs/{stem}.jpg" src="walkthroughs/{stem}.mp4"></video><p>{seconds:.2f} с · {fps} кадров/с. <a href="walkthroughs/{stem}.json">Исходные данные записи</a></p></section>')
    return f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Брейнрот Портал — прохождения {generation}</title><style>*{{box-sizing:border-box}}body{{margin:0;background:#102632;color:#eff8fc;font:17px/1.65 system-ui}}main{{max-width:1080px;margin:auto;padding:32px 24px}}h1{{font-size:clamp(30px,5vw,50px);line-height:1.15}}a{{color:#8ae8ed}}video{{width:100%;border:1px solid #3e6472;border-radius:16px;background:#08171f}}section{{margin:44px 0}}code{{overflow-wrap:anywhere}}.archive{{padding:20px;border:1px solid #3e6472;border-radius:16px}}p{{color:#bed5de}}</style></head><body><main><a href="./">← Играть</a><h1>Прохождения единой кампании {generation}</h1><p>{len(recordings)} новых непрерывных записей из принятой production-сборки. Обычные игровые действия, исходный спутник, без перезапуска и возрождения. Это автоматические маршруты со знанием решения; частота записи не является замером FPS устройства.</p>''' + ''.join(sections) + f'''<p>Исходник игры и интерфейса: <code>{html.escape(source)}</code>. <a href="publication-receipt.json">Приёмка и происхождение сборки</a></p><section class="archive"><h2>Архивные прохождения</h2><p>Сохранены все прежние видео с исходными версиями. Они не являются свежими записями {generation}.</p><p><a href="/brainrot-portal/walkthroughs-v54-578c31e.html">Предыдущая сборка 578c31e: три записи v54</a></p><p><a href="/brainrot-portal/chapter-atlas/walkthroughs-v54-578c31e.html">Предыдущая сборка 578c31e: галерея главы</a></p><p><a href="/brainrot-portal/{archive_prefix}/publication-receipt.json">Происхождение предыдущей сборки 578c31e</a></p><p><a href="/brainrot-portal/walkthroughs-v50.html">Архив кампании v50: все 51 уровня</a></p><p><a href="/brainrot-portal/chapter-atlas/walkthroughs-v53.html">Архив v53: Сифонная обсерватория и Эхо горизонта</a></p></section><p><a href="/brainrot-portal/brainrot-portal-yandex-{generation}.zip">Пакет Яндекс Игр {generation}</a></p></main></body></html>'''


def assemble(args):
    config = read(CONFIG)
    source = config['sourceCommit']
    target = read(TARGET)
    assert source == target['sourceCommit'] and config['conclusion'] == 'success'
    assert config['runId'] > 0 and config['runAttempt'] == 1
    assert len(config['jobs']) == target['expectedJobs'] == len(target['expectedJobNames'])
    assert sorted(row['name'] for row in config['jobs']) == target['expectedJobNames']
    assert len(config['artifacts']) == target['expectedArtifacts'] == len(target['inputArtifactsCore']) + len(target['recordings'])
    inputs, site, proof = Path(args.inputs), Path(args.site), Path(args.proof)
    proof.mkdir(parents=True, exist_ok=True)
    assert re.fullmatch('[a-f0-9]{40}', args.publisher)
    browser = inputs / 'browser'
    info_path = browser / 'build-info.json'
    info = read(info_path)
    assert info['commit'] == info['gameCommit'] == info['interfaceCommit'] == source
    assert info['version'] == 'v54-unified-campaign' and info['levels'] == 51
    assert info['verified'] is False and info['publisherCommit'] is None
    assert [row['level'] for row in info['rooms']] == list(range(1, 52))
    files = inventory(browser)
    package = [row for row in files if row['path'] not in ('build-info.json', 'release-manifest.json')]
    assert package == sorted(info['files'], key=lambda row: row['path']), 'Accepted browser inventory differs'
    assert sum(row['bytes'] for row in files) < 100_000_000
    technical_path = unique(inputs / 'acceptance', 'technical-ci.json')
    technical = read(technical_path)
    assert technical['pass'] is True and technical['commit'] == source and technical['levels'] == 51
    assert technical['version'] == info['version'] and technical['buildInfoSha256'] == sha(info_path)
    assert technical['packageFilesSha256'] == info['packageFilesSha256']
    assert technical['sourceInputsSha256'] == info['sourceInputsSha256'] and technical['recordingRequested'] is True
    assert technical['checks'] and all(value['result'] == 'success' for value in technical['checks'].values())
    yandex = unique(inputs / 'yandex', 'brainrot-portal-yandex.zip')
    platform_path = unique(inputs / 'yandex', 'yandex-release-manifest.json')
    platform = read(platform_path)
    assert technical['platformManifestSha256'] == sha(platform_path)
    assert platform['commit'] == source and platform['rooms'] == info['rooms']
    assert platform['sourceInputsSha256'] == info['sourceInputsSha256']
    archive = {'filename': yandex.name, 'bytes': yandex.stat().st_size, 'sha256': sha(yandex)}
    assert archive == platform['platformArchive'] == technical['platformArchive']
    assert archive['bytes'] < 100_000_000
    extract(yandex, inputs / 'yandex-expanded', 100_000_000)
    expanded = inventory(inputs / 'yandex-expanded')
    assert [row for row in expanded if row['path'] not in ('build-info.json', 'release-manifest.json')] == sorted(platform['files'], key=lambda row: row['path'])
    assert sum(row['bytes'] for row in expanded) < 100_000_000
    recordings = []
    for record in target['recordings']:
        folder, level, fps, alternative = (record[key] for key in ['directory', 'level', 'fps', 'alternative'])
        stem = recording_stem(record, source)
        path, data, probe = verify_recording(inputs / folder, source, level, fps, alternative, proof)
        write(proof / (stem + '-ffprobe.json'), probe)
        recordings.append((record, path, data, stem))
    baseline = read(BASELINE)
    assert len(baseline['siteFiles']) == target['baseline']['expectedSiteFiles']
    assert baseline['publicationConclusion'] == 'success'
    assert baseline['gameCommit'] == baseline['interfaceCommit'] == target['baseline']['sourceCommit']
    assert baseline['publisherCommit'] == target['baseline']['publisherCommit']
    assert baseline['publicationRun'] == target['baseline']['publicationRun']
    assert not site.exists(), 'Refusing to overwrite an existing staging site'
    before_report = fetch_inventory(baseline['siteFiles'], PUBLIC, site)
    write(proof / 'baseline-public-bytes.json', before_report)
    before = inventory(site)
    assert before == sorted(baseline['siteFiles'], key=lambda row: row['path'])
    # Retain every byte that is about to be replaced, including old build identity,
    # receipts and galleries. All old video/poster paths remain unchanged in place.
    replaced = {prefix + row['path'] for prefix in ['', 'chapter-atlas/'] for row in files}
    replaced.update(['walkthroughs.html', 'chapter-atlas/walkthroughs.html',
                     'publication-receipt.json', 'chapter-atlas/publication-receipt.json'])
    archive_prefix = historical_prefix(target, source)
    assert not (site / archive_prefix).exists(), 'Historical destination already exists'
    archived = []
    for row in before:
        if row['path'] in replaced:
            destination = site / archive_prefix / row['path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(site / row['path'], destination)
            assert sha(destination) == row['sha256']
            archived.append({'originalPath': row['path'], 'archivePath': archive_prefix + '/' + row['path'],
                             'bytes': row['bytes'], 'sha256': row['sha256']})
    for prefix, archive_name in [('', 'walkthroughs-v54-578c31e.html'), ('chapter-atlas', 'walkthroughs-v54-578c31e.html')]:
        destination = site / prefix
        assert not (destination / archive_name).exists()
        shutil.copyfile(destination / 'walkthroughs.html', destination / archive_name)
        shutil.copytree(browser, destination, dirs_exist_ok=True)
        (destination / 'walkthroughs').mkdir(exist_ok=True)
        for record, path, data, stem in recordings:
            # The JSON remains byte-for-byte original. Public filenames are mapped in the receipt.
            for field, suffix in [('video', '.mp4'), ('poster', '.jpg'), ('finishPoster', '-finish.jpg')]:
                shutil.copyfile(path.parent / safe(data[field]), destination / 'walkthroughs' / (stem + suffix))
            shutil.copyfile(path, destination / 'walkthroughs' / (stem + '.json'))
        (destination / 'walkthroughs.html').write_text(gallery(source, recordings), encoding='utf-8')
    shutil.copyfile(yandex, site / ('brainrot-portal-yandex-' + source[:7] + '.zip'))
    receipt = {'schemaVersion': 1, 'version': info['version'], 'gameCommit': source, 'interfaceCommit': source,
        'publisherCommit': args.publisher, 'publicationRun': int(os.environ['GITHUB_RUN_ID']) if os.environ.get('GITHUB_RUN_ID') else None,
        'reviewRun': config['runId'], 'reviewAttempt': config['runAttempt'],
        'reviewConclusion': 'success', 'successfulJobs': len(config['jobs']), 'technicalAcceptance': technical,
        'artifactInputs': config['artifacts'], 'browserPackage': {'files': files, 'bytes': sum(row['bytes'] for row in files)},
        'platformArchive': archive, 'publicationPaths': ['', 'chapter-atlas/'], 'baselinePublicCheck': before_report,
        'recordings': [{'id': record['id'], 'originalEvidence': data, 'publicVideo': 'walkthroughs/' + stem + '.mp4', 'publicEvidence': 'walkthroughs/' + stem + '.json'} for record, _, data, stem in recordings],
        'previousPublication': target['baseline'], 'archivedReplacements': archived,
        'historicalMediaScope': 'All previous media bytes remain checksum-identical. Native browser verification plays/seeks the three prior F movies at the root archive, one prior F movie in the chapter archive and one representative movie each in v50 and v53; it does not natively play every historical recording.',
        'status': 'Exact accepted package delivered; independent public byte and native input checks are recorded in the publication workflow artifacts.',
        'limitations': ['Finite exploit attempts do not prove the absence of every possible shortcut.', 'Hardware FPS/VRAM, blind human playtesting and live Yandex moderation remain unperformed.', 'Other room recordings retain their original versions and require a current visual review.']}
    for prefix in ['', 'chapter-atlas']:
        write(site / prefix / 'publication-receipt.json', receipt)
        assert sha(site / prefix / 'build-info.json') == sha(info_path)
        for row in files:
            if row['path'] == 'walkthroughs.html':
                continue
            assert sha(site / prefix / row['path']) == row['sha256']
    after = inventory(site)
    lookup = {row['path']: row for row in after}
    assert {row['path'] for row in before}.issubset(lookup), 'A previous public path was removed'
    preserved = [row for row in before if row['path'] not in replaced]
    assert all(lookup.get(row['path']) == row for row in preserved), 'Unrelated public evidence changed'
    assert sha(site / 'walkthroughs-v54-578c31e.html') == next(row['sha256'] for row in before if row['path'] == 'walkthroughs.html')
    assert sha(site / 'chapter-atlas/walkthroughs-v54-578c31e.html') == next(row['sha256'] for row in before if row['path'] == 'chapter-atlas/walkthroughs.html')
    write(proof / 'technical-ci.json', technical)
    write(proof / 'manifest.json', {**receipt, 'preservedFiles': preserved, 'siteFiles': after})
    print(json.dumps({'pass': True, 'source': source, 'siteFiles': len(after), 'preservedFiles': len(preserved), 'gameBytes': sum(row['bytes'] for row in files), 'zipBytes': archive['bytes']}))


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest='command', required=True)
    local = commands.add_parser('check-local')
    local.add_argument('--site', required=True)
    local.add_argument('--manifest', required=True)
    baseline = commands.add_parser('adopt-baseline')
    baseline.add_argument('--inputs', required=True)
    baseline.add_argument('--proof', required=True)
    unpack = commands.add_parser('unpack')
    unpack.add_argument('--inputs', required=True)
    unpack.add_argument('--proof', required=True)
    build = commands.add_parser('assemble')
    build.add_argument('--inputs', required=True)
    build.add_argument('--site', required=True)
    build.add_argument('--proof', required=True)
    build.add_argument('--publisher', required=True)
    verify = commands.add_parser('verify')
    verify.add_argument('--site-url', required=True)
    verify.add_argument('--manifest', required=True)
    verify.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.command == 'check-local':
        assert inventory(args.site) == read(args.manifest)['siteFiles'], 'Downloaded staging package differs from accepted assembled bytes'
        print(json.dumps({'pass': True, 'siteFiles': len(inventory(args.site))}))
    elif args.command == 'adopt-baseline':
        adopt_baseline(args)
    elif args.command == 'unpack':
        config = read(CONFIG)
        for artifact in config['artifacts']:
            directory = safe(artifact['directory'])
            archive = Path(args.inputs) / 'zips' / (directory + '.zip')
            assert 'sha256:' + sha(archive) == artifact['digest']
            extract(archive, Path(args.inputs) / directory)
        write(Path(args.proof) / 'artifact-inputs.json', config['artifacts'])
    elif args.command == 'assemble':
        assemble(args)
    else:
        try:
            report = fetch_inventory(read(args.manifest)['siteFiles'], args.site_url)
            write(args.output, report)
            print(json.dumps(report))
        except Exception as error:
            write(args.output, {'pass': False, 'error': str(error)})
            raise


if __name__ == '__main__':
    main()
