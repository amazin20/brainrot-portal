# Изолированный фикс перехода камеры 50–51

Новый pipeline проверяет только последующий фикс камеры от принятого source `65207e98b463c03fa7614e04c2865aa471a37f7e`. Старые finale scripts, fixtures, review workflow и документация сохраняются побайтово. Существующий URL `/puzzle-progression-finale/`, metadata version/revision v1, query и префикс сохранений не меняются. Canonical L8 и все опубликованные адреса вне finale сохраняют каждый прежний байт.

Source scope, регрессия камеры, floor 1677 и native/movie evidence contracts зафиксированы: `SOURCE_FREEZE_READY=true`. Это разрешает проверку кандидата; новая source и publication acceptance всё ещё требуют фактических успешных Actions. Private main controller до принятого review содержит `PENDING_EXACT_REVIEW` и нулевые run/attempt. Локальные fixtures не заменяют реальные Actions, downloaded artifacts и независимую проверку.

## Принятая текущая база

| Предмет | Pin |
| --- | --- |
| Repository | `amazin20/brainrot-portal` |
| Source base / prior finale source | `65207e98b463c03fa7614e04c2865aa471a37f7e` |
| Принятый source review | `38089244970/1`, шесть успешных jobs |
| Принятый active TAP | `1676/1676`, без fail/cancel/skip/todo |
| Текущий main / accepted publisher | `372e483111542dc4f505e30356fb0999bb5a6f15` |
| Принятая публикация | `38093246009/1`, два успешных jobs |
| Полный текущий сайт / PRE | `1623` файла / `531150862` байта |
| Неизменяемые outside files | `1507` / `518160875` |
| Текущий finale для private backup | `116` / `12989987` |
| Принятый Pages artifact | `11685320033`, `github-pages`, `494852251` байт |
| SHA-256 принятого ZIP | `2001c3acd5b0a96a63bce484209ebc68b7639c6eef5d31a27b98767345fe76fc` |
| Исходный expiry provider artifact | `2026-10-24T22:56:41Z` |
| Новый source branch | `upgrade/finale-camera-transition-20261011` |
| Новый review workflow | `.github/workflows/puzzle-progression-finale-camera-review.yml` |
| Единственный main controller path | `.github/workflows/publish-puzzle-progression-finale.yml` |

Принятый Pages ZIP сохраняется в новой review attempt до его исходного expiry. Provider metadata, размер и digest проверяются до извлечения; полный TAR, все paths/types/limits и accepted baseline metadata проверяются независимо. Архив прежнего publisher `5666f9ef…` не является текущей базой.

## Точный source scope

Зафиксированный diff от `65207e98…` содержит ровно десять обычных blob paths с mode `100644`:

- M: `src/game/LabCamera.js`, `tests/lab-camera-finale-framing.test.js`.
- A: `scripts/qa-puzzle-progression-finale-camera-browser.mjs`, `scripts/record-finale-camera-walkthrough.mjs`.
- A: оба `scripts/publish-puzzle-progression-finale-camera.{mjs,py}` и оба `scripts/test-publish-puzzle-progression-finale-camera.{mjs,py}`.
- A: новый review workflow и эта документация.

Guard проверяет cardinality, полный список paths, status, mode и type; лишний, отсутствующий, переименованный или executable файл отклоняется. Shared workspace не определяет release scope: root собирает отдельное GitDataTree от точного source base только с этими paths. Kernel, helpers, tests и playable qualification 41-й комнаты остаются отдельным candidate. `LabGame`, oriented beam physics, Journey50/51, art, models, package dependencies, canonical game и прежние release pipelines в этот camera diff не входят.

## Шесть jobs и новые доказательства камеры

`build` создаёт один stamped package. `cpu` выполняет весь retained active suite с фактическим единственным TAP footer, где pass равен tests, а fail/cancelled/skipped/todo равны нулю; floor `1677` включает принятые 1676 и одну новую camera regression; source freeze включает этот floor. Он также запускает прежние finale guard fixtures и новые camera guard fixtures. `native (50)` и `native (51)` скачивают один и тот же build и выполняют настоящие input-only маршруты, original models, controls, saves и непрерывные записи. `package` требует одинаковые game/assets bytes, source SHA, run и attempt всех evidence. `gate` собирает полный сайт без публикации: он сохраняет отдельную private копию 116 прежних finale файлов, заменяет только разрешённый finale namespace и сохраняет все 1507 outside files побайтово.

Обязательны исходный игрок со всеми `96753` vertices / `15` bones, неизменные player/cargo identities на каждом наблюдаемом route frame, joint victory, одна объявленная инициализация до маршрута, ноль reset/respawn внутри маршрута. Сохраняются настоящие desktop и emulated touch controls, pause/replay/Next и побайтовые прежние save namespaces.

Принятая movie50 имеет известное transient обрезание ботинок около zero-based кадра `499` (`124.75 s`). Новый native observer измеряет живую модель на каждом active visual step в точном physical east-gallery region после третьего portal transport; movie observer измеряет живую модель на каждом закодированном sample `4 fps`. Package guard требует непустые фактические samples в целевом gallery region, исходные 96753 vertices, согласованные counts/indices/projections и отсутствие crop в этом конкретном region. Old settled milestone proof и пустые arrays не закрывают этот дефект. Контракты включены в source freeze; нативная проверка остаётся обязательной.

Обе записи остаются continuous input-only, `640×360`, `4 fps`, с первой visual frame `0`, финалом `won`, SHA-256/размером и полным FFmpeg decode с `-xerror`. Sampled camera proof относится к описанному window и encoded samples; он не доказывает кадрирование всех render frames, blind human usability или performance реального телефона. Возможные другие crops остаются явным результатом report.

## Единственный main controller и сохранение сайта

После принятия exact source review root готовит ровно один main commit: M существующего `.github/workflows/publish-puzzle-progression-finale.yml`, единственный непосредственный parent `372e4831…`. Новый main publisher workflow не добавляется. Main сохраняет остальное дерево принятого publisher; игровой source остаётся на отдельной ветке. Controller checkout и команды используют новые versioned camera guards/QA. Source guard сохраняет старые pipeline paths без изменений.

`assemble` проверяет fresh current main/source heads, exact six successful source jobs и их raw log hashes, текущую review attempt, checksum-verified production и retained-baseline artifacts, accepted current Pages deployment `372e4831…/38093246009` и отсутствие overlap. `deploy` проверяет все 1623 текущих публичных файла, затем повторяет guards непосредственно перед deployment. POST проверяет actual union из неизменных 1507 outside files и нового reviewed candidate плюс ровно два generated файла: `preview-status.json` и `walkthroughs.html`. POST count и bytes выводятся из реального manifest; прежний итог 1623 не служит floor для нового candidate.

Старые 116 finale файлов, включая movies и reports, сохраняются в private `proof/prior-finale/` с отдельным manifest source/review/publisher/publication identity и hashes. После deployment требуются реальные public routes 50 и 51, actual bytes/models/controls/saves и просмотр root выбранных images. Оба publication jobs связаны с source/review/publisher/run; standalone source markers обязательны в шести source jobs, а publication jobs проверяются по prepare/deploy guard receipts и provider logs.

Новые artifact names начинаются с `puzzle-progression-finale-camera-` и включают точные run/attempt. Pages concurrency остаётся общей `pages`, cancel-in-progress `false`; параллельная публичная публикация физики 41 не запускается.

Полная камера, художественная/пользовательская приёмка, hardware UX, все возможные input paths и master/Tower500 остаются отдельными задачами. Новый bounded camera proof не меняет эти границы.

## Ограниченный оптический фикс

Финальная collision-constrained линза проверяет authored silhouette envelope после retract и portal-roll; widening повторно проверяет near-plane collision volume. Центр прицеливания, обычная кампанийная камера и нулевой elapsed time сохраняются. Конечный бюджет 102° выбран по воспроизведённой потребности, а не считается универсальной гарантией. Обычный CPU-маршрут 50 завершён с исходными актёрами; в целевом region 28 замеров foot anchor без crop, более 88° используется 0,35 с, предел 102° — 0,1833 с. Headless loader не содержит native skin weights/animations: эти optical замеры не заменяют требуемые live96753/15 native и movie доказательства. Полная пользовательская и аппаратная оценка transient widening остаётся открытой.
