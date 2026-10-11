# Изолированный фикс перехода камеры 50–51

Новый pipeline проверяет только последующий фикс камеры от принятого source `65207e98b463c03fa7614e04c2865aa471a37f7e`. Старые finale scripts, fixtures, review workflow и документация сохраняются побайтово. Существующий URL `/puzzle-progression-finale/`, metadata version/revision v1, query и префикс сохранений не меняются. Canonical L8 и все опубликованные адреса вне finale сохраняют каждый прежний байт.

Корректирующий source scope, floor `1678` и прежние native/movie evidence contracts зафиксированы: `SOURCE_FREEZE_READY=true`. Авторский camera file содержит восемь active top-level tests: шесть принятых и две дополнительные регрессии; root независимо проверил эти восемь тестов и неизменные финальные hashes. Это разрешает новый exact source review; candidate source и publication acceptance требуют будущих фактических Actions и независимой проверки их evidence. Private main controller до принятого нового review содержит `PENDING_EXACT_REVIEW` и нулевые run/attempt. Локальные fixtures не заменяют реальные Actions, downloaded artifacts и независимую проверку.

Исторический candidate `b21980e6a662d5743614e18eb32121ad306cc52b` / review `38106397795/1` не принят для публикации. Независимый native51 audit root при том же неподвижном игроке и относительной фазе показал `minY=-1.4084` и `15219` outside vertices вместо принятых `minY=-1.1877` и `7184`; даже успех всех шести jobs не снимает этот quality hold. Следующий source commit root готовит непосредственным ребёнком `b21980e6…` в той же source branch; проверяемый десятифайловый diff по-прежнему считается от принятого `65207e98…`. Опубликованная база остаётся `372e4831…`.

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

`build` создаёт один stamped package. `cpu` выполняет весь retained active suite с фактическим единственным TAP footer, где pass равен tests, а fail/cancelled/skipped/todo равны нулю; floor `1678` включает принятые 1676 и две новые camera regressions, включая differential ordinary51 без переноса игрока. JS и Python fixtures явно отклоняют прежний footer `1677`. Он также запускает прежние finale guard fixtures и новые camera guard fixtures. `native (50)` и `native (51)` скачивают один и тот же build и выполняют настоящие input-only маршруты, original models, controls, saves и непрерывные записи. `package` требует одинаковые game/assets bytes, source SHA, run и attempt всех evidence. `gate` собирает полный сайт без публикации: он сохраняет отдельную private копию 116 прежних finale файлов, заменяет только разрешённый finale namespace и сохраняет все 1507 outside files побайтово.

Обязательны исходный игрок со всеми `96753` vertices / `15` bones, неизменные player/cargo identities на каждом наблюдаемом route frame, joint victory, одна объявленная инициализация до маршрута, ноль reset/respawn внутри маршрута. Сохраняются настоящие desktop и emulated touch controls, pause/replay/Next и побайтовые прежние save namespaces.

Принятая movie50 имеет известное transient обрезание ботинок около zero-based кадра `499` (`124.75 s`). Итоговый physical east-gallery region имеет center `[9.926224685,6.28,-10.4976406]`, halfExtents `[1.15,1.25,1.15]` и требует три portal transports. Actual baseline witness encoded `499` / visual `7485` имеет player `[9.02811878236383,7.2478185499411625,-10.497957795932146]`, `11834` outside vertices и `minY=-1.3585925604714426`; он входит в итоговый region с вертикальным запасом около `0.282 m`. Прежняя halfY `.75` ошибочно исключала эту известную позицию и не является допустимым evidence contract. Geometry/schema fixtures в обоих языках явно проверяют inclusion witness, отклоняют прежний узкий region и proof, скрывающий его crop как результат вне gallery. Их synthetic projections и frame context не считаются native доказательством.

Новый native observer измеряет живую модель на каждом active visual step внутри этого bounded known-crop/falling-gallery region; movie observer измеряет живую модель на каждом закодированном sample `4 fps`. Package guard требует непустые фактические samples в целевом region, исходные 96753 vertices, согласованные counts/indices/projections и отсутствие crop в этом конкретном region. Initial encoded `498` и весь arrival window из `181` visual steps не заявлены включёнными. Baseline encoded samples `499–500` входят в region, один из двух имеет crop; parent-reviewed corrective local window содержит 32 foot samples `22–53` внутри region. Эти локальные foot measurements не заменяют будущие native body projections. Old settled milestone proof и пустые arrays не закрывают дефект.

Native report и оба guards требуют одну и ту же точную scope string: `Every active native visual step inside the fixed physical east-gallery falling/retraction region after the third transport; not all portal, route, render, movie frames or physical devices.` Fixtures задают этот contract независимо от guard constant. Исторический source `3bc925af139589b8b32a8725390fe44029703f2e` / review `38109246840/1` остановил native50 на несогласованной прежней строке `foot region`; partial browser artifact не содержит завершённой movie50. Его native51 job завершился успешно, но review не является принятым six-job proof. Новый exact child source обязан пройти все шесть jobs заново; floor `1678` и physical region не меняются.

Обе записи остаются continuous input-only, `640×360`, `4 fps`, с первой visual frame `0`, финалом `won`, SHA-256/размером и полным FFmpeg decode с `-xerror`. Sampled camera proof относится к описанному window и encoded samples; он не доказывает кадрирование всех render frames, blind human usability или performance реального телефона. Возможные другие crops остаются явным результатом report.

## Единственный main controller и сохранение сайта

После принятия exact source review root готовит ровно один main commit: M существующего `.github/workflows/publish-puzzle-progression-finale.yml`, единственный непосредственный parent `372e4831…`. Новый main publisher workflow не добавляется. Main сохраняет остальное дерево принятого publisher; игровой source остаётся на отдельной ветке. Controller checkout и команды используют новые versioned camera guards/QA. Source guard сохраняет старые pipeline paths без изменений.

`assemble` проверяет fresh current main/source heads, exact six successful source jobs и их raw log hashes, текущую review attempt, checksum-verified production и retained-baseline artifacts, accepted current Pages deployment `372e4831…/38093246009` и отсутствие overlap. `deploy` проверяет все 1623 текущих публичных файла, затем повторяет guards непосредственно перед deployment. POST проверяет actual union из неизменных 1507 outside files и нового reviewed candidate плюс ровно два generated файла: `preview-status.json` и `walkthroughs.html`. POST count и bytes выводятся из реального manifest; прежний итог 1623 не служит floor для нового candidate.

Старые 116 finale файлов, включая movies и reports, сохраняются в private `proof/prior-finale/` с отдельным manifest source/review/publisher/publication identity и hashes. После deployment требуются реальные public routes 50 и 51, actual bytes/models/controls/saves и просмотр root выбранных images. Оба publication jobs связаны с source/review/publisher/run; standalone source markers обязательны в шести source jobs, а publication jobs проверяются по prepare/deploy guard receipts и provider logs.

Frozen JS `reviewGuard` проверяет присутствие marker как substring. Независимый обязательный root audit сильнее: в каждом из шести decoded provider logs должна быть ровно одна standalone строка `PROGRESSION_FINALE_SOURCE <exact source> REVIEW <run>/<attempt>`, с сохранённым raw UTF-8 hash. Source acceptance receipt явно различает automated substring check и фактически выполненный manual standalone audit. Сам по себе automated check не объявляется этой более строгой проверкой; его дальнейшее усиление остаётся отдельной задачей.

Новые artifact names начинаются с `puzzle-progression-finale-camera-` и включают точные run/attempt. Pages concurrency остаётся общей `pages`, cancel-in-progress `false`; параллельная публичная публикация физики 41 не запускается.

Полная камера, художественная/пользовательская приёмка, hardware UX, все возможные input paths и master/Tower500 остаются отдельными задачами. Новый bounded camera proof не меняет эти границы.

## Ограниченный оптический фикс

Корректирующий fit включается только при настоящем наклоне transported `viewUp` более `0.01` rad. Финальная collision-constrained линза проверяет authored silhouette envelope после retract и portal-roll; widening повторно проверяет near-plane collision volume. Negative ordinary51 differential использует одинаковые реальные production physics states и требует точного совпадения camera position, FOV и spring с принятой камерой `65207e98…` при отсутствии переноса игрока. `portalExit` сам по себе не включает fit. Центр прицеливания, обычная кампанийная камера и нулевой elapsed time сохраняются. Конечный бюджет 102° выбран по воспроизведённой потребности и не считается универсальной гарантией. Headless loader не содержит native skin weights/animations: локальные optical замеры не заменяют обязательные будущие live96753/15 native и movie доказательства. Исправление не принято до нового exact source review и независимого просмотра его actual evidence; полная пользовательская и аппаратная оценка transient widening остаётся открытой.
