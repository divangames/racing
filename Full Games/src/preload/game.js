////////////////////////////////////////////////////////
//
// Прелоад окна заезда: флаг десктопа без Node API.
//
////////////////////////////////////////////////////////

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rnrDesktop', {
  isDesktop: true,
  quit() {
    return ipcRenderer.invoke('game:quit');
  },
  /**
   * Текст сейва с диска (синхронно, как localStorage).
   * @param {string} key
   * @returns {string|null}
   */
  storeGet(key) {
    return ipcRenderer.sendSync('engine:store-get', key);
  },
  /**
   * Пишет сейв на диск.
   * @param {string} key
   * @param {string} value
   * @returns {boolean}
   */
  storeSet(key, value) {
    return ipcRenderer.sendSync('engine:store-set', key, value);
  },
  /**
   * Стирает сейв на диске.
   * @param {string} key
   * @returns {boolean}
   */
  storeRemove(key) {
    return ipcRenderer.sendSync('engine:store-remove', key);
  }
});
