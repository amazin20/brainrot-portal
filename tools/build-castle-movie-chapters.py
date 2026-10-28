"""Add external chapter markers; never modify the verified movie pixels."""
import json
from pathlib import Path

root = Path('docs/development/proofs/castle-grand-20261028/movie')
report = json.loads((root / 'report.json').read_text())
assert report['pass'] and report['result']['route']['pass']
route = report['result']['route']
titles = {
    'freight': 'Грузовой зал: спутник и возвратный шлюз',
    'sluice': 'Гидравлика: перераспределение воды',
    'optics': 'Оптика: порталы и отражение луча',
    'hoist': 'Подъёмник: груз и верхний фиксатор',
    'archive': 'Архив: подвижные стены',
    'flywheel': 'Маховик: нагрузка и передача энергии',
    'magnet': 'Магнитный зал: свободный спутник',
    'migrant': 'Каретка: перенос через подвижный портал',
    'pendulum': 'Маятник: нагруженный мост и подъёмник',
    'inertia': 'Инерция: разгон падением',
    'impulse': 'Импульс: удар и возврат спутника',
    'crown': 'Корона: обзор, проход и совместный выход',
}
chapters = []
for mark in route['milestones']:
    name = mark['name']
    if name.startswith('Start '):
        key = name.removeprefix('Start ')
        assert key in titles
        chapters.append({'id': key, 'title': titles[key], 'start': mark['seconds'], 'frame': mark['frame']})
assert [c['id'] for c in chapters] == list(titles)
for i, chapter in enumerate(chapters):
    chapter['end'] = chapters[i + 1]['start'] if i + 1 < len(chapters) else route['seconds']
    assert chapter['end'] > chapter['start']

def timestamp(seconds):
    ms = round(seconds * 1000)
    hours, ms = divmod(ms, 3600000)
    minutes, ms = divmod(ms, 60000)
    second, ms = divmod(ms, 1000)
    return f'{hours:02d}:{minutes:02d}:{second:02d}.{ms:03d}'

vtt = ['WEBVTT', '']
text = '\n## Главы записи\n\nВремена взяты из реального журнала этого видео, а не расставлены вручную.\n\nНачало | Этап\n---|---\n'
for i, chapter in enumerate(chapters):
    vtt += [str(i + 1), timestamp(chapter['start']) + ' --> ' + timestamp(chapter['end']), chapter['title'], '']
    seconds = int(chapter['start'])
    text += f'{seconds // 60:02d}:{seconds % 60:02d} | {chapter["title"]}\n'
(root / 'chapters.vtt').write_text('\n'.join(vtt))
(root / 'chapters.json').write_text(json.dumps(chapters, ensure_ascii=False, indent=2) + '\n')
readme = root / 'README.md'
body = readme.read_text()
if '## Главы записи' not in body:
    readme.write_text(body + text + '\n[Внешние метки глав WebVTT](chapters.vtt). MP4 оставлен неизменным.\n')
print('Twelve chapter markers derived from the verified movie route')
