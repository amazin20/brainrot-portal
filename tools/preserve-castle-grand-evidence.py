"""Keep completed castle review evidence, not game source or deployment files."""
import hashlib, io, json, os, pathlib, re, zipfile
from PIL import Image, ImageDraw, ImageFont

root = pathlib.Path(os.environ['RUNNER_TEMP']) / 'castle-grand-evidence'
out = pathlib.Path('docs/development/proofs/castle-grand-20261028')
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'manifest.json').read_text())
source = manifest['sourceCommit']
assert source == '92d02d1d7febfe9162c08912f6728e459403f8af'
baseline = '6f4b9b58a5f51efb99492e20d54349fd5fee9add'

def artifact(kind):
    item = next(a for a in manifest['artifacts'] if a['kind'] == kind)
    data = (root / (str(item['id']) + '.zip')).read_bytes()
    assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256']
    archive = zipfile.ZipFile(io.BytesIO(data))
    for name in archive.namelist():
        path = pathlib.PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts
    return archive

with artifact('tests') as archive:
    assert archive.read('source-sha.txt').decode().strip() == source
    contract = json.loads(archive.read('baseline-contract.json'))
    assert contract == {'baselineCommit': baseline, 'hash': '4887f49f5792fa17edc32cd049ea425002b39a47d7bb155c60f841f9be412c44', 'pass': True}
    tap = archive.read('tests.tap').decode()
    for name, value in [('tests', 61), ('pass', 61), ('fail', 0), ('cancelled', 0), ('skipped', 0)]:
        assert re.findall(r'^# ' + name + r' (\d+)$', tap, re.M) == [str(value)]
    cpu = json.loads(archive.read('castle-route.json'))
    assert cpu['pass'] and cpu['route']['pass'] and cpu['metrics']['won']
    assert cpu['metrics']['completedStages'] == cpu['metrics']['totalStages'] == 12
    assert cpu['metrics']['checkpoints'] is False
    assert cpu['route']['resets'] == cpu['route']['respawns'] == cpu['route']['cargoResets'] == 0
    for name in ['source-sha.txt', 'tests.tap', 'baseline-contract.json', 'castle-route.json']:
        (out / name).write_bytes(archive.read(name))

summary = {'sourceCommit': source, 'baselineCommit': baseline, 'run': manifest['run'],
           'testsPassed': 61, 'newStructuralTests': 10, 'fullRouteTests': 1,
           'retainedTests': 50, 'images': 0, 'pairedViews': 0,
           'fullCampaignAccepted': False, 'published': False}
with artifact('native') as archive:
    folder = 'qa/castle-grand/'
    raw = archive.read(folder + 'report.json')
    report = json.loads(raw)
    assert report['pass'] and report['candidateCommit'] == source and report['baselineCommit'] == baseline
    assert [r['version'] for r in report['rows']] == ['before', 'after']
    assert report['fixture']['targetIndex'] == 40 and report['fixture']['targetCompleted'] is False
    assert 40 not in report['fixture']['completed']
    (out / 'native-report.json').write_bytes(raw)
    expected_wings = ['freight', 'sluice', 'optics', 'hoist', 'archive', 'flywheel', 'magnet', 'migrant', 'pendulum', 'inertia', 'impulse', 'crown']
    def image(record):
        name = record['file']
        assert pathlib.PurePosixPath(name).name == name and name.endswith('.png')
        data = archive.read(folder + name)
        assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256']
        with Image.open(io.BytesIO(data)) as im:
            im.load()
            assert im.format == 'PNG' and im.size == (1280, 720)
        (out / name).write_bytes(data)
        summary['images'] += 1
    for row in report['rows']:
        assert row['pass'] and not row['errors'] and not row['consoleErrors'] and len(row['views']) == 15
        for view in row['views']:
            assert view['before'] == view['after']
            assert view['before']['id'] == 'tower-singularity'
            assert view['before']['steps'] == view['before']['elapsed'] == 0
            assert view['before']['solved'] == [] and view['before']['state'] == 'playing'
            image(view)
    before, after = report['rows']
    for old, new in zip(before['views'], after['views']):
        assert old['kind'] == new['kind'] and old['camera'] == new['camera'] and old['before'] == new['before']
        summary['pairedViews'] += 1
    route = after['route']
    assert route['state'] == 'won' and route['sameOriginal'] and route['route']['pass']
    assert route['deletions'] == route['route']['resets'] == route['route']['respawns'] == route['route']['cargoResets'] == 0
    assert route['metrics']['completedStages'] == 12 and route['metrics']['checkpoints'] is False
    assert route['metrics']['solvedIds'] == expected_wings
    assert route['observations'] == route['route']['physicsSteps']
    assert len(route['captures']) == 42
    for capture in route['captures']:
        image(capture['image'])
    image(route['image'])
    for name in ['before-server.log', 'after-server.log']:
        (out / name).write_bytes(archive.read(name))
    summary['nativeRoute'] = {key: route['route'][key] for key in ['frames', 'physicsSteps', 'seconds', 'activeSeconds', 'distance', 'maxIdleSeconds', 'resets', 'respawns', 'cargoResets']}
    summary['nativeRoute'].update({'state': 'won', 'sameOriginal': True, 'pairDeletions': 0, 'completedMechanisms': 12, 'checkpoints': False})
    summary['architecture'] = after['views'][0]['stats']
    assert [summary['architecture'][key] for key in ['exteriorWalls', 'wingSlabs', 'roofSlabs', 'piers']] == [4, 109, 13, 16]
    summary['startRender'] = {'before': before['views'][0]['render'], 'after': after['views'][0]['render']}
    summary['cpuRoute'] = {key: cpu['route'][key] for key in ['frames', 'seconds', 'activeSeconds', 'maxIdleSeconds', 'resets', 'respawns', 'cargoResets']}
assert summary['images'] == 73 and summary['pairedViews'] == 15
summary['limits'] = [
    'This remasters 142 existing building meshes; it adds no rooms, causal puzzles or checkpoints.',
    'The castle remains a twelve-mechanism challenge; this is not completion of a 500-stage request.',
    'Native and CPU runs are scripted known routes, not a human speedrun or a proven minimum completion time.',
    'Active time means measured player movement or camera rotation; it does not establish the quality of every second.',
    'The fixed pendulum camera is obstructed by an old internal wall in both builds; its route milestones supply separate real views.',
    'The original AABB collision envelopes remain, including the shallow wall relief; these are closed wall niches, not new passages.',
    'Native software WebGL counts are not hardware FPS, mobile-device testing or complete campaign acceptance.',
    'No Pages, releases or Yandex game publication.',
]
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')

font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
titles = {'start': 'ВХОД В ЗАМОК', 'atrium': 'НИЖНИЙ АТРИУМ', 'upper-atrium': 'ВЕРХНИЙ АТРИУМ',
          'castle-freight': 'ГРУЗОВОЙ ЗАЛ', 'castle-sluice': 'ГИДРАВЛИЧЕСКИЙ ЗАЛ', 'castle-optics': 'ОПТИЧЕСКИЙ ЗАЛ',
          'castle-hoist': 'ПОДЪЁМНЫЙ ЗАЛ', 'castle-archive': 'АРХИВ', 'castle-flywheel': 'МАХОВИК',
          'castle-magnet': 'МАГНИТНЫЙ ЗАЛ', 'castle-migrant': 'ПОДВИЖНАЯ КАРЕТКА',
          'castle-pendulum': 'МАЯТНИК · РАКУРС ПЕРЕКРЫТ', 'castle-inertia': 'ИНЕРЦИЯ',
          'castle-impulse': 'ИМПУЛЬС', 'castle-crown': 'КОРОНА'}
for selection, filename in [(['start', 'upper-atrium', 'castle-hoist'], 'before-after.jpg'),
                            ([v['kind'] for v in before['views']], 'all-views.jpg')]:
    canvas = Image.new('RGB', (1600, 495 * len(selection)), (16, 20, 29))
    draw = ImageDraw.Draw(canvas)
    for i, kind in enumerate(selection):
        for column, version in enumerate(['before', 'after']):
            with Image.open(out / (version + '-' + kind + '.png')) as im:
                canvas.paste(im.resize((800, 450), Image.Resampling.LANCZOS), (column * 800, i * 495 + 45))
            draw.text((column * 800 + 12, i * 495 + 10), titles[kind] + ' · ' + ('ДО' if version == 'before' else 'ПОСЛЕ'), font=font, fill=(231, 227, 211))
    canvas.save(out / filename, quality=93, subsampling=0)

text = '''# Складчатый замок · архитектурная переработка

Проверенный игровой исходник: `92d02d1d7febfe9162c08912f6728e459403f8af`. Исходная версия сравнения: `6f4b9b58a5f51efb99492e20d54349fd5fee9add`. Код, кадры и полные отчёты сохранены в Git. Публичная игра этим пакетом не обновлялась.

В меню замок остаётся последним испытанием. Его постоянный адрес — `level=41`, внутренний индекс 40; это не перенумерация сохранений.

![Обычная камера, верхний атриум и подъёмный зал](before-after.jpg)

[Все 15 парных видов](all-views.jpg) · [Машинная сводка](summary.json) · [Исходный браузерный отчёт](native-report.json) · [61 проверка](tests.tap)

## Реальное изменение сцены

Переработаны 142 существующие строительные модели: четыре больших ограждающих стены, 109 стеновых секций крыльев, 13 потолочных плит и 16 несущих колонн. Стены получили углублённые стрельчатые ниши, потолки — цельные кессоны, колонны — профилированные стволы и пояса. Новые поверхности заменяют старую геометрию, а не накладываются вторым совпадающим слоем. Цветовое свечение отделки крыла плавно реагирует на реальное завершение его механизма и игровое время; во время паузы не продвигается.

Прежние портальные адреса, модели персонажей, управления механизмами, физические тела и их габариты сохранены. Ниши остаются закрытыми стенами, а не новыми проходами. Это не добавление новых головоломок или комнат и не завершение требования о 500 этапах.

## Проверка

Один точный набор GitHub завершился **61/61 PASS**: десять новых структурных тестов, один полный маршрут замка и 50 прежних тестов. Исходный снимок коллизий, полов, порталов, управлений, тел и стартового состояния независимо подтверждён на отдельной неизменённой копии исходной версии, затем сопоставлен с новым замком.

Полное браузерное прохождение на 1280×720 завершилось победой через все 12 действующих механизмов. Старт — обычная кнопка «Играть» до первого физического шага. Ноль сбросов, возрождений, сбросов спутника и вызовов скрытого удаления пары. Исходные акторы проверялись на каждом обновлении. Для входа использовалось тестовое сохранение ранее завершённых комнат; сам замок до запуска не пройден.

Продолжительность браузерного маршрута — 1377,75 секунды, приблизительно **22:58**. Из них счётчик движения игрока или вращения камеры отметил 1289,03 секунды. Самый длинный непрерывный интервал без движения и поворота — 13,43 секунды. Это автоматический известный маршрут, не человеческий спидран и не доказательство минимального времени прохождения. Искусственные паузы для увеличения длительности не добавлялись.

Сохранены и проверены **73 настоящих PNG**: 30 статических снимков (15 до и 15 после), 42 контрольных момента маршрута и кадр победы. Для статических сравнений камеры, позиции акторов, физический шаг и стартовое состояние совпадают. Все изображения декодированы, размеры и SHA-256 проверены. Фиксированный ракурс маятникового зала закрыт прежней перегородкой в обеих версиях; он не считается полным осмотром зала. Отдельные виды этого механизма есть в кадрах 24–26 реального маршрута.

Счётчик отрисовки на стартовом ракурсе: 406 → 410 вызовов и 435 614 → 569 562 треугольника. Это цена новой геометрии, не обещание ускорения. Аппаратные FPS и реальные телефоны этим прогоном не измерялись.

## Исходные материалы

[Снимок старого контракта](baseline-contract.json) · [Полный CPU-маршрут](castle-route.json) · [Идентификатор исходника](source-sha.txt) · [Артефакты и хеши](manifest.json)

Ракурс | До | После
---|---|---
'''
for view in before['views']:
    kind = view['kind']
    text += f'{titles[kind]} | [PNG](before-{kind}.png) | [PNG](after-{kind}.png)\n'
text += '\nКадры прохождения и их названия содержатся в `native-report.json`; файлы `route-01.png`–`route-42.png` и `after-won.png` сохранены рядом.\n'
(out / 'README.md').write_text(text)
print('Preserved 73 genuine native PNGs, 15 matched views, a complete twelve-mechanism route and 61 checks')
