"""Validate and preserve already-completed public game-render artifacts.
No source archives, credentials, deployment, or changes to the game are involved.
"""
import hashlib, io, json, os, pathlib, re, zipfile
from PIL import Image, ImageDraw, ImageFont

root = pathlib.Path(os.environ['RUNNER_TEMP']) / 'optics-render-evidence'
out = pathlib.Path('docs/development/proofs/optics-remaster-20261028')
manifest = json.loads((root / 'manifest.json').read_text())
out.mkdir(parents=True, exist_ok=True)
by_version = {'before': {}, 'after': {}}
summary = {'baselineCommit': manifest['baselineCommit'], 'gameCommit': manifest['gameCommit'],
           'nativeRuns': manifest['nativeRuns'], 'verifiedImages': 0, 'matchedViews': 0,
           'nativeRoutes': [], 'structuralTests': None, 'fullCampaignAccepted': False,
           'published': False}

for artifact in manifest['artifacts']:
    blob = (root / (str(artifact['id']) + '.zip')).read_bytes()
    assert len(blob) == artifact['bytes']
    assert hashlib.sha256(blob).hexdigest() == artifact['sha256']
    version = artifact['version']
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        names = archive.namelist()
        for name in names:
            path = pathlib.PurePosixPath(name)
            assert not path.is_absolute() and '..' not in path.parts
        report_path = 'qa/chapter-native/report.json'
        raw = archive.read(report_path)
        report = json.loads(raw)
        assert report['pass'] and report['sourceCommit'] == artifact['sourceCommit']
        assert [r['level'] for r in report['rows']] == artifact['levels']
        (out / (version + '-' + str(artifact['levels'][0]) + '-report.json')).write_bytes(raw)
        log = 'native-server.log'
        if log in names:
            (out / (version + '-' + str(artifact['levels'][0]) + '-server.log')).write_bytes(archive.read(log))
        for row in report['rows']:
            level = row['level']
            assert row['pass'] and not row['errors'] and not row['consoleErrors']
            assert level not in by_version[version]
            assert len(row['views']) == 3
            by_version[version][level] = row
            room = out / ('room-' + str(level))
            room.mkdir(exist_ok=True)
            images = list(row['views'])
            for view in row['views']:
                assert view['before'] == view['after']
                assert view['before']['index'] == level - 1 and view['before']['steps'] == 0
            if version == 'after':
                route = row['route']
                assert route['result']['pass'] and route['state'] == 'won' and route['sameOriginal']
                assert route['resets'] == route['result']['resets'] == route['result']['respawns'] == 0
                images.append(route['image'])
                summary['nativeRoutes'].append({'level': level, 'frames': route['result']['frames'],
                    'physicalUpdates': route['observations'], 'resets': 0, 'respawns': 0, 'sameOriginal': True})
            for image in images:
                filename = image['filename']
                assert pathlib.PurePosixPath(filename).name == filename
                assert filename.startswith('room-' + str(level) + '-') and filename.endswith('.png')
                data = archive.read('qa/chapter-native/' + filename)
                assert len(data) == image['bytes'] and hashlib.sha256(data).hexdigest() == image['sha256']
                with Image.open(io.BytesIO(data)) as decoded:
                    decoded.load()
                    assert decoded.size == (1280, 720) and decoded.format == 'PNG'
                (room / (version + '-' + filename)).write_bytes(data)
                summary['verifiedImages'] += 1
        if version == 'after' and 31 in artifact['levels']:
            tap = archive.read('qa/chapter-native/optics-structural.tap')
            text = tap.decode()
            def count(name):
                found = re.findall(r'^# ' + name + r' (\d+)$', text, re.M)
                assert len(found) == 1
                return int(found[0])
            assert count('tests') == count('pass') == 26
            assert count('fail') == count('cancelled') == count('skipped') == 0
            summary['structuralTests'] = 26
            (out / 'optics-structural.tap').write_bytes(tap)

assert set(by_version['before']) == set(by_version['after']) == set(range(31, 41))
for level in range(31, 41):
    before, after = by_version['before'][level], by_version['after'][level]
    for old, new in zip(before['views'], after['views']):
        assert old['filename'] == new['filename']
        assert old['camera'] == new['camera'] and old['before'] == new['before'] and old['after'] == new['after']
        summary['matchedViews'] += 1
assert summary['verifiedImages'] == 70 and summary['matchedViews'] == 30
assert len(summary['nativeRoutes']) == 10 and summary['structuralTests'] == 26
summary['limits'] = [
    'Decorative observatory relief is not a new interactive iris mechanism or a new puzzle.',
    'Native software WebGL at 1280x720 is not hardware-device FPS or a human playtest.',
    'Prior-prefix access fixture admits the unfinished target, not a live full-campaign playthrough.',
    'Room35 oblique/opposite reference cameras are obstructed by existing geometry before and after; the gallery uses its normal start view.',
    'Existing diagonal artifacts on some internal partitions remain; this pass does not claim their removal.',
    'Other gameplay, full-suite failures and live Yandex moderation remain outside acceptance.',
]
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
for levels, filename in [([31, 33, 38], 'before-after.jpg'), (list(range(31, 41)), 'all-ten-rooms.jpg')]:
    canvas = Image.new('RGB', (1600, 492 * len(levels)), (15, 21, 37))
    draw = ImageDraw.Draw(canvas)
    for i, level in enumerate(levels):
        kind = 'start' if level == 35 else 'oblique'
        for column, version in enumerate(['before', 'after']):
            path = out / ('room-' + str(level)) / (version + '-room-' + str(level) + '-' + kind + '.png')
            with Image.open(path) as image:
                canvas.paste(image.resize((800, 450), Image.Resampling.LANCZOS), (800 * column, 492 * i + 42))
            draw.text((800 * column + 15, 492 * i + 7), 'КОМНАТА ' + str(level) + ' · ' + ('ДО' if version == 'before' else 'ПОСЛЕ'), font=font, fill=(235, 238, 248))
    canvas.save(out / filename, quality=92, subsampling=0)

text = '''# Ночная обсерватория · комнаты 31–40

Игровой визуальный код: `868ace3397b61f3d893e2e4ff74bb1f778f63966`. Исходная версия: `e589c0ed0b0e8ea5dcac60b1b549a6adde75c32e`. Дальнейшая правка маршрутов комнат 7 и 49 не меняет этот визуальный модуль.

Все изображения сняты в обычных production-сборках. Это не концепт-арт: камеры и начальные состояния совпадают, в сравнительных листах кадры только уменьшены и подписаны. Публичный сайт и Яндекс Игры не обновлены.

![Три сравнения до и после](before-after.jpg)

[Все десять комнат](all-ten-rooms.jpg) · [Сводка](summary.json) · [Точные артефакты и хеши](manifest.json) · [26 проверок](optics-structural.tap)

## Что изменено

Прежние плоские стеновые кассеты заменены арочными серебряными секциями, индиговой отделкой, архивными панелями и утопленным рельефом диафрагм. На существующем потолке появился астрономический рисунок; напольные материалы и освещение переработаны. Диафрагмы — декоративный рельеф, не новые головоломки. Купол и новые комнаты этим пакетом не построены.

Новая геометрия находится внутри прежнего 80-мм объёма отделки. Коллизии, правила взаимодействий, белые портальные поверхности и оригинальные модели не меняются. Исходные полные игровые контракты всех десяти комнат проверены. Детали рисуются восемью группами инстансов, без добавления источников света или коллайдеров.

## Что подтверждено

Сохранены 70 исходных PNG: 30 старых статических видов, 30 новых и 10 кадров победы. Все контрольные суммы и размеры проверены, PNG декодированы. Десять новых браузерных маршрутов при 1280×720 завершились победой с исходными персонажами, без сбросов и возрождений. Во время проверки исходная сборка не изменялась. Отдельный принятый набор содержит 26 структурных и связанных проверок.

Два фиксированных обзорных ракурса комнаты 35 закрыты прежней геометрией и не выдаются за полезный осмотр: в общей галерее показан обычный стартовый вид. На части внутренних перегородок остаются прежние диагональные артефакты. Их устранение, полная приёмка кампании и измерения аппаратного FPS здесь не заявляются.

## Исходные виды

Комната | До | После | Победа
---|---|---|---
'''
for n in range(31, 41):
    text += f'{n} | [PNG](room-{n}/before-room-{n}-start.png) | [PNG](room-{n}/after-room-{n}-start.png) | [PNG](room-{n}/after-room-{n}-won.png)\n'
(out / 'README.md').write_text(text)
print('Verified and preserved 70 native PNGs, 30 exact camera/state comparisons, 10 completed routes, 26 tests')
