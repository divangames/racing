////////////////////////////////////////////////////////
//
// Инспектор карты: биом, погода, палитры, зоны покрытия
//
////////////////////////////////////////////////////////
'use strict';

const MapPanel = (() => {
  let $, getDoc, getStamp, setStamp, setDirty, setToolUi;

  /** Тема: сток и свои папки. */
  function fillTheme() {
    const sel = $('mapTheme');
    if (!sel) return;
    const keep = getDoc().theme.map;
    sel.innerHTML = '';
    const seen = {};
    RnRTracks.THEMES.forEach((th) => {
      const o = document.createElement('option');
      o.value = th.id;
      o.textContent = th.name;
      sel.appendChild(o);
      seen[th.id] = 1;
    });
    (MapTex.catalog.biomes || []).forEach((b) => {
      if (seen[b.id]) return;
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = 'Свой · ' + b.id;
      sel.appendChild(o);
    });
    sel.value = keep;
    if (sel.value !== keep) sel.value = RnRTracks.THEMES[0].id;
  }

  /** Погода. */
  function fillWeather() {
    const sel = $('mapWeather');
    if (!sel) return;
    if (!sel.options.length) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'По биому';
      sel.appendChild(empty);
      RnRTracks.WEATHER.forEach((w) => {
        const o = document.createElement('option');
        o.value = w.id;
        o.textContent = w.name;
        sel.appendChild(o);
      });
    }
    sel.value = getDoc().theme.weather || '';
  }

  /** Библиотека дороги. */
  function fillRoads() {
    const sel = $('mapRoadPick');
    if (!sel) return;
    const keep = getDoc().theme.roadSrc || '';
    sel.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = '— цвет зон покрытия —';
    sel.appendChild(none);
    (MapTex.catalog.roads || []).forEach((r) => {
      const o = document.createElement('option');
      o.value = r.src;
      o.textContent = r.id;
      sel.appendChild(o);
    });
    sel.value = keep;
  }

  /** Штампы деколей. */
  function fillDecals() {
    const box = $('mapDecals');
    if (!box || box.childElementCount) return;
    const stamp = getStamp();
    RnRTracks.DECALS.forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'decal-swatch' + (d.id === stamp ? ' is-on' : '');
      b.title = d.name;
      b.innerHTML = '<img alt="" src="' + d.src + '"><span>' + d.name + '</span>';
      b.onclick = () => {
        setStamp(d.id);
        MapView.setDecal(d.id);
        MapView.setTool('decal');
        setToolUi('decal');
        box.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
      };
      box.appendChild(b);
    });
  }

  /** Зоны материала дороги. */
  function fillZones() {
    const box = $('mapZones');
    if (!box) return;
    box.innerHTML = '';
    getDoc().zones.forEach((z) => {
      const row = document.createElement('div');
      row.className = 'zone-row';
      const mat = document.createElement('select');
      RnRTracks.MATERIALS.forEach((m) => {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.name;
        if (m.id === z.material) o.selected = true;
        mat.appendChild(o);
      });
      mat.onchange = () => { z.material = mat.value; setDirty(); };
      const a = document.createElement('input');
      a.type = 'number'; a.step = '0.01'; a.min = '0'; a.max = '1'; a.value = z.from;
      a.onchange = () => { z.from = +a.value; setDirty(); };
      const b = document.createElement('input');
      b.type = 'number'; b.step = '0.01'; b.min = '0'; b.max = '1'; b.value = z.to;
      b.onchange = () => { z.to = +b.value; setDirty(); };
      row.append(mat, a, b);
      box.appendChild(row);
    });
  }

  /** Все поля справа. */
  function paint() {
    fillTheme();
    fillWeather();
    fillRoads();
    fillZones();
    fillDecals();
  }

  /** Связка с приложением. */
  function init(opts) {
    $ = opts.$;
    getDoc = opts.getDoc;
    getStamp = opts.getStamp;
    setStamp = opts.setStamp;
    setDirty = opts.setDirty;
    setToolUi = opts.setToolUi;
  }

  return {init, paint, fillZones, fillTheme};
})();
