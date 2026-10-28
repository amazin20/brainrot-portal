"""Preserve completed room 7/49 control-only route evidence, not game source."""
import hashlib, io, json, os, pathlib, re, zipfile
from PIL import Image
root = pathlib.Path(os.environ['RUNNER_TEMP']) / 'optics-render-evidence'
out = pathlib.Path('docs/development/proofs/optics-remaster-20261028')
manifest = json.loads((root / 'manifest.json').read_text())
summary = json.loads((out / 'summary.json').read_text())
repair = manifest['repairArtifact']
blob = (root / (str(repair['id']) + '.zip')).read_bytes()
assert len(blob) == repair['bytes'] and hashlib.sha256(blob).hexdigest() == repair['sha256']
repair_out = out / 'ordinary-repairs'
repair_out.mkdir(exist_ok=True)
with zipfile.ZipFile(io.BytesIO(blob)) as archive:
    raw = archive.read('qa/chapter-native/ordinary-repairs/report.json')
    report = json.loads(raw)
    assert report['pass'] and report['sourceCommit'] == repair['sourceCommit']
    expected = [(7, 'wide'), (7, 'portrait'), (49, 'wide'), (49, 'portrait'), (49, '9by16')]
    assert [(r['level'], r['name']) for r in report['rows']] == expected
    (repair_out / 'report.json').write_bytes(raw)
    summary['ordinaryRepairs'] = {'sourceCommit': repair['sourceCommit'], 'run': repair['run'], 'images': 0, 'rows': []}
    for row in report['rows']:
        result = row['result']
        assert row['pass'] and not row['errors'] and not row['consoleErrors']
        assert result['state'] == 'won' and result['route']['pass'] and result['sameOriginal'] and result['pairReady']
        assert result['deletions'] == result['route']['resets'] == result['route']['respawns'] == 0
        assert result['resets'] == (0 if row['level'] == 7 else 1)
        sizes = set()
        for image in row['images']:
            filename = image['filename']
            assert pathlib.PurePosixPath(filename).name == filename
            data = archive.read('qa/chapter-native/ordinary-repairs/' + filename)
            assert len(data) == image['bytes'] and hashlib.sha256(data).hexdigest() == image['sha256']
            with Image.open(io.BytesIO(data)) as im:
                im.load()
                assert im.format == 'PNG'
                assert im.size == ((390, 780) if row['name'] == 'portrait' else (row['width'], row['height']))
                sizes.add(im.size)
            (repair_out / filename).write_bytes(data)
            summary['ordinaryRepairs']['images'] += 1
        summary['ordinaryRepairs']['rows'].append({'level': row['level'], 'name': row['name'],
            'viewport': [row['width'], row['height']], 'nativeCanvasSizes': [list(v) for v in sorted(sizes)],
            'frames': result['route']['frames'], 'physicalUpdates': result['observations'],
            'setupResets': result['resets'], 'routeResets': 0, 'routeRespawns': 0, 'pairDeletions': 0,
            'sameOriginal': True, 'state': 'won'})
    assert summary['ordinaryRepairs']['images'] == 37
    tap = archive.read('qa/chapter-native/ordinary-repair-tests.tap')
    text = tap.decode()
    for name, value in [('tests', 10), ('pass', 10), ('fail', 0), ('cancelled', 0), ('skipped', 0)]:
        assert re.findall(r'^# ' + name + r' (\d+)$', text, re.M) == [str(value)]
    (repair_out / 'tests.tap').write_bytes(tap)
    summary['ordinaryRepairs']['testsPassed'] = 10
    (repair_out / 'README.md').write_text("""# Обычные маршруты комнат 7 и 49

Источник: `40b66d128efae24caa2414715374c029e85fd2d5`; проверка GitHub Actions `40626157829`.

Недоступный игроку вызов `clearPortals()` удалён из обоих проверочных маршрутов. В комнате 7 игрок подходит сбоку к исходному спутнику, сохраняя открытую пару. В комнате 49 он проходит внутрь вагона перед обычным переназначением порталов выстрелами. Коллизии, игровые правила и камера не упрощались.

Все пять браузерных случаев завершились победой: комната 7 в широком и узком окне, комната 49 в широком и двух узких окнах. Исходные акторы сохранялись. Любой вызов удаления пары немедленно завершил бы тест ошибкой: зарегистрировано ноль вызовов.

Комната 7 начинается непосредственно с Play, без перезапуска. Для комнаты 49 старый драйвер делает один штатный подготовительный reset до наблюдаемого маршрута. Внутри всех маршрутов — ноль сбросов и возрождений. Это не непрерывное прохождение всей кампании.

При окне 390×844 сам игровой canvas занимает 390×780; остальные 64 пикселя относятся к интерфейсу. Тест не выдаётся за canvas 390×844 или за реальный телефон. Варианты 1280×720 и 450×800 сняты с одноимённым размером canvas.

[Неизменённый отчёт](report.json) · [10 связанных проверок](tests.tap). Сохранены 37 исходных PNG с проверенными хешами; их имена и контрольные моменты находятся в отчёте.
""")
(out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
link = '\n[Обычные маршруты комнат 7 и 49: исходные кадры и проверки](ordinary-repairs/README.md).\n'
readme = out / 'README.md'
text = readme.read_text()
if 'ordinary-repairs/README.md' not in text:
    readme.write_text(text + link)
print('Preserved 37 native milestone PNGs, five original-actor routes and ten exact-source checks')
