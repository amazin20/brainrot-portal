# Отдельная проверка пикселей архивного уловителя на L

Статус: исследовательский workflow подготовлен для ревью. Нативный запуск этого checker, загрузка workflow, dispatch и публикация не выполнялись. Исходники игры и существующий `verified-build.yml` не изменены. Это потребитель готового пакета; он ничего не собирает и не штампует заново.

Замороженная игра: `8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e`, tree `1bb0546cb29fe6919209103ece67d20a7ddb2377`, run `37733898439`, attempt `1`. Пакет `campaign-browser`, artifact `11531051164`, outer ZIP SHA-256 `c67d6ece4c65d0fe0f762626c5107fc32d7238974fe2c03a194bb831f055bf4a`, 4 315 287 байт. Исходный список из 277 build inputs имеет SHA-256 `dfaa06820a807f14a0c9bcb321f165912335716c533b03ddb249c6303789c93a`; inventory пакета — `c6d43e3a84c769fc72e5793c0328345da17eb8b7dc817993f99fb5ddf1f3b665`. Все фиксированные значения, включая build-info, существующий workflow, controls и input, находятся в `scripts/lib/castle41-native-plan.mjs`.

## Непрерывный обычный заход

Один настоящий Play в foundation41. Сохраняются исходные cargo, Cannon body, physics и объект позиции игрока; наблюдаются обычные reset/respawn/resetCargo. После Play можно потерять часть стартовых wall frames до остановки animation loop: фактический bootstrap и исходный elapsed сохраняются, дальнейшие тики учитываются полностью. Проверяется положение у авторского spawn, используются существующие production collision, gravity, input handlers и camera rig.

Один вызов **существующего** `__NESI_RUN_LEVEL_ROUTE__()` без `order`, `stopAfter` или изменения исходников выполняет порядок freight → sluice → optics → hoist → archive → flywheel → magnet → migrant → pendulum → inertia → crown. Повторные частичные вызовы отвергнуты: исходный Journey требует `completedStages===0`. Проверка не отменяет этот guard.

Первый обход к архиву и обратно происходит до вызова Journey. Два последующих обхода ставятся в очередь синхронным milestone observer. Только awaited `__SINGULARITY_FLUSH__`, следующий за `Solved sluice` / `Solved optics`, останавливает уже ожидающий driver между routines. `__SINGULARITY_FRAME__` исключительно считает кадры; из него не запускается перемещение. Во время обхода возвращается сохранённая ссылка на исходный `getMove`, чтобы **настоящие** Puppeteer keydown/keyup и pointer-lock mousemove проходили через неизменённый `InputController`/`LabControls`. После обхода восстанавливается та же временная ссылка production Journey. Все движения к координатам являются целями для обычной ходьбы, никогда присваиванием позиции.

Production Journey по-прежнему использует собственный штатный scripted adapter и camera intent. Новые обзорные движения выполняются мышью; checker не пишет `camera.position`, quaternion, FOV, boom, player/cargo pose или velocity, portal state, source state, solved flags, время или dt. Это автоматизированный ordinary route, а не доказательство ручного прохождения. Дополнительные тики меняют естественную фазу движущихся механизмов и длительность захода; число 62 574 из исходного L CI не обещается для этого расширенного маршрута.

## Конечный набор кадров

| Состояние | Кадры | Ожидаемая физическая связь |
| --- | ---: | --- |
| zero | 3 | Обзор основания/общего header/двери и две детали зубьев; оба источника 0, стопы 0, проход закрыт |
| one-sided | 4 | Водяной источник и три вида архива; hydraulic stop1, optical stop0, проход закрыт |
| both-latched | 4 | Настоящий optical receiver и три вида архива; оба raw источника 1, стопы 1, реальный зазор >6,9 м |
| optical source after E | 1 | После обычного E у исходного зеркала: optical raw0, hydraulic raw1, оба стопа и дверь удерживаются |
| both-off | 4 | После обычного E sluice0→2: реальное [5,5,0]→[2,5,3], течение завершено, height <−4,97; оба raw0, стопы1, зазор >6,9 м |
| exit | 1 | После физического прохода через исходные leaves: игрок grounded у [−28,18,30], оба источника выключены |
| victory | 1 | Фактический финальный кадр обычной joint victory того же игрока и груза |
| Всего | **18** | Снимки не являются непрерывным видео |

Положение для общего вида — обычные ноги [−10,18,30], для деталей [−17,18,30]. Native мышь центрирует реальные целевые точки. Физическая camera collision и персонаж могут заслонить аппарат; checker не обходится forced camera или CSS. Center projections и mesh visible flags записываются как геометрические сведения и **не доказывают** читаемые пиксели. Статические оригиналы fittings после production batching невидимы; snapshot также ищет соответствующие реальные видимые instances по geometry/material/world matrix, чтобы не перепутать proxy с исчезнувшим основанием.

Снимок идёт через неизменный L `captureBrowserFrame(...,{canvasOnly:true})` после настоящего `g.render()`: native WebGL2 PBO/fence или его объявленный native canvas fallback. Сверяются полные before/after физические состояния, camera, clocks, teeth matrices, actual leaves и Cannon targets; render draw-call diagnostics могут обновиться. В JPEG входят только production canvas pixels, без HTML. Blank/timeout, потеря lock, превышение лимита, отказ состояния или маршрута сохраняют фактическую failure state и при возможности failure-current.jpg. Видимость основания/зубьев/двери остаётся отдельным ревью настоящих изображений.

Ограничения: 18 заявленных кадров, максимум 30 000 detour visual ticks и 120 000 всех visual ticks, 5 400 ticks на leg, 60 итераций наведения, 600 ticks ожидания поддержки, 20 000 наблюдаемых input events и 45 минут wall deadline; workflow имеет 60 минут с установкой/скачиванием/выгрузкой. Каждый visual tick использует существующие 2 × 1/120 physics и 1/60 visual update, без пропуска simulation ticks. Observer отдельно считает route/detour/total; elapsed имеет миллисекунды и сверяется с количеством physics ticks. Только два новых E должны быть настоящими `KeyE`. Возврат к handoff выполняется обычной ходьбой.

## Проверка пакета и дальнейший запуск

`fetch-l-castle41-package.py` проверяет GitHub run/source/attempt и metadata точного artifact ID, фактический outer ZIP SHA/size/CRC и безопасную распаковку. Секретный URL не выводится; Authorization удаляется на redirect. `verify-l-castle41-package.mjs` проверяет отдельный clean checkout L, tree, helper/input/controls/workflow hashes, build-info SHA и **полную** stamped metadata/inventory по исходному manifest code, затем повторяет проверку после маршрута. Research checker также фиксирует свой commit/tree/file hashes и отклоняет незакоммиченный код или изменённые production build inputs.

Workflow `castle41-native-capture.yml` имеет `push` только для `research/l-castle41-native` с фильтром семи перечисленных checker files, а также сохраняет `workflow_dispatch`. Job дополнительно проверяет точный ref; permissions contents/actions read. Push/dispatch выполняет владелец после ревью: локальный commit не является запуском. Для ручного dispatch GitHub registration/default-branch availability проверяется отдельно. Upload-artifact step выполнится только в реально начатом будущем запуске. Существующий full-source/51-room pipeline не затрагивается.

Локально действительно выполнены: source inspection; синтаксис двух checker modules; Python compile; YAML parse и проверка dispatch/read permissions; 4 независимых теста supported ramp routing / disconnected graph / ложного one-sided / ложного retained passage; проверка реального ранее скачанного frozen ZIP и всех build files/manifest против clean L. Полный выбранный набор из 55 source fixtures (4 новых плюс существующие castle/Singularity fixtures) прошёл, включая существующий полный canonical headless route и обычные freight/hoist/reset regressions. Это выполнение существующего Node regression driver, а не выполнение новых native detours. **Нативного запуска этого checker и новых пикселей пока нет.**

Портрет, отдельный portal-view архива, KeyR/reset native pixels, hardware performance, дизайнерская/человеческая приёмка и требуемые 500 содержательных этапов этим протоколом не закрыты. Первый root-reviewed native запуск должен проверить фактические кадры, особенно тонкие зубья, опоры и оба source views; если они закрыты, следующий шаг — ограниченный ordinary camera/view refinement с сохранением failure evidence.
