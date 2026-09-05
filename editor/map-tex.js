////////////////////////////////////////////////////////
//
// Текстуры трассы: биом земли, полотно дороги, объекты
//
////////////////////////////////////////////////////////
'use strict';

const MapTex = (() => {
  const cache = Object.create(null);
  let catalog = {biomes: [], roads: [], objects: []};

  /** Картинка по URL, с перерисовкой. */
  function img(url, onload) {
    if (!url) return null;
    if (cache[url]) return cache[url];
    const im = new Image();
    im.onload = () => { if (onload) onload(); };
    im.onerror = () => { if (onload) onload(); };
    im.src = url;
    cache[url] = im;
    return im;
  }

  /** Каталог с диска. */
  async function list() {
    try {
      const r = await fetch('/__track-textures', {cache: 'no-store'});
      if (!r.ok) {
        const r2 = await fetch('/__textures', {cache: 'no-store'});
        if (r2.ok) catalog = await r2.json();
      } else catalog = await r.json();
    } catch (err) { /* нет сервера */ }
    return catalog;
  }

  /** Пишет файл в Textures или в стоковый биом. */
  async function upload(file, kind, dest, biomeId) {
    if (!file) return {ok: false, error: 'Нет файла'};
    const data = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg');
    const id = String(biomeId || file.name.replace(/\.[^.]+$/, '')).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);
    const r = await fetch('/__save-texture', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({kind, dest: dest || 'library', id, ext, data})
    });
    if (!r.ok) return {ok: false, error: 'Сервер ' + r.status};
    const out = await r.json();
    await list();
    return out;
  }

  /** Земля: свой файл или стоковый тайл биома. */
  function groundOf(theme) {
    if (theme && theme.groundSrc) return img(theme.groundSrc, () => MapView && MapView.draw && MapView.draw());
    const id = theme && theme.map;
    if (!id) return null;
    const hit = (catalog.biomes || []).find((b) => b.id === id);
    if (hit) return img(hit.src, () => MapView && MapView.draw && MapView.draw());
    return img('assets/image/textures/map/' + id + '/01.webp', () => MapView && MapView.draw && MapView.draw());
  }

  /** Полотно дороги. */
  function roadOf(theme) {
    if (theme && theme.roadSrc) return img(theme.roadSrc, () => MapView && MapView.draw && MapView.draw());
    return null;
  }

  return {img, list, upload, groundOf, roadOf, get catalog() { return catalog; }};
})();
