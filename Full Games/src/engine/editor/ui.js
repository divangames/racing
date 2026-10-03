// Общие правила взаимодействия редактора: размеры, поля, вкладки и диалоги.
(function () {
  'use strict';
  function start() {
    const root = document.documentElement;
    function size() {
      const work = [...document.querySelectorAll('#workCar,#workMap,#workChapter')].find(el => !el.hidden);
      if (work) root.style.setProperty('--editor-space', Math.max(320, innerHeight - work.getBoundingClientRect().top - 16) + 'px');
    }
    new ResizeObserver(size).observe(document.querySelector('.topbar'));
    new MutationObserver(size).observe(document.querySelector('.app-tabs'), {subtree:true,attributes:true,attributeFilter:['aria-selected']});
    window.addEventListener('resize', size); size();
    const search = document.getElementById('assetSearch');
    if (search) { search.setAttribute('aria-label', 'Поиск объектов'); search.placeholder = 'Поиск объектов…'; }

    // Ctrl+Z в текстовом поле отменяет ввод, а не правки геометрии или машины.
    document.addEventListener('keydown', event => {
      const editable = event.target.matches('input,textarea,select,[contenteditable=true]');
      if (editable && (event.ctrlKey || event.metaKey) && /^(KeyZ|KeyY)$/.test(event.code)) event.stopPropagation();
    });
    // Вкладки сцен пересоздаются при выборе миссии, поэтому обработчик делегирован.
    document.addEventListener('keydown', event => {
      const list = event.target.closest('.chapter-scene-tabs');
      if (!list || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const tabs = [...list.querySelectorAll('button')], at = tabs.indexOf(event.target);
      if (at < 0) return;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (at + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      event.preventDefault(); event.stopPropagation(); tabs[next].click();
      const replacement = document.querySelectorAll('.chapter-scene-tabs button')[next];
      replacement?.focus();
    });
    const box = document.getElementById('assetEdit');
    if (box) {
      box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Редактор объекта');
      new MutationObserver(() => {
        if (!box.hidden) box.querySelector('input:not([disabled])')?.focus();
      }).observe(box, {attributes:true,attributeFilter:['hidden']});
      document.addEventListener('keydown', event => { if (!box.hidden) event.stopPropagation(); });
      document.addEventListener('keydown', event => {
        if (box.hidden) return;
        if (event.key === 'Escape') {
          event.preventDefault();event.stopImmediatePropagation();
          if (typeof MapAssetEdit !== 'undefined') MapAssetEdit.close();
        } else if (event.key === 'Tab') {
          const nodes = [...box.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
          const at = nodes.indexOf(document.activeElement);
          if (event.shiftKey && at <= 0) { event.preventDefault();nodes[nodes.length-1]?.focus(); }
          else if (!event.shiftKey && (at < 0 || at === nodes.length-1)) { event.preventDefault();nodes[0]?.focus(); }
        } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
          event.preventDefault();event.stopImmediatePropagation();document.getElementById('assetEditSave')?.click();
        }
      }, true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
