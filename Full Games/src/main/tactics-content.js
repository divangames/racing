// Сохраняет сценарий арены в актуальном контенте редактора, не меняя соседние исходники игры.
'use strict';
/** Проверяет уникальность места встраивания, чтобы обновление контента не стирало поля молча. */
function replace(source, before, after) {
  if (source.split(before).length !== 2) throw new Error('Контракт тактики трасс изменился: ' + before);
  return source.replace(before, after);
}
/** Дополняет нормализацию, клонирование и JSON-снимки одним опциональным полем. */
function enhanceTacticsContent(source, pathname) {
  if (pathname === '/tracks.js') {
    source = replace(source, '        lockRatio: o.lockRatio !== false',
      '        lockRatio: o.lockRatio !== false,\n        flipX: !!o.flipX,\n        flipY: !!o.flipY');
    return replace(source, '      autoHazards: src.autoHazards !== false,',
      "      tactics: window.RnRTactics.normalize(src.tactics),\n      crossingMode: src.crossingMode === 'junction' ? 'junction' : 'overpass',\n      autoHazards: src.autoHazards !== false,");
  }
  if (pathname === '/editor/map-data.js') {
    source = replace(source, '      autoHazards: def && def.autoHazards === false ? false : true,',
      '      tactics: def && def.tactics,\n      crossingMode: def && def.crossingMode,\n      decks: def && def.decks,\n      gaps: def && def.gaps,\n      autoHazards: def && def.autoHazards === false ? false : true,');
    return replace(source, '      autoHazards: !!t.autoHazards,',
      '      tactics: t.tactics,\n      crossingMode: t.crossingMode,\n      autoHazards: !!t.autoHazards,');
  }
  return source;
}
module.exports = { enhanceTacticsContent };
