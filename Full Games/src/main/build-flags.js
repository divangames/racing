////////////////////////////////////////////////////////
//
// Флаги окна: десктоп и публичная упакованная сборка.
//
////////////////////////////////////////////////////////

'use strict';

/**
 * Скрипт в head: десктоп всегда, retail — только упакованный NSIS/MSI.
 * @param {boolean} publicBuild упакованный клиент для игрока
 * @returns {string}
 */
function desktopHeadScript(publicBuild) {
  const pub = publicBuild ? 'true' : 'false';
  return '<script>try{localStorage.setItem(\'rnr_client_notice_v1\',\'1\');}catch(e){}'
    + 'window.__RNR_DESKTOP__=true;window.__RNR_PUBLIC_BUILD__=' + pub + ';</script>';
}

module.exports = { desktopHeadScript };
