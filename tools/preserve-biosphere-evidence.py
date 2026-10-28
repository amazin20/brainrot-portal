"""Preserve completed, source-bound native review without republishing the game."""
import os, json, zipfile, hashlib, pathlib, io
from PIL import Image, ImageDraw, ImageFont
source=pathlib.Path(os.environ['RUNNER_TEMP'])/'biosphere-evidence'
target=pathlib.Path('docs/development/proofs/biosphere-remaster-20261028')
target.mkdir(parents=True,exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text())
summary={'sourceCommit':manifest['sourceCommit'],'baselineCommit':manifest['baselineCommit'],'run':manifest['run'],'nativeRoutes':[],'nativeImages':0,'comparisons':[],'fullCampaignAccepted':False,'published':False}
for item in manifest['artifacts']:
    with zipfile.ZipFile(source/(str(item['level'])+'.zip')) as archive:
        names=archive.namelist()
        for name in names:
            p=pathlib.PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts:raise RuntimeError('Unsafe archive path')
        if item['level']=='structure':
            for name in names:
                if pathlib.PurePosixPath(name).name in ['structural.tap','build.log','source-sha.txt']:
                    (target/pathlib.PurePosixPath(name).name).write_bytes(archive.read(name))
            if (target/'source-sha.txt').read_text().strip()!=manifest['sourceCommit']:raise RuntimeError('Structural source mismatch')
            continue
        level=int(item['level']);room=target/f'room-{level}';room.mkdir(exist_ok=True)
        rows={};seen=set()
        for version in ['before','after']:
            reports=[n for n in names if n.endswith(f'/{version}/report.json')]
            if len(reports)!=1:raise RuntimeError('Ambiguous native report')
            name=reports[0];raw=archive.read(name);report=json.loads(raw)
            if not report['pass'] or len(report['rows'])!=1:raise RuntimeError('Incomplete native review')
            row=report['rows'][0];rows[version]=row
            if row['level']!=level or row['version']!=version or not row['pass'] or row['errors'] or row['consoleErrors']:raise RuntimeError('Failed target review')
            (room/f'{version}-report.json').write_bytes(raw)
            images=list(row['views'])
            if len(images)!=3:raise RuntimeError('Missing static views')
            if version=='after':
                r=row['route'];route=r['route']
                if r['state']!='won' or not r['sameBody'] or not route['pass'] or route['resets']!=0 or route['respawns']!=0:raise RuntimeError('Original-traveller route failed')
                images.append(r['image'])
                summary['nativeRoutes'].append({'level':level,'frames':route['frames'],'physicalUpdates':r['observations'],'resets':route['resets'],'respawns':route['respawns'],'originalActor':r['sameBody'],'state':r['state']})
            folder=str(pathlib.PurePosixPath(name).parent)
            for image in images:
                filename=image['file']
                if pathlib.PurePosixPath(filename).name!=filename or filename in seen:raise RuntimeError('Unsafe or duplicated image path')
                seen.add(filename);data=archive.read(folder+'/'+filename)
                if len(data)!=image['bytes'] or hashlib.sha256(data).hexdigest()!=image['sha256']:raise RuntimeError('Image byte mismatch')
                with Image.open(io.BytesIO(data)) as im:
                    im.load()
                    if im.size!=(1280,720) or im.format!='PNG':raise RuntimeError('Unexpected native viewport')
                (room/filename).write_bytes(data);summary['nativeImages']+=1
            for name in names:
                if name.endswith('-server.log'):(room/pathlib.PurePosixPath(name).name).write_bytes(archive.read(name))
        if len(seen)!=7:raise RuntimeError('Incomplete unique image set')
        for before,after in zip(rows['before']['views'],rows['after']['views']):
            if before['camera']!=after['camera'] or before['before']!=after['before'] or before['after']!=after['after']:raise RuntimeError('Before/after scene or camera mismatch')
        summary['comparisons'].append({'level':level,'matchedStaticViews':3,'beforeRender':rows['before']['views'][0]['render'],'afterRender':rows['after']['views'][0]['render'],'artwork':rows['after']['views'][0]['stats']})
if len(summary['nativeRoutes'])!=10 or summary['nativeImages']!=70:raise RuntimeError('Incomplete chapter evidence')
summary['limits']=['The completed-prefix save admits only the target and does not prove preceding rooms were played in this run.','1280x720 software WebGL and scripted ordinary input are not human discovery or hardware FPS.','Static view comparisons move only the camera; gameplay starts with original actors.','This pass changes art, not puzzle uniqueness, the castle or unrelated outstanding route failures.','No Pages or Yandex deployment.']
(target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(target/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',25)
# Only resize genuine frames, never retouch game pixels or fabricate a scene.
for selected,filename in [([21,24,29],'before-after.jpg'),(list(range(21,31)),'all-ten-rooms.jpg')]:
    w=800;h=450;header=45
    canvas=Image.new('RGB',(w*2,(h+header)*len(selected)),(18,29,27));draw=ImageDraw.Draw(canvas)
    for i,n in enumerate(selected):
        y=i*(h+header)
        for j,version in enumerate(['before','after']):
            path=target/f'room-{n}'/f'{version}-{n}-oblique.png'
            with Image.open(path) as im:canvas.paste(im.resize((w,h),Image.Resampling.LANCZOS),(j*w,y+header))
            draw.text((j*w+16,y+8),f'КОМНАТА {n} · '+('ДО' if version=='before' else 'ПОСЛЕ'),font=font,fill=(231,232,215))
    canvas.save(target/filename,quality=93,subsampling=0)
text='''# Биосфера: визуальная переработка комнат 21–30

Игровой код: `4f31b6ad05782c912c70f924c1edbc204d3c73a0`. Исходная версия: `a38730963973834b75b11ef77a08b5ca9ff6cacc`.

Все изображения — реальные кадры двух production-сборок. Камеры и начальные состояния совпадают; изображения не являются концептами или генерацией. Код, исходные PNG, отчёты и контрольные суммы сохранены в истории Git. Публичная игра этим изменением не обновлялась.

![Три примера до и после](before-after.jpg)

[Сравнение всех десяти комнат](all-ten-rooms.jpg) · [Полная сводка и ограничения](summary.json) · [Источники артефактов](manifest.json)

## Что изменено

В комнатах 21–29 заменены плоские строительные панели: нефритовые рамы, светлый камень, бронзовые вставки и утопленные растительные секции с объёмными листьями. Потолки получили светлые и тёмные кассеты с металлическими переплётами. Настилы переработаны вместе с освещением. Движение листвы связано с игровым временем и отключается режимом уменьшенной анимации.

В комнате 30 сохранена особая длиннопролётная конструкция лётного ангара; обновлены настилы и материалы его стен и крыши. Она не выдаётся за идентичную переработку потолка остальных девяти комнат. Белые портальные поверхности, игровые механизмы, пути и исходные персонажи сохранены.

## Проверка

Все десять комнат новой сборки завершили по одному автоматическому прохождению в браузере при 1280×720. Исходный спутник и его физическое тело сохранялись, сбросов и возрождений в маршрутах не было. Стартовое сохранение открывало предшествующие комнаты, но не отмечало целевую пройденной.

Сохранены 70 PNG: по три совпадающих ракурса до и после, плюс кадр победы каждой новой комнаты. Все файлы проверены по SHA-256 и декодированы. Четыре структурных теста проверяют неизменность игровых контрактов десяти комнат, освобождение ресурсов, движение листвы и разделение поверхностей камня и бронзы. Это не полная приёмка кампании, не ручной плейтест и не измерение FPS на устройстве.

В первоначальной версии нового настила выявлены совпадающие по глубине лица декоративных вставок. В итоговой версии они разделены на 4 мм, углы планок стыкуются без перекрытия. Это адресное устранение причины ряби, а не обещание отсутствия всех артефактов во всей игре.

## Исходные кадры

Комната | До: обычная камера | После: обычная камера | Прохождение
---|---|---|---
'''
for n in range(21,31):
    text+=f'{n} | [PNG](room-{n}/before-{n}-start.png) | [PNG](room-{n}/after-{n}-start.png) | [JSON](room-{n}/after-report.json)\n'
text+='\n[Структурные тесты](structural.tap) · [Лог сборки](build.log) · [Повторный связанный набор из 23 проверок](related-tests.tap).\n'
(target/'README.md').write_text(text)
print('Preserved',summary['nativeImages'],'native PNGs and',len(summary['nativeRoutes']),'completed candidate routes')
