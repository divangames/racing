// Вкладка «Редактор глав»: монтаж комикса, баланс и запуск миссии с любой точки.
(function (global) {
  'use strict';

  const DRAFT_KEY = 'rnr.chapterDraft.v1';
  let documents = [];
  let selectedDocument = 0;
  let selectedPoint = 'CHASE_START';
  let sceneKind = 'chapter-intro';
  let selectedScene = 0;
  let dirty = false;
  let saving = false;
  let fillLock = false;

  const $ = (id) => document.getElementById(id);
  const current = () => documents[selectedDocument] || null;
  const comicSection = () => current() ? current().comicSections.find((item) => item.id === sceneKind) : null;
  const scenes = () => comicSection() ? comicSection().scenes : [];
  const scene = () => scenes()[selectedScene] || null;

  /** Создаёт кнопку с безопасным текстовым содержимым. */
  function button(label, className) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    if (className) node.className = className;
    return node;
  }

  /** Меняет подпись состояния сохранения. */
  function setStatus(message, kind) {
    const node = $('chapterStatus');
    if (!node) return;
    node.textContent = message;
    node.className = 'chapter-status' + (kind ? ' is-' + kind : '');
  }

  /** Отмечает документ изменённым. */
  function markDirty() {
    if (fillLock) return;
    dirty = true;
    setStatus('Есть несохранённые правки. Тест запустит текущий черновик.', 'dirty');
  }

  /** Возвращает подпись точки для списка. */
  function pointHint(id) {
    const hints = {
      CHAPTER_INTRO: 'вступительный комикс · выбранный кадр', INTRO: 'комикс погони · выбранный кадр',
      TRUCK_INTRO: 'катсцена · 15 секунд PitterMAX и въезд Бестии', CHASE_START: 'обучение', CHASE: 'игровой цикл',
      RED_WARNING: 'таймер поражения', GREEN_HOLD: 'таймер победы', ENGINE_FAILURE: 'катсцена',
      BRIDGE_APPROACH: 'начало разрушения', BRIDGE_COLLAPSE: 'каскадный взрыв моста',
      BRAKE_HIT: 'резкий удар по тормозам', DRIFT_STOP: 'боковой занос к обрыву',
      DRIFT_SETTLE: 'ударная остановка', PLAYER_CLOSEUP: 'пауза на Мьёльнире',
      SEPARATION_SHOT: 'общий план разрыва', GAP_TRAVERSE: 'пролёт камеры через пропасть',
      TRUCK_FOCUS: 'переход камеры к PitterMAX', TRUCK_ESCAPE: 'один гудок и уход за кадр',
      AFTERMATH_RETURN: 'возврат к Мьёльниру', POST_COMIC: 'комикс · выбранный кадр',
      FAILED: 'экран поражения', GARAGE: 'выбор хлама'
    };
    return hints[id] || 'точка сценария';
  }

  /** Рисует список документов, сгруппированный по главам. */
  function renderMissions() {
    const host = $('chapterList');
    host.replaceChildren();
    let lastChapter = '';
    documents.forEach((item, index) => {
      if (item.chapter !== lastChapter) {
        const heading = document.createElement('div');
        heading.className = 'chapter-list-heading';
        heading.textContent = item.chapter;
        host.append(heading);
        lastChapter = item.chapter;
      }
      const node = button('', 'chapter-mission' + (index === selectedDocument ? ' is-on' : ''));
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', index === selectedDocument ? 'true' : 'false');
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      title.textContent = item.title;
      meta.textContent = item.chapter + ' · ' + item.id;
      node.append(title, meta);
      node.onclick = () => selectDocument(index);
      host.append(node);
    });
  }

  /** Рисует вкладки всех комиксов выбранной главы. */
  function renderComicSections() {
    const host = $('chapterComicSections');
    host.replaceChildren();
    current().comicSections.forEach((section) => {
      const node = button(section.label, 'chapter-scene-tab' + (section.id === sceneKind ? ' is-on' : ''));
      node.dataset.sceneKind = section.id;
      node.setAttribute('role', 'tab');
      node.setAttribute('aria-selected', section.id === sceneKind ? 'true' : 'false');
      node.tabIndex = section.id === sceneKind ? 0 : -1;
      node.onclick = () => selectSceneKind(section.id);
      host.append(node);
    });
  }

  /** Рисует точки входа в выбранную миссию. */
  function renderPoints() {
    const host = $('chapterPoints');
    const item = current();
    host.replaceChildren();
    if (!item) return;
    item.points.forEach((point, index) => {
      const node = button('', 'chapter-point' + (point.id === selectedPoint ? ' is-on' : ''));
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', point.id === selectedPoint ? 'true' : 'false');
      const title = document.createElement('strong');
      const meta = document.createElement('span');
      title.textContent = String(index + 1).padStart(2, '0') + '  ' + point.label;
      meta.textContent = point.id + ' · ' + pointHint(point.id);
      node.append(title, meta);
      node.onclick = () => selectPoint(point.id);
      host.append(node);
    });
  }

  /** Выбирает точку и синхронизирует с ней монтажную ленту комикса. */
  function selectPoint(id) {
    selectedPoint = id;
    const runtime = id === 'CHAPTER_INTRO' ? 'chapterIntroScenes' : id === 'INTRO' ? 'introScenes' : id === 'POST_COMIC' ? 'postScenes' : '';
    const section = current().comicSections.find((item) => runtime ? item.runtimeKey === runtime :
      item.runtimeKey === 'cinematicScenes' && item.scenes.some(scene => scene.id === id));
    if (section) {
      sceneKind = section.id;
      selectedScene = section.runtimeKey === 'cinematicScenes' ? Math.max(0, section.scenes.findIndex(scene => scene.id === id)) : 0;
      renderComicSections(); renderScenes(); fillScene();
    }
    renderPoints();
  }

  /** Рисует монтажную ленту кадров. */
  function renderScenes() {
    const host = $('chapterSceneList');
    host.replaceChildren();
    scenes().forEach((item, index) => {
      const node = button('', 'chapter-scene' + (index === selectedScene ? ' is-on' : ''));
      node.setAttribute('aria-label', 'Кадр ' + (index + 1) + ': ' + (item.speaker || 'без титра'));
      if (item.image) {
        const image = document.createElement('img');
        image.src = item.image;
        image.alt = '';
        node.append(image);
      } else {
        const empty = document.createElement('div');
        empty.className = 'chapter-scene-no-image';
        empty.textContent = 'НЕТ КАДРА';
        node.append(empty);
      }
      const caption = document.createElement('span');
      caption.textContent = (index + 1) + '. ' + (item.speaker || item.text || 'Новый кадр');
      node.append(caption);
      node.onclick = () => {
        selectedScene = index;
        const section = current().comicSections.find(item => item.id === sceneKind);
        if (section && section.runtimeKey === 'cinematicScenes' && current().points.some(point => point.id === item.id)) {
          selectedPoint = item.id; renderPoints();
        }
        renderScenes(); fillScene();
      };
      host.append(node);
    });
  }

  /** Обновляет крупный предпросмотр кадра. */
  function renderPreview() {
    const item = scene();
    const image = $('chapterPreviewImage');
    const empty = $('chapterPreviewEmpty');
    if (!item) {
      image.hidden = true;
      empty.hidden = false;
      $('chapterPreviewSpeaker').textContent = 'КОМИКС ПУСТ';
      $('chapterPreviewText').textContent = 'Добавьте первый кадр.';
      $('chapterPreviewSub').textContent = '';
      $('chapterPreviewCount').textContent = '00 / 00';
      return;
    }
    image.hidden = !item.image;
    empty.hidden = !!item.image;
    if (item.image) image.src = item.image;
    $('chapterPreviewSpeaker').textContent = item.speaker || 'БЕЗ ТИТРА';
    $('chapterPreviewText').textContent = item.text || 'Текст кадра';
    $('chapterPreviewSub').textContent = item.sub || '';
    $('chapterPreviewCount').textContent = String(selectedScene + 1).padStart(2, '0') + ' / ' + String(scenes().length).padStart(2, '0');
  }

  /** Заполняет поля выбранного кадра. */
  function fillScene() {
    fillLock = true;
    const item = scene();
    ['chapterSpeaker', 'chapterText', 'chapterSub', 'chapterImage'].forEach((id) => {
      const key = id.replace('chapter', '').toLowerCase();
      $(id).disabled = !item;
      $(id).value = item ? item[key] || '' : '';
    });
    fillLock = false;
    renderPreview();
  }

  /** Полностью обновляет интерфейс выбранной главы. */
  function fill() {
    const item = current();
    if (!item) return;
    fillLock = true;
    $('chapterTitle').value = item.title;
    $('chapterName').value = item.chapter;
    $('chapterObjective').value = item.objective;
    $('chapterReadTitle').textContent = item.title;
    $('chapterReadChapter').textContent = item.chapter;
    $('chapterReadObjective').textContent = item.objective;
    fillLock = false;
    renderMissions();
    renderPoints();
    renderComicSections();
    renderScenes();
    fillScene();
    ChapterBalanceEditor.render(item, markDirty);
    ChapterTrackEditor.fill();
  }

  /** Выбирает другой документ главы. */
  function selectDocument(index) {
    selectedDocument = Math.max(0, Math.min(documents.length - 1, index));
    const item = current();
    selectedPoint = item.points.some((point) => point.id === selectedPoint) ? selectedPoint : item.points[0].id;
    sceneKind = item.comicSections.some((section) => section.id === sceneKind) ? sceneKind : item.comicSections[0].id;
    selectedScene = 0;
    dirty = false;
    fill();
    setStatus('Глава загружена. Выберите точку и нажмите «Тест».');
  }

  /** Выбирает одну из секций комикса главы. */
  function selectSceneKind(kind) {
    const section = current().comicSections.find((item) => item.id === kind) || current().comicSections[0];
    sceneKind = section.id;
    selectedScene = 0;
    selectedPoint = section.runtimeKey === 'cinematicScenes' ? (section.scenes[0] && section.scenes[0].id || 'BRIDGE_APPROACH') :
      section.runtimeKey === 'postScenes' ? 'POST_COMIC' : section.runtimeKey === 'chapterIntroScenes' ? 'CHAPTER_INTRO' : 'INTRO';
    document.querySelectorAll('[data-scene-kind]').forEach((node) => {
      const on = node.dataset.sceneKind === section.id;
      node.classList.toggle('is-on', on);
      node.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderPoints();
    renderScenes();
    fillScene();
  }

  /** Добавляет новый кадр после выбранного. */
  function addScene(copySource) {
    const list = scenes();
    const prefix = sceneKind;
    const source = copySource || { speaker: '', text: 'Новый кадр', sub: '', image: '' };
    const item = ChapterData.normalizeScene(source, list.length, prefix);
    item.id = prefix + '-' + (Date.now().toString(36));
    const target = list.length ? selectedScene + 1 : 0;
    list.splice(target, 0, item);
    selectedScene = target;
    markDirty();
    renderScenes();
    fillScene();
  }

  /** Перемещает выбранный кадр на один шаг. */
  function moveScene(delta) {
    const list = scenes();
    const target = selectedScene + delta;
    if (!list[selectedScene] || target < 0 || target >= list.length) return;
    const item = list.splice(selectedScene, 1)[0];
    list.splice(target, 0, item);
    selectedScene = target;
    markDirty();
    renderScenes();
    fillScene();
  }

  /** Удаляет выбранный кадр комикса. */
  function deleteScene() {
    if (!scene()) return;
    scenes().splice(selectedScene, 1);
    selectedScene = Math.max(0, Math.min(selectedScene, scenes().length - 1));
    markDirty();
    renderScenes();
    fillScene();
  }

  /** Записывает главу на диск. */
  async function save() {
    if (!current() || saving) return;
    const document = current(), snapshot = JSON.stringify(document);
    saving = true;
    ['chapterSaveBtn','chapterSaveBottom'].forEach(id => { $(id).disabled = true; });
    setStatus('Сохраняю главу…');
    try {
      await ChapterData.save(JSON.parse(snapshot));
      if (current() === document) {
        if (JSON.stringify(document) === snapshot) {
          dirty = false;
          setStatus('Глава сохранена');
        } else setStatus('Предыдущие правки сохранены. Есть новые несохранённые изменения.', 'dirty');
      }
    } catch (error) {
      setStatus('Не удалось сохранить главу: ' + error.message + '. Повторите сохранение.', 'error');
    } finally {
      saving = false;
      ['chapterSaveBtn','chapterSaveBottom'].forEach(id => { $(id).disabled = false; });
    }
  }

  /** Запускает игру с текущим несохранённым документом и выбранной точки. */
  function test() {
    if (!current()) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(current())); } catch (error) {}
    const query = new URLSearchParams({
      chapterTest: '1', chapter: current().id, point: selectedPoint,
      scene: String(['CHAPTER_INTRO', 'INTRO', 'POST_COMIC'].includes(selectedPoint) ? selectedScene : 0)
    });
    location.href = 'rnr.html?' + query.toString();
  }

  /** Загружает выбранный пользователем файл кадра. */
  async function uploadFrame(file) {
    const item = scene();
    if (!item || !file) return;
    setStatus('Записываю новый кадр…');
    try {
      item.image = await ChapterData.uploadFrame(current().id, item.id, file);
      $('chapterImage').value = item.image;
      markDirty();
      renderScenes();
      renderPreview();
      setStatus('Кадр заменён. Сохраните главу, чтобы закрепить путь.', 'dirty');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  }

  /** Переключает основной редактор на вкладку глав. */
  function setTab(name) {
    global.__labTab = name;
    if (typeof MapApp !== 'undefined' && typeof MapApp.setTab === 'function') MapApp.setTab(name);
    else {
      $('workCar').hidden = name !== 'car';
      $('workMap').hidden = name !== 'map';
      $('workChapter').hidden = name !== 'chapter';
    }
  }

  /** Привязывает элементы управления главы. */
  function bind() {
    ChapterTrackEditor.bind({current, markDirty, setStatus});
    $('chapterAddScene').onclick = () => addScene();
    $('chapterSceneDuplicate').onclick = () => { if (scene()) addScene(ChapterData.clone(scene())); };
    $('chapterSceneUp').onclick = () => moveScene(-1);
    $('chapterSceneDown').onclick = () => moveScene(1);
    $('chapterSceneDelete').onclick = deleteScene;
    $('chapterSaveBtn').onclick = save;
    $('chapterSaveBottom').onclick = save;
    $('chapterTestBtn').onclick = test;
    $('chapterFrameFile').onchange = (event) => uploadFrame(event.target.files && event.target.files[0]);
    [['chapterTitle', 'title'], ['chapterName', 'chapter'], ['chapterObjective', 'objective']].forEach(([id, key]) => {
      $(id).oninput = () => {
        current()[key] = $(id).value;
        $('chapterRead' + (key === 'chapter' ? 'Chapter' : key[0].toUpperCase() + key.slice(1))).textContent = $(id).value;
        markDirty();
      };
    });
    [['chapterSpeaker', 'speaker'], ['chapterText', 'text'], ['chapterSub', 'sub'], ['chapterImage', 'image']].forEach(([id, key]) => {
      $(id).oninput = () => { if (scene()) { scene()[key] = $(id).value; markDirty(); renderPreview(); } };
      $(id).onchange = () => renderScenes();
    });
    document.addEventListener('keydown', (event) => {
      if (global.__labTab !== 'chapter') return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); test(); }
    });
  }

  /** Запускает вкладку после готовности DOM. */
  async function start() {
    bind();
    try {
      documents = await ChapterData.load();
      if (!documents.length) throw new Error('В content/chapters нет документов миссий');
      const query = new URLSearchParams(location.search);
      const wanted = query.get('chapter');
      const index = documents.findIndex((item) => item.id === wanted);
      selectedDocument = index >= 0 ? index : 0;
      const point = query.get('point');
      if (point && current().points.some((item) => item.id === point)) selectedPoint = point;
      const cinematic = current().comicSections.find(section => section.runtimeKey === 'cinematicScenes' &&
        section.scenes.some(scene => scene.id === selectedPoint));
      const wantedRuntime = cinematic ? 'cinematicScenes' : selectedPoint === 'POST_COMIC' ? 'postScenes' :
        selectedPoint === 'CHAPTER_INTRO' ? 'chapterIntroScenes' : 'introScenes';
      const wantedSection = current().comicSections.find((item) => item.runtimeKey === wantedRuntime);
      if (wantedSection) sceneKind = wantedSection.id;
      selectDocument(selectedDocument);
      selectSceneKind(sceneKind);
      selectedPoint = point || selectedPoint;
      selectedScene = Math.max(0, Math.min(scenes().length - 1, Number(query.get('scene')) || 0));
      if (cinematic) selectedScene = Math.max(0, scenes().findIndex(scene => scene.id === selectedPoint));
      renderPoints();
      renderScenes();
      fillScene();
      if (query.get('tab') === 'chapter') setTab('chapter');
    } catch (error) {
      setStatus('Не удалось загрузить главы: ' + error.message, 'error');
    }
  }

  global.ChapterEditor = { start, save, test, setTab, current, selectPoint };
  const run = () => { if (!global.__chapterEditorBoot) { global.__chapterEditorBoot = true; start(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})(window);
