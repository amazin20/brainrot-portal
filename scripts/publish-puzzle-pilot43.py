"""Preserve the accepted Pages archive and add one isolated pilot directory."""
import argparse
import concurrent.futures
import hashlib
import html
import json
import pathlib
import shutil
import tarfile
import time
import urllib.parse
import urllib.request


def safe_name(name):
    while name.startswith('./'):
        name = name[2:]
    assert name and not name.startswith('/') and '\\' not in name, name
    assert all(part not in ('', '.', '..') for part in name.split('/')), name
    return name


def sha256_file(filename):
    digest = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            digest.update(chunk)
    return digest.hexdigest()


def inventory(root):
    rows = []
    for filename in sorted(root.rglob('*')):
        assert not filename.is_symlink(), 'Unexpected link: ' + str(filename)
        if filename.is_file():
            rows.append({'path': safe_name(filename.relative_to(root).as_posix()),
                         'bytes': filename.stat().st_size, 'sha256': sha256_file(filename)})
    assert len({row['path'] for row in rows}) == len(rows)
    return rows


def write_json(filename, value):
    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def assemble(args):
    archive_dir, candidate, site, proof = map(pathlib.Path, [args.baseline, args.candidate, args.site, args.proof])
    archives = list(archive_dir.rglob('*.tar'))
    assert len(archives) == 1, 'Exactly one accepted Pages TAR is required'
    assert not site.exists(), 'Refuse to mix an existing site with the accepted baseline'
    site.mkdir(parents=True)
    seen, total = set(), 0
    with tarfile.open(archives[0]) as archive:
        for entry in archive:
            if entry.isdir() and entry.name in ('.', './'):
                continue
            name = safe_name(entry.name.rstrip('/') if entry.isdir() else entry.name)
            assert entry.isfile() or entry.isdir(), 'Non-regular TAR entry: ' + name
            if entry.isdir():
                continue
            assert name not in seen, 'Duplicate TAR entry: ' + name
            seen.add(name)
            total += entry.size
            assert total < 2 * 1024 ** 3, 'Oversized baseline archive'
            filename = site / name
            filename.parent.mkdir(parents=True, exist_ok=True)
            with archive.extractfile(entry) as source, filename.open('xb') as output:
                shutil.copyfileobj(source, output)
    before = inventory(site)
    assert before, 'The baseline must contain the accepted site'
    assert not (site / 'puzzle-pilot').exists(), 'The isolated path already exists; pin its current publication before replacing it'
    old = json.loads((site / 'build-info.json').read_text())
    new = json.loads((candidate / 'build-info.json').read_text())
    assert old['commit'] == args.baseline_source, 'Baseline source mismatch'
    # The accepted source stamp keeps its publisher unset. The publishing run,
    # Pages deployment and all preserved public bytes establish its provenance.
    assert old['publisherCommit'] is None, 'Accepted baseline source metadata changed'
    assert new['commit'] == args.source, 'Pilot source mismatch'
    assert new['version'] == 'v54-puzzle-pilot43-v1'
    assert new['features']['puzzlePilot43']['optIn'] is True
    assert new['features']['puzzlePilot43']['level'] == 43
    candidate_files = inventory(candidate)
    assert sum(row['bytes'] for row in candidate_files) < 100 * 1024 ** 2, 'Pilot game exceeds 100 MiB'
    shutil.copytree(candidate, site / 'puzzle-pilot')
    walkthrough = new['features']['puzzlePilot43'].get('currentWalkthrough')
    assert walkthrough and walkthrough['sourceCommit'] == args.source, 'The exact pilot recording is required'
    assert walkthrough['sha256'] == sha256_file(candidate / 'evidence/level-43.mp4')
    status = {'schemaVersion': 1, 'sourceCommit': args.source, 'publisherCommit': args.source,
              'publicationRun': args.run, 'baselinePublicationRun': args.baseline_run,
              'baselinePublisherCommit': args.baseline_publisher, 'baselineSourceCommit': args.baseline_source,
              'path': 'puzzle-pilot/', 'level': 43, 'optIn': True,
              'query': '?edition=foundation&level=43&pilot=43', 'mainSiteUnchanged': True,
              'masterSpecComplete': False, 'currentVisualWalkthroughs': True,
              'currentWalkthrough': walkthrough}
    write_json(site / 'puzzle-pilot/preview-status.json', status)
    (site / 'puzzle-pilot/walkthroughs.html').write_text(
        '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Пилот: записи прохождений</title><style>body{background:#102632;color:#eef8fc;font:18px/1.7 system-ui;max-width:760px;margin:12vh auto;padding:24px}a{color:#70e4ed}</style>'
        '<h1>' + html.escape(new['features']['puzzlePilot43']['title']) + '</h1>'
        '<p>Полное непрерывное прохождение этой версии пилота. Запись выполнена программным WebGL с частотой 4 кадра/с; она не показывает FPS на устройстве игрока.</p>'
        '<video controls preload="metadata" poster="evidence/level-43.jpg" style="width:100%;background:#000"><source src="evidence/level-43.mp4" type="video/mp4"></video>'
        '<p><a href="evidence/level-43.json">Отчёт о записи и исходной версии</a></p>'
        '<p><a href="./?edition=foundation&amp;level=43&amp;pilot=43">Вернуться к пилоту</a></p>'
        '<p><a href="../walkthroughs.html">Архив прохождений основной игры</a></p></html>', encoding='utf-8')
    after = inventory(site)
    after_map = {row['path']: row for row in after}
    for row in before:
        assert after_map[row['path']] == row, 'Existing public file changed: ' + row['path']
    added = [row for row in after if row['path'].startswith('puzzle-pilot/')]
    assert len(after) == len(before) + len(added), 'A file outside the pilot directory was added'
    manifest = {**status, 'preservedFiles': before, 'pilotFiles': added, 'siteFiles': after,
                'preservedBytes': sum(row['bytes'] for row in before),
                'pilotBytes': sum(row['bytes'] for row in added)}
    write_json(proof / 'manifest.json', manifest)
    write_json(proof / 'baseline-manifest.json', {**status, 'siteFiles': before})
    print(json.dumps({'mainSiteUnchanged': True, 'preservedFiles': len(before),
                      'pilotFiles': len(added), 'pilotBytes': manifest['pilotBytes']}))


def verify(args):
    manifest = json.loads(pathlib.Path(args.manifest).read_text())
    rows = manifest['siteFiles']
    seen = set()
    for row in rows:
        name = safe_name(row['path'])
        assert name not in seen, name
        seen.add(name)
        assert type(row['bytes']) is int and row['bytes'] >= 0
        assert len(row['sha256']) == 64 and all(c in '0123456789abcdef' for c in row['sha256'])
    report = {'pass': False, 'sourceCommit': manifest['sourceCommit'], 'checked': 0,
              'mainSiteUnchanged': True, 'siteUrl': args.base, 'scope': 'Every file in the accepted publication inventory'}
    try:
        def one(row):
            for attempt in range(4):
                try:
                    url = args.base.rstrip('/') + '/' + urllib.parse.quote(row['path'], safe='/') + '?pilot-byte-check=' + str(time.time_ns())
                    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'brainrot-pilot43-byte-check'})
                    digest, length = hashlib.sha256(), 0
                    with urllib.request.urlopen(request, timeout=90) as response:
                        assert response.status == 200, (row['path'], response.status)
                        for chunk in iter(lambda: response.read(1048576), b''):
                            length += len(chunk)
                            assert length <= row['bytes'], 'Unexpected bytes: ' + row['path']
                            digest.update(chunk)
                    assert length == row['bytes'], 'Public size changed: ' + row['path']
                    assert digest.hexdigest() == row['sha256'], 'Public hash changed: ' + row['path']
                    return length
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(2 ** attempt)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            lengths = list(executor.map(one, rows))
        report.update({'pass': True, 'checked': len(lengths), 'bytes': sum(lengths)})
        print(json.dumps(report))
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        write_json(pathlib.Path(args.output), report)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    assembly = sub.add_parser('assemble')
    for flag in ['baseline', 'candidate', 'site', 'proof', 'source', 'baseline-source', 'baseline-publisher', 'run', 'baseline-run']:
        assembly.add_argument('--' + flag, required=True)
    verification = sub.add_parser('verify')
    for flag in ['base', 'manifest', 'output']:
        verification.add_argument('--' + flag, required=True)
    args = parser.parse_args()
    (assemble if args.command == 'assemble' else verify)(args)


if __name__ == '__main__':
    main()
