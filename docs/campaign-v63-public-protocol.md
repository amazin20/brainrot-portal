# Протокол публикации и производных документов v63

Этот документ и каталог сгенерированы только после Root-issued PUBLIC acceptance. Генератор не делает запросов, не запускает игру, не пересобирает пакет, не пишет квитанции приёмки и не публикует сайт.

## Точные входные байты

| Вход | Байт | SHA256 |
| --- | ---: | --- |
| Root PUBLIC JSON | 26895 | `17ff27eb380ee7dbd244ee309481eb8c29220ae0171a6f6de17f9a81aa83ec6e` |
| Root SOURCE JSON | 94376 | `2ae75756ca6891e8698090e965cf81f9ceeb655d60004cda6f97ea8d415a5ece` |
| Независимый Public draft | 24545 | `4cf61a2d5282ff5413379fbfe3aaa2803e48cde26fd5bc09c4379bd478e7b7b0` |
| Original preparation.json | 1501837 | `ce6e06a23f2b9974bd64c72146a2f0ff9d880dd27f5429ec0e12df27ef03a364` |
| Original final-publication.json | 809182 | `181a6a27a72329818a05cad6f9708fa28b5fa71f1333537d63c576a7a282ece2` |
| Frozen release config | 18507 | `79e806f3ddbe2034da8d47e402358985e0de2409739b1bd2bd472e47394f4906` |
| Accepted v62 catalog | 994206 | `e5d36ae12354ec7fea8c86a187d5a044fdf29ecec669789b8fe85b9f12c17994` |

Source commit `a60a31dfd4c624d6d60f4c33111d315b3bc44aa6`, tree `47e3de85ee814f18020514faf2614b9c4da37d12`; Source run `39411608067/1`. Publisher `21f54a9f6ef63a7e18e4a2002565ec1616879eb9`, tree `6383f71b4ca942b0e5486f578a492e07df15a0d9`; Public run `39420466757/1`.

Первая PUBLIC-попытка [39416100725/1](https://github.com/amazin20/brainrot-portal/actions/runs/39416100725) завершилась ошибкой внешнего наблюдателя при подготовке мобильного окна и не принята. Исправлен Main-наблюдатель и добавлена проверка повторной публикации; принятый Source не менялся. Новый полный PUBLIC-прогон и новый deployment повторно публикуют все 2686 файлов без изменения ни одного байта. Исходный `publication-provenance.json` сохраняет producer `7feee7351bc2be2cdee708cae0e7a305bca6567c` первой поставки; текущие preparation/final/Root-квитанция отдельно указывают новый publisher/run.


## Неизменяемая поставка

Consumer-байты перенесены из принятого Source-артефакта без пересборки и переписывания `build-info.json`. Исходный stamp остаётся `verified:false`; самостоятельная Root-приёмка хранится отдельно. Каталог содержит исходные preparation `unionFiles` и их точные размеры/SHA256.

| Набор | Файлов | Байт | Inventory SHA256 |
| --- | ---: | ---: | --- |
| Исторический baseline | 2605 | 690702631 | `2ecbf5a2b61c5b0fd8366f833c6670672f3447a16db3fd36464088291421190e` |
| Принятый consumer | 80 | 7195304 | `9db5aff37caff72d3f770daf9a3c14983cc9a1b63286a17d50e6c5378d9754ac` |
| Публичный union | 2686 | 697909952 | `2b94cf95c7e41a9d5d0d35cb305fb2ecb25a70e6884714c1f1460d97b767ffc8` |

Сохранён каждый прежний файл, включая root entry; новый canonical URL — `https://amazin20.github.io/brainrot-portal/campaign-v63/`. Добавлены только точный consumer-пакет в `campaign-v63/` и один `publication-provenance.json`. Производные README/docs/catalog не участвуют в Pages-пакете и не меняют принятые игровые байты.

Root проверил terminal API cohort, исходные журналы и provider-bound ZIP/CRC/closures. `github-pages` — **metadata-only, payload не скачан**; независимого перерасчёта ZIP SHA/CRC/union из этого payload нет. Этот предел сохраняется и в каталоге. Полная HTTP-сверка historical+new union — оригинальная CI-проверка, не новый post-CI GET.

## Участки с разной строгостью

Общие ordinary/native51 routes используют prior-prefix QA saves; текущая целевая комната в них ещё не пройдена. Сброс в начале legacy fixture находится вне последующих journey counters. Точный scope:

```text
reported journey counters after legacy fixture initialization; the initial fixture reset is outside these counters; specialized drivers retain their own stricter proofs
```

Поэтому `normalUiZeroStepStartProven:false` для общей когорты. Отдельные десять continuous Optics nativeStart фильмов имеют собственный нормальный Play, нулевой шаг, исходные тела, покадровые/физические счётчики и полное декодирование каждого MP4. Это не доказательство слепого человеческого решения всех комнат.

Source UI разделяет успешный finished request и `net::ERR_ABORTED` с **полным проверенным телом того же actual CDP request**. Подтверждение включает ordinal, request ID, поколение документа, размер и SHA256; ошибка без такого тела остаётся ошибкой. Конечные drain проверяют отсутствие pending/inflight до навигации/закрытия. Durable CDP buffer хранит исходный браузерный ответ, не заменяет его новым запросом.

Consumer, отдельный review SDK package и настоящий production Yandex ZIP имеют собственные точные inventories, хотя связаны одним Source HEAD/sourceInputs. Их байты и контексты не объявляются одинаковыми. Оригинальный сторонний checker не поставляется в production-игре. Его WARN/NOT VERIFIED сохранены; mock SDK/reward callbacks не устанавливают живую выдачу рекламы или модерацию.

## Deployment snapshot

Принят canonical final-CI deployment `7199379584` для `21f54a9f6ef63a7e18e4a2002565ec1616879eb9`. Независимый аудитор сверил исходные закрытые страницы API из финального CI и owning Public run. `independentPostCiDeploymentGet:false`; независимого нового запроса deployment после CI не выполнено. Это также не заявление о текущем live-состоянии после момента наблюдения.

## История и открытые требования

README обновлён из точного исходного blob `d312ad897f03f8618108aceb6a4e6cb7bffa6f09` (45667 байт, SHA256 `49012aa9d53094ecad4950d270839a40a8c10fedbdbb05cd5a43d01417b9ba6e`): заменена только ссылка актуальной кампании, новый раздел v63 вставлен перед v62. Весь исторический хвост от заголовка v62 сохранён байт-в-байт.

Замок содержит 12 проверенных механизмов и завершает кампанию под номером 51 (постоянный ID41). **500 содержательных уникальных этапов и минимум 15 минут человеческого спидрана остаются открытыми.** Человеческое открытие решений, аппаратный FPS и производительность реального телефона, все возможные обходы, ракурсы и переходы ориентации не приняты. Для комнаты 17 остаются открытыми портретное кадрирование и читаемость при мгновенном изменении экрана. Живая выдача рекламы, кабинет Яндекс Игр и модерация не проверены.
