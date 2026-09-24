// Правка света автомобиля на холсте, точные координаты и единая история редактора.
(function (global) {
  'use strict';
  const $ = id => document.getElementById(id);
  const GROUPS = ['head', 'brake'];
  const COLORS = { head: '#bdeaff', brake: '#ff857b' };
  let group = 'head', selected = 0, drag = null, signature = '', slot = -1, pendingField = null;

  /** Инструмент действует только на видимой вкладке машины. */
  function active() {
    return !!($('carLightsPanel')?.open && !$('workCar')?.hidden && global.__labTab !== 'map');
  }
  /** Автоматические позиции вычисляются в той же системе, что кузов и колёса. */
  function positions(car) {
    car = car || EditorApp.car();
    return RnRCarLights.resolve(car, EditorView.lightBounds(car));
  }
  /** Переводит только изменяемую группу из автоматического в ручной режим. */
  function editable(car) {
    const points = positions(car)[group];
    if (!car.lights) car.lights = {};
    if (!Array.isArray(car.lights[group])) car.lights[group] = points.map(p => p.slice());
    return car.lights[group];
  }
  /** Ограничивает ввод без накопления погрешности перетаскивания. */
  function coordinate(n) { return Math.round(Math.max(-500, Math.min(500, n)) * 100) / 100; }

  /** Обновляет поля после выбора, отмены, смены авто и загрузки спрайта. */
  function sync(force) {
    if (!$('lightList') || typeof EditorApp === 'undefined') return;
    const car = EditorApp.car(), points = positions(car)[group];
    if (slot !== EditorApp.index()) { slot = EditorApp.index(); selected = 0; }
    selected = Math.max(0, Math.min(selected, points.length - 1));
    const next = JSON.stringify([slot, group, selected, car.lights, points, active()]);
    if (!force && next === signature) return;
    signature = next;
    $('carLightsToggle').setAttribute('aria-expanded', String($('carLightsPanel').open));
    $('lightGroup').value = group;
    const list = $('lightList'); list.replaceChildren();
    points.forEach((p, index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = (group === 'head' ? 'Фара ' : 'Стоп ') + (index + 1);
      button.dataset.lightIndex = index;
      button.setAttribute('aria-pressed', String(index === selected));
      button.title = 'X ' + p[0].toFixed(1) + ' · Y ' + p[1].toFixed(1);
      button.onclick = () => select(group, index);
      list.append(button);
    });
    const point = points[selected];
    ['lightX', 'lightY'].forEach((id, axis) => {
      const field = $(id); field.disabled = !point;
      if (document.activeElement !== field || force) field.value = point ? Math.round(point[axis] * 100) / 100 : '';
    });
    $('lightAdd').disabled = points.length >= RnRCarLights.MAX_POINTS;
    $('lightDuplicate').disabled = !point || points.length >= RnRCarLights.MAX_POINTS;
    $('lightRemove').disabled = !point;
    $('lightMirror').disabled = !points[selected ^ 1];
    const custom = Array.isArray(car.lights?.[group]);
    $('lightMode').textContent = !points.length ? 'Эта группа выключена. Добавьте точку для включения.' :
      (custom ? 'Свои позиции' : 'Автоматические позиции') + ' · ' + points.length + ' / 8';
  }
  /** Выбирает точку без изменения документа. */
  function select(kind, index) {
    finish(); group = GROUPS.includes(kind) ? kind : 'head'; selected = index;
    sync(true); EditorView.draw();
  }
  /** Одна команда соответствует одному шагу отмены. */
  function change(action) {
    finish(); EditorApp.beginEdit(); action(EditorApp.car());
    EditorApp.commitEdit(); sync(true); EditorView.draw();
  }
  /** Изменяет позицию и, по выбору пользователя, её зеркальную пару. */
  function movePoint(car, x, y) {
    const points = editable(car), point = points[selected];
    if (!point) return;
    point[0] = coordinate(x); point[1] = coordinate(y);
    if ($('lightMirror').checked && points[selected ^ 1]) points[selected ^ 1] = [point[0], -point[1]];
  }
  /** Подтверждает набранное число также перед Ctrl+S и кликом по холсту. */
  function commitField(id) {
    pendingField = null;
    const field = $(id), n = field.valueAsNumber, axis = id === 'lightY';
    if (!Number.isFinite(n) || !field.checkValidity()) { sync(true); return; }
    change(car => { const p = positions(car)[group][selected];
      if (p) movePoint(car, axis ? p[0] : n, axis ? n : p[1]); });
  }
  /** Завершает жест до сохранения, смены слота или закрытия инструмента. */
  function finish(cancel) {
    if (pendingField) commitField(pendingField);
    if (!drag) return;
    const old = drag; drag = null;
    if (old.car === EditorApp.car()) {
      if (cancel) {
        if (old.before === undefined) delete old.car.lights;
        else old.car.lights = old.before;
      } else if (old.changed) EditorApp.commitEdit();
      if (cancel || !old.changed) EditorApp.resumeSave();
    }
    if ($('stage').hasPointerCapture?.(old.pointer)) $('stage').releasePointerCapture(old.pointer);
    $('stage').style.cursor = 'crosshair'; sync(true); EditorView.draw();
  }
  /** Ищет точку в экранном радиусе, одинаковом при любом зуме. */
  function hit(point) {
    const all = positions(), radius = 13 / Math.max(.8, EditorView.cam.z);
    let best = null, distance = radius;
    for (const kind of GROUPS) all[kind].forEach((p, index) => {
      const d = Math.hypot(point.x - p[0], point.y - p[1]);
      if (d <= distance) { best = { kind, index }; distance = d; }
    });
    return best;
  }
  /** Захватывает только левую кнопку в режиме света; панорама и зум остаются штатными. */
  function pointerDown(e) {
    if (!active() || e.button !== 0) return;
    finish();
    e.preventDefault(); e.stopImmediatePropagation();
    const p = EditorView.toWorld(e), found = hit(p);
    if (!found) return;
    select(found.kind, found.index); EditorApp.beginEdit();
    const car = EditorApp.car(), light = positions(car)[group][selected];
    drag = { car, pointer: e.pointerId, before: car.lights === undefined ? undefined : EditorData.clone(car.lights),
      start: p, origin: light.slice(), changed: false };
    $('stage').setPointerCapture?.(e.pointerId); $('stage').style.cursor = 'grabbing';
  }
  /** Сдвиг выполняется относительно начала жеста; Shift фиксирует главную ось. */
  function pointerMove(e) {
    if (!active() && !drag) return;
    if (!drag) {
      if (e.buttons === 0 && e.target === $('stage') && hit(EditorView.toWorld(e))) { e.stopImmediatePropagation(); $('stage').style.cursor = 'grab'; }
      return;
    }
    if (e.pointerId !== drag.pointer) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (drag.car !== EditorApp.car() || !active()) { finish(true); return; }
    const p = EditorView.toWorld(e); let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (e.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
    let x = drag.origin[0] + dx, y = drag.origin[1] + dy;
    if ($('snapToggle')?.checked) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; }
    if (Math.hypot(dx, dy) < .01) return;
    movePoint(drag.car, x, y); drag.changed = true; sync(true); EditorView.draw();
  }
  /** Рисует свет и контрастные ручки поверх машины в её локальной системе. */
  function draw(c, car, zoom) {
    if (!active()) return;
    sync(); const all = positions(car), radius = 7 / zoom;
    c.save();
    if ($('lightPreview').checked) {
      c.globalCompositeOperation = 'screen';
      for (const kind of GROUPS) all[kind].forEach(p => {
        const brake = kind === 'brake', pressed = $('lightBrakePreview').checked;
        if (!brake) {
          const beam = c.createLinearGradient(p[0], p[1], p[0] + 60, p[1]);
          beam.addColorStop(0, 'rgba(180,225,255,.24)'); beam.addColorStop(1, 'rgba(180,225,255,0)');
          c.fillStyle = beam; c.beginPath(); c.moveTo(p[0], p[1] - 1); c.lineTo(p[0] + 60, p[1] - 18);
          c.lineTo(p[0] + 60, p[1] + 18); c.lineTo(p[0], p[1] + 1); c.fill();
        }
        const size = brake && pressed ? 10 : 6;
        const glow = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], size);
        glow.addColorStop(0, brake ? (pressed ? 'rgba(255,65,45,.85)' : 'rgba(255,65,45,.25)') : 'rgba(220,246,255,.7)');
        glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow;
        c.fillRect(p[0] - size, p[1] - size, size * 2, size * 2);
      });
      c.globalCompositeOperation = 'source-over';
    }
    for (const kind of GROUPS) all[kind].forEach((p, index) => {
      const chosen = group === kind && selected === index;
      c.beginPath(); c.arc(p[0], p[1], radius + (chosen ? 3 / zoom : 0), 0, Math.PI * 2);
      c.fillStyle = '#101820'; c.fill(); c.strokeStyle = chosen ? '#fff' : COLORS[kind]; c.lineWidth = 2 / zoom; c.stroke();
      c.fillStyle = COLORS[kind]; c.beginPath(); c.arc(p[0], p[1], 3 / zoom, 0, Math.PI * 2); c.fill();
      c.font = '600 ' + 11 / zoom + 'px Arial'; c.textAlign = 'center'; c.textBaseline = 'bottom';
      const label = (kind === 'head' ? 'Ф' : 'С') + (index + 1);
      c.lineWidth = 3 / zoom; c.strokeStyle = '#101820'; c.strokeText(label, p[0], p[1] - 12 / zoom);
      c.fillText(label, p[0], p[1] - 12 / zoom);
    });
    c.restore();
  }
  /** Подключает панель к истории и жестам, не меняя остальной редактор. */
  function init() {
    const canvas = $('stage'), panel = $('carLightsPanel'); if (!canvas || !panel) return;
    $('carLightsToggle').onclick = () => {
      panel.open = !panel.open;
      if (panel.open) panel.scrollIntoView({ block: 'nearest' });
      sync(true); EditorView.draw();
    };
    panel.addEventListener('toggle', () => {
      finish();
      if (panel.open) { EditorView.deselect(); EditorApp.refreshSelection(); }
      sync(true); EditorView.draw();
    });
    $('lightDone').onclick = () => { finish(); panel.open = false; $('carLightsToggle').focus(); };
    $('lightGroup').onchange = () => select($('lightGroup').value, 0);
    ['lightPreview', 'lightBrakePreview'].forEach(id => $(id).onchange = () => EditorView.draw());
    ['lightX', 'lightY'].forEach(id => {
      $(id).addEventListener('input', () => { pendingField = id; });
      $(id).addEventListener('change', () => commitField(id));
    });
    $('lightAdd').onclick = () => change(car => {
      const list = editable(car); if (list.length >= 8) return;
      list.push([group === 'head' ? 25 : -25, 0]); selected = list.length - 1;
    });
    $('lightDuplicate').onclick = () => change(car => {
      const list = editable(car), p = list[selected]; if (!p || list.length >= 8) return;
      list.push([p[0], -p[1]]); selected = list.length - 1;
    });
    $('lightRemove').onclick = () => change(car => editable(car).splice(selected, 1));
    $('lightReset').onclick = () => change(car => {
      if (!car.lights) return;
      delete car.lights[group]; if (!Object.keys(car.lights).length) delete car.lights;
    });
    canvas.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('pointermove', pointerMove, true);
    window.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.pointer) { e.stopImmediatePropagation(); finish(); } }, true);
    window.addEventListener('pointercancel', () => finish(true), true);
    window.addEventListener('blur', () => finish());
    // Ctrl/Alt+колесо в режиме света только масштабирует вид, не скрытый слой.
    canvas.addEventListener('wheel', e => {
      if (!active() || !(e.ctrlKey || e.metaKey || e.altKey)) return;
      e.preventDefault(); e.stopImmediatePropagation(); EditorView.zoomBy(e.deltaY > 0 ? .9 : 1.11, e); EditorView.draw();
    }, { capture: true, passive: false });
    window.addEventListener('keydown', e => {
      if (!active() || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName) || e.target?.closest?.('[role="tab"]')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (drag) finish(true); else panel.open = false; return; }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') { e.preventDefault(); e.stopImmediatePropagation(); $('lightDuplicate').click(); }
        return;
      }
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!delta && e.key !== 'Delete') return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Delete') { $('lightRemove').click(); return; }
      change(car => { const p = positions(car)[group][selected], step = e.shiftKey ? .1 : .5;
        if (p) movePoint(car, p[0] + delta[0] * step, p[1] + delta[1] * step); });
    }, true);
    sync(true);
  }
  global.CarLightEditor = { sync, draw, finish, select, positions, active };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
