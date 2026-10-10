# Изолированная серия 50–51: проверка и безопасная повторная публикация

Эта процедура обновляет уже принятые комнаты 50–51 по прежнему адресу `/puzzle-progression-finale/`. Замена разрешена только внутри этого namespace: прежние 115 файлов сохраняются отдельно в private proof, а все 1507 файлов снаружи должны остаться побайтово прежними. Принятые адреса основной игры, пилота 43, серии 44–46 и серии 47–49 сохраняют все опубликованные байты, включая прежние видеозаписи. Меню новой сборки предлагает комнаты 43–51; свежая техническая проверка и новые записи относятся только к 50–51.

Подготовленный pipeline и синтетические проверки сами по себе не означают, что новая версия принята или опубликована. Для этого нужны завершённые реальные запуски GitHub Actions, точный commit, текущая попытка запуска и независимая проверка скачанных артефактов.

## Зафиксированный принятый источник и публичный архив

| Предмет | Значение |
| --- | --- |
| Repository | `amazin20/brainrot-portal` |
| Принятый исходный commit 50–51 / source base | `b89fc2cfb2992cb3908d14982e51a75f723b3261` |
| Его source review | `38079889392`, attempt `1`, шесть успешных jobs |
| Его активный набор тестов | `1630/1630`, без failures, skipped или cancelled |
| Текущий main / publisher | `5666f9ef710045d2ada25d1f0bde6d7c71c939ca` |
| Принятая публикация 50–51 | `38084083371`, attempt `1`, два успешных jobs |
| Полный принятый публичный сайт / PRE | `1622` файла, `531306775` байт |
| Неизменяемые файлы вне finale | `1507` файлов, `518160875` байт |
| Разрешённый прежний finale namespace | `115` файлов, `13145900` байт |
| Pages ZIP artifact | `11680749760`, `495046295` байт |
| SHA-256 Pages ZIP | `175b34cd1efc644556347aa4c459e2e4708beb6899793df7fa1ee3c066e7b69c` |
| Canonical source основной игры | `8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e` |
| Новая source branch | `upgrade/puzzle-progression-finale-20261010` |
| Новый review workflow | `.github/workflows/puzzle-progression-finale-review.yml` |
| Новый адрес | `/puzzle-progression-finale/?edition=foundation&level=50&pilot=progression` |
| Новый префикс сохранений | `brainrot-puzzle-progression-finale-v1:` |
| Новая версия metadata | `v54-puzzle-progression-finale-v1` |

Diff follow-up сравнивается с принятым `b89fc2cf…`. `SOURCE_CHANGES` в guard содержит полный точный список; wildcard-пути не разрешены. Подтверждённый scope содержит ровно 20 обычных файлов: 14 изменённых и 6 добавленных. Runtime acceptance и окончательные байты проверяются отдельно:

- M: `src/game/LabGame.js`, `src/game/LabCamera.js`, `src/game/LabPuzzleProgression50.js`, `src/game/LabPuzzleProgression50Art.js`, `src/game/LabPuzzleProgression50Journey.js`, `src/game/LabPuzzleProgression51Art.js`, `docs/puzzle-progression50.md`;
- M: `scripts/qa-puzzle-progression-finale-browser.mjs`, `.github/workflows/puzzle-progression-finale-review.yml`, оба `scripts/publish-puzzle-progression-finale.{mjs,py}`, оба `scripts/test-publish-puzzle-progression-finale.{mjs,py}`, `docs/puzzle-progression-finale-publication.md`;
- A: `src/game/LabOrientedBoxContact.js`, `src/game/LabPuzzleProgression50BeamJourney.js`, `tests/lab-oriented-box-contact.test.js`, `tests/lab-room50-oriented-contact.test.js`, `tests/lab-puzzle-progression50-beams.test.js`, `tests/lab-camera-finale-framing.test.js`.

Статус каждого пути, blob type и mode `100644` проверяются точно. Удаления, переименования, symlinks, executable modes и любые лишние или пропущенные пути отклоняются. Последующий child commit должен сохранять полный frozen diff относительно принятого source.

Изменения общих `LabGame`/`LabCamera` ограничены opt-in поведением новой сборки. Публичные canonical и 43–49 сборки не пересобираются: pipeline берёт их из checksum-pinned принятого Pages архива, сохраняя каждый старый байт. Исходные Runtime, Art и Journey комнат 43–49 — 21 файл — и прежние publication pipelines совпадают с `b89fc2cf…`. Модели, Shared Physics, package и assets остаются вне allowlist. Canonical, pilot, 44–46, 47–49 и прежний finale имеют отдельные source/publisher/review/publication pins.

## Source review: шесть реальных jobs

1. `build` выполняет `npm ci`, один production build и его stamping с фактическими source commit, run ID, attempt и SHA-256 таблицы файлов. Эта сборка используется во всех последующих native-проверках и записях.
2. `cpu` сохраняет checksum-pinned принятый Pages ZIP до истечения срока хранения и выполняет весь `npm test`. Floor `1676` фиксируется в `PINS.minimumTests` и `MINIMUM_TESTS`: принятые 1630 плюс 46 новых active tests (math 32, contact controller 7, beam journey 1, camera 6). Требуется фактический итог TAP, где passed равен tests, fail/skipped/cancelled/todo равны нулю. Лимит job — 90 минут. Затем запускаются отдельные проверки publication guards и безопасной сборки архива.
3. `native (50)` загружает тот же build artifact, сверяет все кодовые и asset-байты, проходит уровень обычными вводами в настоящем браузере и выполняет проверку моделей, меню, replay, Next, pause/resume и сохранений.
4. `native (51)` делает такую же независимую проверку второй комнаты. Next из 50 должен открывать 51, из 51 — 43.
5. `package` получает CPU, оба native-отчёта и обе непрерывные видеозаписи из этой же попытки review. Он требует совпадения исходных game-файлов с единственным build и складывает доказательства в production package.
6. `gate` собирает полный сайт из сохранённого принятого архива и нового package, проверяет весь old baseline из 1622 файлов, сохраняет старые 115 finale файлов и pinned inventory в private proof, затем заменяет только finale namespace. Все 1507 файлов снаружи сохраняются точно; новая сборка должна совпадать с reviewed candidate и ровно двумя generated publication files. Он ничего не публикует.

Для каждой комнаты native observer проверяет исходного игрока и исходное тело спутника на каждом кадре маршрута. Допускается одна явно описанная инициализация до первого кадра; внутри маршрута требуется ноль reset/respawn. Сырые сохранения четырёх прежних пространств — основной игры, пилота 43, серии 44–46 и серии 47–49 — должны остаться побайтово прежними на desktop и в эмулированном мобильном браузере.

В `cameraMilestoneReview` native-отчёт дополнительно измеряет проекции всех 96753 живых вершин исходной модели на milestones маршрута и отдельно сохраняет консервативные Box3-проекции. Sample counts и список cropped milestones описывают наблюдаемое кадрирование; общий gate прохождения всех camera milestones не вводится. Проверка каждого кадра видеозаписи и UX камеры на физическом устройстве остаются отдельными задачами.

Эмулированный мобильный браузер 390×844 использует настоящие touch-события. Проверяются ввод и фактические координаты движения игрока, прыжок, переключение спринта, отпускание стика и pause/resume. Это не замер производительности на физическом телефоне.

Обе записи используют ту же production-сборку и обычную камеру от третьего лица: 60 Гц игрового маршрута, 120 Гц физики, непрерывный захват 4 кадра/с, 640×360. Проверяются начало с visual frame 0, финал won, полная декодируемость H.264 через FFmpeg, точный размер, SHA-256 и отсутствие пустых кадров. Запись не является замером FPS устройства или слепым человеческим прохождением.

Все шесть jobs должны быть `completed/success` в одной текущей попытке review. Реальный GitHub API должен подтверждать branch, workflow path, source SHA, run ID, attempt и каждое имя job. В логах каждого job обязателен marker `PROGRESSION_FINALE_SOURCE <commit> REVIEW <run>/<attempt>`. Ни более ранний успешный запуск, ни отменённый запуск, ни локальный build эту проверку не заменяют.

## Публикация: один controller и два jobs

До завершения source review private controller содержит `PENDING_EXACT_REVIEW` и нулевые run/attempt. Эти значения отказывают в публикации. После успешной проверки в controller подставляются только фактические accepted source commit, run ID и attempt.

На `main` изменяется ровно один уже существующий файл `.github/workflows/publish-puzzle-progression-finale.yml` со статусом M. Его единственный непосредственный parent — принятый publisher `5666f9ef…`. Статус A, другой parent и изменение других main-файлов отклоняются. Игровой source остаётся на своей ветке; main не подменяется новой source-сборкой.

`assemble` проверяет текущие main и source heads, реальный успешный source review, все его jobs и логи, конкретные artifact IDs и ZIP checksum, актуальное принятое Pages deployment и отсутствие пересекающейся публикации. Он загружает только production package и retained baseline из этой же review attempt, восстанавливает весь принятый сайт и заменяет только существующий finale namespace. Аргументы assembly теперь фиксируют `--baseline-source b89fc2cfb2992cb3908d14982e51a75f723b3261 --baseline-publisher 5666f9ef710045d2ada25d1f0bde6d7c71c939ca --baseline-run 38084083371`; canonical source 8d2… проверяется отдельно.

`deploy` непосредственно перед deploy повторно сверяет все 1622 прежних публичных файла, включая старый finale. Baseline и PRE явно проверяют прежний finale source `b89fc2cf…`, review `38079889392/1`, publisher `5666f9ef…`, publication `38084083371`, v1 save prefix и query. PRE report связан с полным baseline inventory SHA-256; частичный или stale inventory отклоняется. На последнем gate снова проверяются heads, попытка review и отсутствие другого Pages deployment. После deploy проверяется точный union из 1507 сохранённых outside-файлов и нового namespace (весь exact candidate плюс `preview-status.json` и `walkthroughs.html`), сверяемый с полным inventory, metadata и source identity; затем выполняются оба реальных публичных native-маршрута 50–51 с той же проверкой моделей, управления и сохранений.

Публичный `build-info.json` новой игры остаётся точной частью проверенного package с `publisherCommit: null`. `preview-status.json` содержит фактический publisher, publication run, source review и scope. Metadata и видеозаписи адресов вне finale не переписываются. Finale сохраняет прежние URL, version/revision v1, query и `brainrot-puzzle-progression-finale-v1:`; его metadata и новые записи связаны с новой текущей review attempt.

Артефакты имеют имена с точными run/attempt:

- `puzzle-progression-finale-build-<review>-<attempt>`;
- `puzzle-progression-finale-cpu-<review>-<attempt>`;
- `puzzle-progression-finale-baseline-<review>-<attempt>`;
- `puzzle-progression-finale-native-50-<review>-<attempt>` и `…-51-…`;
- `puzzle-progression-finale-production-<review>-<attempt>`;
- `puzzle-progression-finale-review-proof-<review>-<attempt>`;
- `puzzle-progression-finale-prepared-<publication>-<attempt>`;
- `puzzle-progression-finale-publication-proof-<publication>-<attempt>`.

ZIP/TAR paths, типы файлов, повторяющиеся имена, links, размер, checksum и пересечения директорий проверяются до извлечения и сборки. Принятый baseline обязан содержать ровно 115 pinned finale-файлов с прежней identity. Их байты сохраняются в `proof/prior-finale/`, а пути/размеры/hashes и source/review/publisher/publication — в `proof/prior-finale-manifest.json`. Full baseline, неизменяемые outside-файлы, прежний finale и новый namespace имеют отдельные inventory-поля в manifests. PRE использует весь старый inventory, POST — exact outside/new union. Это также добавляет около 13.1 MB в private prepared/publication proof artifacts.

## Что остаётся отдельной работой

Эта процедура подтверждает известные автоматизированные маршруты, байты сборки и опубликованного сайта, исходные модели и эмулированные controls. Она не закрывает полное master-ТЗ, все возможные обходы, слепые человеческие проверки, художественную приёмку и производительность на реальных устройствах. Длительность записанного известного маршрута не доказывает время первого человеческого прохождения.
