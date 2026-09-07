////////////////////////////////////////////////////////
//
// afterPack не копирует 8 ГБ: это делает Собрать-билд / portable.
//
////////////////////////////////////////////////////////

'use strict';

/**
 * Хук electron-builder afterPack.
 * @param {object} context
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  console.log('Клиент собран в', context.appOutDir);
  console.log('Полный Content копирует npm run portable (Собрать-билд.bat).');
};
