// Выбор сценария арены в редакторе с обычной историей, JSON и тестом черновика.
(function () {
  'use strict';
  /** Создаёт панель без сохранения документа и без замены существующих инструментов. */
  function start() {
    const host = document.getElementById('workMap');
    if (!host || typeof MapApp === 'undefined') return;
    const section = document.createElement('section'); section.className = 'section map-panel-card studio-tactics';
    const heading = document.createElement('div'); heading.className = 'section-title'; heading.textContent = 'ТАКТИКА АРЕНЫ';
    const label = document.createElement('label'); label.textContent = 'Тактика арены ';
    const select = document.createElement('select'); select.id = 'mapTacticsMode'; select.style.minHeight = '44px';
    for (const [value, name] of [['off', 'Без событий'], ['auto', 'По биому'], ['press', 'Пресс · поймать окно'], ['heat', 'Жар · сберечь корпус'], ['slick', 'Охладитель · удержать сцепление']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = name; select.appendChild(option);
    }
    label.appendChild(select); section.append(heading, label);
    const note = document.createElement('p'); section.appendChild(note);
    const help = document.createElement('small'); help.textContent = 'Участок подбирается заново после изменения геометрии: нужен плавный поворот без моста и разрыва. Если подходящего поворота нет, событие не включается. Ручные препятствия не удаляются. Проверьте обе полосы через «Тест черновика».'; section.appendChild(help);
    (host.querySelector('.panel') || host).appendChild(section);
    /** Обновляет поле после выбора карты, undo/redo или возврата из игры. */
    function refresh() {
      const doc = MapApp.getDocument();
      if (!doc) return;
      select.value = doc.tactics ? doc.tactics.mode : 'off';
      const mode = RnRTactics.MODES[select.value];
      note.textContent = mode ? mode.advice : select.value === 'auto' ? 'Короткая внутренняя дуга с событием, длинная внешняя — без его воздействия.' : 'Обычная трасса без циклического события.';
    }
    select.addEventListener('change', () => {
      MapApp.getDocument().tactics = { mode: select.value }; MapApp.commit(); refresh();
    });
    document.addEventListener('click', () => setTimeout(refresh, 0));
    document.addEventListener('keydown', () => setTimeout(refresh, 0));
    const draw = MapView.draw;
    MapView.draw = function() { const result = draw.apply(this, arguments); refresh(); return result; };
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
