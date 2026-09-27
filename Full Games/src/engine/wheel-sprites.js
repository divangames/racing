// Каталог колёс, автоопределение спрайт-листа и отрисовка вертикальных кадров.
(function (global) {
  'use strict';

  const DEFAULT_ID = 'standard';
  const FRAME_COUNT = 8;
  const DEFINITIONS = Object.freeze({
    standard: Object.freeze({
      id: 'standard',
      label: 'Стандартные',
      sources: Object.freeze([
        'assets/machines/wheels/wheel-strip.webp',
        'assets/machines/wheels/wheel-strip.png',
        'assets/machines/wheels/wheel-strip.svg'
      ])
    }),
    offroad: Object.freeze({
      id: 'offroad',
      label: 'Внедорожные',
      sources: Object.freeze(['assets/machines/wheels/wheel-offroad.png'])
    })
  });
  const images = new Map();
  const regionCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  const ALPHA_LIMIT = 16;
  const ACTIVE_AXIS_RATIO = 0.003;

  /** Возвращает безопасный id комплекта колёс. */
  function normalize(value) {
    const id = String(value || DEFAULT_ID).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(DEFINITIONS, id) ? id : DEFAULT_ID;
  }

  /** Загружает первый доступный формат комплекта и кэширует Image. */
  function image(value) {
    const id = normalize(value);
    if (images.has(id)) return images.get(id);
    if (typeof global.Image !== 'function') return null;
    const result = new global.Image();
    const sources = DEFINITIONS[id].sources;
    let index = 0;
    result.onerror = function () {
      index += 1;
      if (index < sources.length) result.src = sources[index];
    };
    result.src = sources[index];
    images.set(id, result);
    return result;
  }

  /** Определяет ось ленты и ориентацию кадра по реальным размерам картинки. */
  function layout(source, count) {
    const frames = Math.max(1, Number(count) || FRAME_COUNT);
    const width = Math.max(1, Number(source && source.naturalWidth) || 1);
    const height = Math.max(1, Number(source && source.naturalHeight) || 1);
    const verticalStrip = height > width;
    const frameWidth = verticalStrip ? width : width / frames;
    const frameHeight = verticalStrip ? height / frames : height;
    return { frames, verticalStrip, frameWidth, frameHeight, rotated: frameHeight > frameWidth };
  }

  /** Собирает непрерывные участки непустых столбцов или строк. */
  function activeRuns(projection, threshold) {
    const runs = [];
    let start = -1;
    for (let axis = 0; axis <= projection.length; axis += 1) {
      const active = axis < projection.length && projection[axis] > threshold;
      if (active && start < 0) start = axis;
      if (!active && start >= 0) {
        runs.push({ start, end: axis - 1 });
        start = -1;
      }
    }
    return runs;
  }

  /** Находит реальные прозрачные границы кадров, если художник оставил между ними неравные интервалы. */
  function detectRegions(source, count) {
    const info = layout(source, count);
    if (!global.document || typeof global.document.createElement !== 'function') return null;
    if (regionCache) {
      const cached = regionCache.get(source);
      if (cached && cached.frames === info.frames) return cached.regions;
    }
    try {
      const canvas = global.document.createElement('canvas');
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(source, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const axisLength = info.verticalStrip ? canvas.height : canvas.width;
      const crossLength = info.verticalStrip ? canvas.width : canvas.height;
      const projection = new Uint32Array(axisLength);
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] > ALPHA_LIMIT) {
            projection[info.verticalStrip ? y : x] += 1;
          }
        }
      }
      const threshold = Math.max(1, Math.floor(crossLength * ACTIVE_AXIS_RATIO));
      const runs = activeRuns(projection, threshold);
      if (runs.length !== info.frames) {
        if (regionCache) regionCache.set(source, { frames: info.frames, regions: null });
        return null;
      }
      const regions = runs.map(run => {
        let minX = info.verticalStrip ? 0 : run.start;
        let maxX = info.verticalStrip ? canvas.width - 1 : run.end;
        let minY = info.verticalStrip ? run.start : 0;
        let maxY = info.verticalStrip ? run.end : canvas.height - 1;
        let contentMinX = maxX, contentMaxX = minX, contentMinY = maxY, contentMaxY = minY;
        for (let y = minY; y <= maxY; y += 1) {
          for (let x = minX; x <= maxX; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] <= ALPHA_LIMIT) continue;
            contentMinX = Math.min(contentMinX, x); contentMaxX = Math.max(contentMaxX, x);
            contentMinY = Math.min(contentMinY, y); contentMaxY = Math.max(contentMaxY, y);
          }
        }
        return {
          x: contentMinX, y: contentMinY,
          width: contentMaxX - contentMinX + 1,
          height: contentMaxY - contentMinY + 1
        };
      });
      if (regionCache) regionCache.set(source, { frames: info.frames, regions });
      return regions;
    } catch (error) {
      if (regionCache) regionCache.set(source, { frames: info.frames, regions: null });
      return null;
    }
  }

  /** Возвращает точную область кадра или равную ячейку для непрозрачных старых лент. */
  function frameRect(source, selected, info) {
    const regions = detectRegions(source, info.frames);
    if (regions && regions[selected]) return regions[selected];
    return {
      x: info.verticalStrip ? 0 : selected * info.frameWidth,
      y: info.verticalStrip ? selected * info.frameHeight : 0,
      width: info.frameWidth,
      height: info.frameHeight
    };
  }

  /** Рисует кадр, автоматически поворачивая вертикально нарисованное колесо. */
  function draw(context, source, frame, drawWidth, drawHeight, count, options) {
    if (!source || !source.complete || !source.naturalWidth || !context) return false;
    const info = layout(source, count);
    const selected = ((Math.floor(Number(frame) || 0) % info.frames) + info.frames) % info.frames;
    const rect = frameRect(source, selected, info);
    const rotated = rect.height > rect.width;
    const centerX = Math.max(-100, Math.min(100, Number(options && options.x) || 0));
    const centerY = Math.max(-100, Math.min(100, Number(options && options.y) || 0));
    const offsetX = drawWidth * centerX / 100;
    const offsetY = drawHeight * centerY / 100;
    context.save();
    context.translate(offsetX, offsetY);
    if (rotated) {
      context.rotate(Math.PI / 2);
      context.drawImage(source, rect.x, rect.y, rect.width, rect.height,
        -drawHeight / 2, -drawWidth / 2, drawHeight, drawWidth);
    } else {
      context.drawImage(source, rect.x, rect.y, rect.width, rect.height,
        -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    context.restore();
    return true;
  }

  /** Описывает распознанную ориентацию для подсказки редактора. */
  function orientation(value) {
    const source = image(value);
    if (!source || !source.complete || !source.naturalWidth) return 'загрузка…';
    const info = layout(source, FRAME_COUNT);
    return (info.verticalStrip ? 'вертикальная лента' : 'горизонтальная лента') +
      (info.rotated ? ' · кадры поворачиваются автоматически' : ' · поворот не нужен');
  }

  const api = { DEFAULT_ID, FRAME_COUNT, DEFINITIONS, normalize, image, layout, activeRuns, detectRegions, draw, orientation };
  global.RnRWheelSprites = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
