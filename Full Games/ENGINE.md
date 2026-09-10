# DiVANEngine: состояние реализации

Это доработка существующей 2D-игры на Canvas. Она пока не является законченным универсальным движком или готовым AAA-релизом.

## Подключение

Клиент читает исходную игру из каталога, выбранного `contentRoot()`. Протокол узнаёт хост по имени файла (`rnr.html`, `Editor.html`) и по meta `divan-engine`. Текст функций в HTML больше не сканируется.

В страницу вставляется `__DIVAN_ENGINE_META__` из `config/engine.json` + `config/game.json`, затем `src/engine/runtime.js` и модули хоста. Модули меняют именованные хуки через `DiVANEngine.replace` / `wrap`.

- `runtime.js`: ABI, схема контента, реестр хуков.
- `cheats-gate.js`: хуки `cheatsAllowed` / обёртка `submitCheat`. В упакованном NSIS пункт «ЧИТЫ» скрыт.
- `math.js`: хуки `angDiff` / `wrapBetween` / `mulberry`. `clamp` / `lerp` остаются `const` в HTML.
- `persist-io.js`: хуки `persistRead` / `persistWrite` / `persistDrop`.
- `persist-save.js`: хуки `newSave` / `persist` / `loadSave`.
- `settings-io.js`: хуки `normalizeSettings` / `loadSettings`. Раскладка `DEFAULT_CONTROLS` остаётся в HTML.
- `skills.js`: хуки `skillT` / `skillVal` / `SKILL_DESC` / `charEff`. Каталоги `SKILL_*` и `STAT_*` остаются в HTML.
- `catalog.js`: лента автопарка (`carCatalogOrder` / `carCatalogAt`).
- `cars-own.js`: владение кузовом, `blankTune`, `applyCharCar`. Каталог `CAR_UNLOCK` остаётся в HTML.
- `stats.js`: хук `stats` (ХП, скорость, сцепление).
- `gfx.js`: хуки `rr`, `panel`, `txt`, `layoutLines`, `wrapText`, `fm`.
- `view-cam.js`: хуки `raceZoom` / `updateView` / `applyResolution`. Каталог `RESOLUTIONS` остаётся в HTML.
- `fx-util.js`: хуки `partN` / `doShake`.
- `theatre.js`: хуки фона театра, трофеев и тоста эфира.
- `boot.js` / `boot-net.js` / `boot-gate.js`: очередь заставки, сеть, жест и `bootGo`. На десктопе внешний http(s) заставки не качается.
- `track.js`: хуки `buildTrack`, покрытие, лужи.
- `track-paint.js`: хуки `prerender`, тайлы земли, полигон лаборатории.
- `race-hazards.js`: хуки трамплинов и опасностей сплайна.
- `race-build.js`: хуки `buildRace`, `makeRacer`, погода, клетка старта.
- `race-ai.js`: тюнинг, навык и гандикап ИИ по дивизиону.
- `race-class.js`: хук `fieldCarClassOk`. Диапазоны `STARTER_*` / `MID_*` остаются в китах.
- `race-field.js`: сетка заезда, кэфы, касса ставки. Пустой пул не снимает фильтр класса дивизиона.
- `race-finish.js`: хуки `finishRacer`, `showResults`, приз и трофеи.
- `combat-fx.js` / `combat.js`: искры, взрыв, `dmgRacer`, смерть, респаун, нитро, мина.
- `weapons.js` / `weapons-fire.js` / `weapons-tick.js`: магазин, урон, `fireWeapon`, `useUlt`, тик кита. Каталог `CAR_ABIL` остаётся в `combat-kits.js`.
- `ai-think.js`: хуки `aiThink` и `finishDrive`.
- `race-progress.js`: хук `advanceIdx` (круг и финиш по кругам).
- `car-hit.js`: хуки `carHitHalf` / `racerWoundLvl`. Спрайты `CAR_SVG` остаются в HTML.
- `collision.js`: SAT рамок (`obbOverlap`, `pointInObb`, `carObb`).
- `world.js`: хук `resolveRaceContact` (таран, снаряды, мины, пикапы).
- `input.js`: хук `ctrlHeld`, ось газа/руля, `codeFromEvent` / `clearKeys`.
- `scene.js`: хук `updRace`, камера `followCam`.
- `driving.js`: хук `stepVehicle`.
- `loop.js`: хук `frame`.
- `screens.js`: хук `drawTitle`, каталог экранов хаба (`screens.paint`).
- `render.js`: хук `drawRaceWorld` (зум, blit VFX, погода на экране).
- `hub.js`: хуки `drawGarage`, `drawResults`.
- `garage-act.js`: хук `garageAction`.
- `car-fx.js` / `car-paint.js` / `car-fallback.js`: тень, щит, кузов на холсте.
- `portraits.js`: хуки портрета, роста и метки хозяина.
- `vfx.js`: хук `vfxLive` (гейт quarks).
- `faces.js`: хуки `avatarImage`, `fullbodyImage`, `kickPlayerImg`.
- `dialogs.js`: хуки предупреждений лаборатории и выхода.
- `arena.js`: хук `drawRaceArena` (земля, опасность, машины).
- `hud.js`: хуки `drawHUD`, `drawHudMinimap`, `drawMinimapVhs`.
- `carousel.js`: хуки `drawCarCarousel`, `carSelWrapDelta`.
- `roster.js`: хуки `drawCharSel`, `drawBio`.
- `training.js`: хуки `drawGym`, `drawArmory`.
- `gym-act.js`: хуки `upgradeCharStat`, `buyGym`.
- `armory-tune.js` / `armory-act.js`: подписи верстака, `buyArmory`, ввод. Каталог `ARM_COSTS` остаётся в `armory.js`.
- `options.js`: хуки `drawSettings`, `drawCameraSetup`, `drawZoomBar`.
- `settings-input.js`: хуки `clickSettings`, `hitSettings`, `clickCameraSetup`.
- `career-econ.js`: серия, пачка, календарь. Таблицы `CAREER_*` остаются в `career.js`.
- `career-ui.js`: хуки `drawCareer`, `drawCareerTracks`, `careerClick`, `careerPress`.
- `intro.js`: хук `drawIntro`.
- `intro-flow.js`: `startIntro`, `endIntro`, `confirmCharPick`, `enterTitle`.
- `title-race.js`: демо на титуле (`initTitleRace`, камера, `updRaceFx`). Каталог `TRACKDEFS` остаётся в HTML.
- `prerace.js`: хук `drawPreRace`.
- `hub-nav.js`: `enterPreRace`, `confirmPreRace`, `enterAutopark`, лента выбора кузова.
- `extras.js`: хуки достижений, читов и выбора трассы.
- `pointer.js`: хук `hubClick`.
- `slots.js`: хуки `drawHelp`, `drawSlotSelect`.
- `press-nav.js` / `press.js`: хук `press` (клавиатура хаба, пауза, слоты, настройки).
- `audio.js`: хук `updEngine`.
- `soundtrack.js`: хук `applyAudioSettings`.
- `music-gate.js`: хуки `musicOn` / `musicCat`, обёртка `musicSources` / `sfxSources` (десктоп без CDN). Таблицы `CHIP_*` остаются в HTML.
- `presentation.js`: хуки `stepVehicle`, `updRace`, `drawRaceArena`, `drawRaceWorld`, `drawHudCockpit`; симуляция с шагом 1/120 с и пределом 12 шагов за кадр.

Примитивы холста, снимок карьеры, заставка, трасса и заезд — хуки движка. Диапазоны класса кузовов остаются в `starter-kits.js` / `mid-kits.js`. Таблицы серии — в `career.js`. Каталог URL лиц — в `chars.js`. Каталог кузовов `CAR_ABIL` — в `combat-kits.js`. Сами частицы quarks остаются в `vfx/`.

Рантайм пока `html-legacy`: то же окно Chromium, но граница Host/Sim уже версионирована (`abi: 1`).

При изменении имён хуков в исходной игре модуль не ставится и пишет ошибку в журнал; нужен прогон `npm test` / `npm run test:engine`.

## Лаборатория

`editor-enhancements.js` расширяет актуальный скрипт карты в памяти. Он заменяет только операции истории, выбора и сохранения документа; новые инструменты объектов, коллизий и стартовой клетки продолжают исполняться из исходного редактора. `src/engine/editor/map-app.js` служит шаблоном функций сеанса, а не полной заменой актуального редактора. При несовпадении контрактов загружается базовый редактор с сообщением о необходимости обновления клиента.

`MapData.fileTrack()` используется для снимков: сохраняются актуальные поля `objects`, `start`, деколи и опасности. Импорт получает новый ID и не публикуется автоматически. Предыдущий сохранённый JSON остаётся в `.previous`. Удаление карты перемещает её JSON в `.trash`, а индекс перестраивается.

История ограничена 80 снимками документа. Локальные черновики зависят от доступного места в localStorage. Они не заменяют экспорт проекта или резервную копию ассетов. Возврат файла из `.trash` и восстановление `.previous` пока выполняются вручную.

## Проверено

- `npm test`: регрессии записей и индекса, повреждённые JSON, история, совместимость с редактором объектов, существующие тесты MSI и обновлений.
- `npm run test:engine`: полигон и заезд с пятью машинами, конечность координат/скоростей, продвижение времени на фиксированном шаге, загрузка аудиоконтекста, прогон Дьявола (мятость, Shotgun near/far, пак GTR, капли холста при quarks), сетка 1/3 дивизиона, оба редактора, история разных документов, импорт, ошибка записи и правки во время асинхронного сохранения.
- Скриншоты Electron просмотрены; на размере 1440×900 видны инструменты карты и библиотека объектов.
- Проверочная Windows-упаковка выполнена в `build/engine-package/` с локальным Electron, без подписи и без копирования большого Content. Это проверка упаковки клиента, не распространительный установщик.

Прогон выполнялся с программным рендерингом в скрытых окнах. Он не доказывает производительность GPU, качество звучания на колонках или хороший баланс полной карьеры.

## Что ещё нужно для полного движка и релиза

- Версионированный API (`DiVANEngine`, ABI 1) уже есть; хаб, лента авто, владение кузовом, комикс, сейвы, скилы, оружейка, трасса, заезд в движке. Пакеты quarks остаются в `vfx/`. Дальше — офлайн-пакет звука и продукт. Лаборатория машин в exe не выносится.
- ~~Сохранение пользовательских машин вместе с изображениями в переносимый проект: сейчас дополнительные слоты машины зависят от профиля браузера, в отличие от заводских `car.json`.~~ Карьера и настройки игры пишутся в `Saves/` профиля Windows; кастомные кузова лаборатории по-прежнему в браузерном хранилище и `car.json`.
- Единый пакет проекта, миграции форматов, менеджер зависимостей ассетов и встроенное восстановление предыдущих версий.
- Полная стилистическая переработка главного меню, гаража и результатов; текущая работа меняет приборный блок и оболочку лаборатории.
- Заезды на всех трассах и классах машин, проверка клавиатуры и геймпада, нагрузки с погодой и массовыми столкновениями.
- Баланс оружия и экономики по длительным игровым сессиям. Быстрые и лёгкие машины уже противопоставлены тяжёлым; скорострельность и урон нельзя уравнивать без учёта магазина, перегрева, попаданий и цены. Цены, награды и урон в этой доработке произвольно не менялись.
- Полная сборка Content, подпись, установка на чистой Windows и проверка обновления существующих сохранений.
