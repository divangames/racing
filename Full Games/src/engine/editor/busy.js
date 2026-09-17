////////////////////////////////////////////////////////
//
// Угол лаборатории: идёт применение, страница не «мертвая».
//
////////////////////////////////////////////////////////

(function (global) {
  'use strict';

  let depth = 0;
  let ratio = 0;
  let label = 'Применение изменений';
  let root = null;
  let fill = null;
  let text = null;
  let hideTimer = 0;

  /** Собирает плашку один раз. */
  function mount() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'lab-busy';
    root.className = 'lab-busy';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = '<p class="lab-busy-label"></p><div class="lab-busy-track"><span class="lab-busy-fill"></span></div>';
    text = root.querySelector('.lab-busy-label');
    fill = root.querySelector('.lab-busy-fill');
    (document.body || document.documentElement).appendChild(root);
  }

  /** Пишет подпись и ширину шкалы. */
  function paint() {
    if (!root) return;
    if (text) text.textContent = label;
    if (fill) fill.style.width = Math.round(Math.max(0.08, Math.min(1, ratio)) * 100) + '%';
    root.classList.toggle('is-on', depth > 0);
    root.setAttribute('aria-busy', depth > 0 ? 'true' : 'false');
  }

  /**
   * Открывает плашку. Вложенные вызовы держат её, пока не закроются все.
   * @param {string} [msg]
   */
  function begin(msg) {
    mount();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
    depth += 1;
    if (msg) label = msg;
    if (depth === 1) ratio = 0.08;
    paint();
  }

  /**
   * Доля 0…1 и необязательная подпись этапа.
   * @param {number} value
   * @param {string} [msg]
   */
  function progress(value, msg) {
    if (msg) label = msg;
    if (Number.isFinite(+value)) ratio = Math.max(ratio, Math.max(0, Math.min(1, +value)));
    paint();
  }

  /** Закрывает один уровень. */
  function end() {
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      ratio = 1;
      paint();
      hideTimer = setTimeout(function () {
        hideTimer = 0;
        ratio = 0;
        paint();
      }, 220);
      return;
    }
    paint();
  }

  /**
   * Кадр паузы, чтобы браузер успел нарисовать шкалу до тяжёлой работы.
   * @returns {Promise<void>}
   */
  function tick() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { resolve(); });
    });
  }

  /**
   * Оборачивает запись / перерисовку: шкала видна до конца работы.
   * @param {string} msg
   * @param {function(function=):*} work
   * @returns {Promise<*>}
   */
  async function run(msg, work) {
    begin(msg);
    try {
      await tick();
      progress(0.2, msg);
      return await work(progress);
    } finally {
      end();
    }
  }

  global.LabBusy = {begin: begin, progress: progress, end: end, tick: tick, run: run};
})(typeof window !== 'undefined' ? window : globalThis);
