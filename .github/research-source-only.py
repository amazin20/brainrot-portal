from pathlib import Path

def replace(file, old, new):
 p=Path(file);s=p.read_text();assert old in s,(file,old);p.write_text(s.replace(old,new))

# This action changes only ordinary source/tests/docs. Workflow configuration is
# intentionally left to the separately authorized repository connector.
p=Path('src/game/LabCampaignLevels.js');s=p.read_text();assert 'RESEARCH_BUILDERS' not in s
s="import {RESEARCH_BUILDERS,RESEARCH_SPECS} from './LabResearchChambers.js';\n"+s
s=s.replace('...NEW_CAMPAIGN]);','...NEW_CAMPAIGN,...RESEARCH_SPECS]);')
s=s.replace(" if(game.chamberEdition==='open'&&OPEN_BUILDERS[index])", " if(index>=30)return RESEARCH_BUILDERS[index-30](game,index);\n if(game.chamberEdition==='open'&&OPEN_BUILDERS[index])")
p.write_text(s)
replace('src/game/LabV8Journey.js','    if(level.openChamber){',"    if(level.researchChamber){\n      const {runResearchJourney}=await import('./LabResearchJourney.js');\n      await runResearchJourney({game,level,walk,wait,aim,look,until,pickup,enter,mark,frame,worldMove,stop},journeyOptions);\n    }else if(level.openChamber){")
replace('src/game/LabOpenEdition.js','[23,27,29]','[23,27,29,30,31,32]')
replace('src/game/LabOpenEdition.js','The three rebuilt rooms are an explicit review edition.','The rebuilt rooms and the research chapter form an explicit review edition.')
for p in [Path('scripts/stamp-build.mjs'),Path('scripts/verify-public.mjs')]:
 s=p.read_text().replace('v39-campaign-30','v40-laboratory-33').replace('v39-chromatic-worlds','v40-research-laboratory')
 if p.name=='stamp-build.mjs':s=s.replace('CAMPAIGN.length,30','CAMPAIGN.length,33').replace('campaignRooms:30,campaignFinaleLevel:30','campaignRooms:33,campaignFinaleLevel:33').replace("version:'human-laboratory-v2'","version:'research-laboratory-v3'").replace('rooms:[24,28,30]','rooms:[24,28,30,31,32,33]')
 if p.name=='verify-public.mjs':s=s.replace('info?.levels,30','info?.levels,33').replace('[1,9,10,20,24,26,27,28,29,30]','[1,9,10,20,24,26,27,28,29,30,31,32,33]').replace('if(level===10||level===20||level===26)','if(level===10||level===20||level===26||level===30)').replace('{from:30,to:1','{from:33,to:1').replace('All thirty','All thirty-three').replace("'v39 campaign: 30 rooms; public ordinary routes 1,9,10,20,24,26–30; transitions 10→11,20→21,26→27,30→1;", "'v40 campaign: 33 rooms; public ordinary routes 1,9,10,20,24,26–33; transitions 10→11,20→21,26→27,30→31,33→1;")
 p.write_text(s)
for file in ['scripts/v8-package-check.mjs','tests/lab-extended-campaign.test.js','tests/lab-wind-room.test.js']:
 replace(file,'CAMPAIGN.length,30','CAMPAIGN.length,33')
replace('tests/lab-open-edition.test.js','only its three actual replacements','its replacements plus the new research chapter')
replace('tests/lab-open-edition.test.js','[24,28,30]','[24,28,30,31,32,33]')
replace('tests/lab-open-edition.test.js','[27,29,23]','[27,29,30,31,32,23]')
replace('scripts/open-browser-review.mjs','assert.deepEqual(menu,[23,27,29])','assert.deepEqual(menu,[23,27,29,30,31,32])')
replace('src/game/LabResearchChambers.js','СВЕТ — ВРЕМЕННАЯ ОПОРА / ТЁМНЫЙ НАСТИЛ — ПОСТОЯННЫЙ','СВЕТ — ВРЕМЕННАЯ ОПОРА / СПЛОШНОЙ НАСТИЛ — ПОСТОЯННЫЙ')
replace('src/game/LabResearchChambers.js','стой на тёмном постоянном настиле','стой на сплошной постоянной площадке')
replace('src/main.js','Пройдены три пересобранных уровня этой версии.','Пройдены все испытания этой версии.')
replace('src/main.js','// ПРЕДЕЛ is the campaign finale at room 30; every public entry uses the campaign.','// Every public entry uses the same campaign; the review edition has isolated saves.')
replace('scripts/research-browser.mjs','// A separately labelled inspection camera is NOT route evidence.','// A separately labelled inspection camera is NOT route evidence.\n  await page.evaluate(()=>{document.querySelectorAll(\'.screen\').forEach(e=>e.classList.remove(\'screen--active\'));});')
Path('README.md').write_text('''# БРЕЙНРОТ ПОРТАЛ

Браузерная 3D-головоломка от третьего лица: порталы, физика и исходный живой спутник.
Реестр содержит 33 испытания. Уровни 1–30 сохраняют свои номера и сохранения.

## Исследовательская глава 31–33

- **31 — Световая развязка.** Один источник света становится двумя дорогами.
  Постоянная площадка позволяет перестроить мост; нижний этаж и пандус возвращают
  после ошибки. Проверяются перенос спутника, предварительная разведка и потеря моста.
- **32 — Запас хода.** Воздух через порталы раскручивает маховик. Его запас вращения
  питает нагруженные кабины; переключатель выбирает передачу, червячный привод
  удерживает высоту. Поддержаны подъём под потоком и подъём после разрыва связи.
- **33 — Обратный вектор.** Два настоящих падения и перелёта к противоположным
  галереям. Первая галерея открывает новый ракурс. Нижний проход физически открыт
  и ведёт к пандусу возврата, без скрытого переноса игрока.

Все три — закрытые лаборатории. Новые модели персонажа не подменяют исходные.
Старая оптимизация портальных шейдеров, принадлежность корпуса напольному порталу,
проверка прыжков по наклонам и возвращения со склонов сохранены.

## Открыть игру

Публичное демо: https://amazin20.github.io/brainrot-portal/

`?level=31` открывает новое испытание в основной кампании.
`?edition=open&level=31` открывает его в версии с отдельными сохранениями:
24, 28, 30, 31, 32, 33. Это не переделка всех старых уровней.
Проверенный опубликованный коммит указан в `build-info.json`.
Ветка разработки и работающая публичная версия могут различаться до завершения CI.

Управление: WASD — движение, мышь — обзор, Space — прыжок,
ЛКМ/ПКМ — два портала, E — взять/отпустить спутника либо использовать терминал.
Перед выстрелом спутника надо поставить на настоящую площадку.
Esc — пауза и выбор испытания. Телефон использует имеющиеся экранные кнопки.

## Разработка и проверки

```sh
npm ci
npm run dev
npm run check
node scripts/v8-package-check.mjs
```

Сборка: `npm run build`. Метаданные: `BUILD_COMMIT=$(git rev-parse HEAD)
node scripts/stamp-build.mjs v40-laboratory-33`.

`tests/lab-research-chapter.test.js` проверяет обычные и альтернативные маршруты,
восстановление, отсутствие скрытой энергии, частотную устойчивость маховика,
реальные перекрытия, открытый нижний проход и сохранение номеров.
`scripts/research-browser.mjs` повторяет маршруты в настоящем WebGL с исходными
моделями и сохраняет кадры. `ALTERNATE=1` включает разведку/возврат или запас энергии.
Старые исходные, браузерные, портальные и публикационные проверки не удалены.

Автоматическое прохождение не является ручным тестом интересности.
Запись 15 кадров на моделируемую секунду не является FPS устройства.
Проблема кадрирования камеры #58 и аппаратная оценка оставшихся фризов не закрыты
этой главой. Подробности: `docs/passes/RESEARCH_CHAPTER_31_33.md`.
''')
